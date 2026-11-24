import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { debtDetail, debtHasPayments } from "@/server/debts";
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { cancelDebtAction, deleteDebtAction, payDebtOnAccountAction, prepayDebtAction, refinanceDebtAction, updateDebtAction } from "@/app/actions/modules";
import { DebtFormFields } from "@/app/app/deudas/debt-form";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MvBackHead } from "../../../head";
import { Toast } from "../../../ui";

export const metadata: Metadata = { title: "Deuda" };
const SYS: Record<string, string> = { FRENCH: "Francés", GERMAN: "Alemán", AMERICAN: "Americano", NO_INTEREST: "Sin interés", MANUAL: "Manual", NONE: "Sin cronograma" };
const pct = (v: unknown) => (v == null ? "No informada" : `${Number(v).toFixed(2).replace(".", ",")} %`);

export default async function DeudaMovil({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cancelada?: string; editada?: string; adelanto?: string; refinanciada?: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const det = await debtDetail(db, workspace.id, id);
  if (!det) notFound();
  const { debt } = det;
  const today = todayIn(workspace.timezone);
  const accounts = await db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: debt.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } });
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, debt.currency);
  const active = debt.status === "ACTIVE";
  const lastDue = det.open.at(-1)?.dueDate;
  const sp = await searchParams;
  const hasPayments = await debtHasPayments(db, workspace.id, debt.id);
  const num = (v: unknown) => (v == null ? "" : String(v).replace(".", ","));
  const firstDue = debt.schedule[0]?.dueDate;
  const paidBefore = debt.schedule.filter((r) => !r.obligationId).length;
  const back = <input type="hidden" name="back" value="/movil" />;
  const accSelect = <label className="field">Sale de<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>;
  const adelanto = sp.adelanto?.split(":");
  const notice = sp.editada ? (sp.editada === "todo" ? "Listo, el préstamo quedó corregido." : "Listo, guardamos los cambios.")
    : adelanto ? `Listo, registramos el pago anticipado.${Number(adelanto[2]) > 0 ? ` Te ahorras ${fm(adelanto[2])} en intereses.` : ""}`
    : sp.refinanciada ? "Listo, refinanciamos lo que faltaba." : sp.cancelada ? "Deuda cancelada. Las cuotas que faltaban se cerraron." : null;

  return (
    <main className="mv-main">
      {notice && <Toast text={notice} />}
      <MvBackHead href="/movil/explorar/deudas" sub={debt.kind} title={debt.creditor} />

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{active ? "Te falta devolver" : debt.status === "CANCELLED" ? "Cancelada" : "Pagada"}</div>
          <div className="mv-num mv-amt" style={{ fontSize: 32 }}>{active ? fm(det.remainingCapital) : <span className="pos">✓</span>}</div>
        </div>
        {debt.installments ? (
          <div>
            <span style={{ display: "block", height: 10, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${(det.settledCount / debt.installments) * 100}%`, background: "#E08A1E" }} /></span>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginTop: 6 }}>{det.settledCount} de {debt.installments} cuotas pagadas</div>
          </div>
        ) : <div style={{ fontSize: 13, color: "var(--muted)" }}>Sin cuotas ni fecha pactada.</div>}
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          {det.next && <><span>Próxima cuota · {fmtDate(det.next.dueDate)}</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{fm(det.next.total)}</b></>}
          {lastDue && <><span>Terminas de pagar</span><b style={{ color: "var(--ink)" }}>{fmtPeriod(period(lastDue))}</b></>}
          {det.futureSum.gt(0) && <><span>Si pagas todas las cuotas</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{fm(det.futureSum)}</b></>}
          <span>Te prestaron</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{fm(debt.principal)}</b>
        </div>
        {active && det.next && <Link className="mv-btn pri" href={`/movil/proximos/${det.next.obligationId}`} style={{ flex: "none" }}>Pagar cuota {det.next.number}</Link>}
      </section>

      {active && det.futureSum.gt(det.remainingCapital) && <div className="mv-ok">Si la cancelas hoy pagando el capital que falta, te ahorras <span className="mv-amt">{fm(det.futureSum.minus(det.remainingCapital))}</span> en intereses (sin contar comisiones).</div>}

      {active && (det.rows.length ? (
        <>
          <details className="mv-card mv-more">
            <summary>Pagar una parte por adelantado</summary>
            <ActionForm action={prepayDebtAction} className="mv-web">
              {back}<input type="hidden" name="debtId" value={debt.id} />
              <p className="sub" style={{ margin: 0 }}>Adelantas capital y pagas menos intereses. Te falta devolver {fm(det.remainingCapital)}.</p>
              <label className="field">¿Cuánto adelantas?<input name="amount" inputMode="decimal" placeholder="0,00" /></label>
              <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
              {accSelect}
              <div className="paychs" role="radiogroup" aria-label="Qué quieres que baje">
                <label className="paych"><input type="radio" name="mode" value="cuota" defaultChecked /><span className="grow"><b>Que baje la cuota</b><span className="sub">Sigues con las mismas cuotas, pero más chicas.</span></span></label>
                {debt.system !== "AMERICAN" && <label className="paych"><input type="radio" name="mode" value="plazo" /><span className="grow"><b>Que baje el plazo</b><span className="sub">Pagas la misma cuota y terminas antes. Ahorras más intereses.</span></span></label>}
              </div>
              <div><Submit>Registrar pago anticipado</Submit></div>
            </ActionForm>
          </details>
          <details className="mv-card mv-more">
            <summary>Cancelar total</summary>
            <ActionForm action={cancelDebtAction} className="mv-web">
              {back}<input type="hidden" name="debtId" value={debt.id} />
              <p className="sub" style={{ margin: 0 }}>Pídele al acreedor el saldo para cancelar. Si no lo tienes, usamos el capital que falta.</p>
              <label className="field">Monto a pagar hoy<input name="amount" inputMode="decimal" defaultValue={det.remainingCapital.toFixed(2).replace(".", ",")} /></label>
              <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
              {accSelect}
              <div><ConfirmSubmit className="btn pri" question="¿Cancelar la deuda con este pago? Se borran las cuotas que quedan." yes="Sí, cancelar">Confirmar cancelación</ConfirmSubmit></div>
            </ActionForm>
          </details>
          <details className="mv-card mv-more">
            <summary>Refinanciar</summary>
            <ActionForm action={refinanceDebtAction} className="mv-web">
              {back}<input type="hidden" name="debtId" value={debt.id} />
              <p className="sub" style={{ margin: 0 }}>Las cuotas ya pagadas no se tocan; las {det.open.length} que faltan se reemplazan por las nuevas.</p>
              <label className="field">Saldo que refinancias<input name="principal" inputMode="decimal" defaultValue={det.remainingCapital.toFixed(2).replace(".", ",")} /></label>
              <label className="field">¿En cuántas cuotas?<input name="installments" inputMode="numeric" placeholder="Ej.: 24" /></label>
              <label className="field">Cuota nueva (o la TNA)<input name="installmentAmount" inputMode="decimal" placeholder="0,00" /></label>
              <label className="field">TNA %<input name="tna" inputMode="decimal" placeholder="Opcional" /></label>
              <label className="field">¿Cuándo vence la primera?<input name="firstDue" type="date" defaultValue={isoDate(det.open[0]?.dueDate ?? today)} /></label>
              <div><ConfirmSubmit className="btn pri" question="¿Refinanciar? Las cuotas que faltan se reemplazan por las nuevas." yes="Sí, refinanciar">Refinanciar</ConfirmSubmit></div>
            </ActionForm>
          </details>
        </>
      ) : (
        <details className="mv-card mv-more" open>
          <summary>Registrar un pago a cuenta</summary>
          <ActionForm action={payDebtOnAccountAction} className="mv-web">
            {back}<input type="hidden" name="debtId" value={debt.id} />
            <label className="field">Monto<input name="amount" inputMode="decimal" /></label>
            <label className="field">Fecha<input name="date" type="date" defaultValue={isoDate(today)} /></label>
            {accSelect}
            <div><Submit>Registrar pago</Submit></div>
          </ActionForm>
        </details>
      ))}

      {det.rows.length > 0 && (
        <details className="mv-card mv-more">
          <summary>Cronograma de cuotas</summary>
          <div className="mv-card-list" style={{ margin: "0 -16px", maxHeight: 420, overflow: "auto" }}>
            {det.rows.map((r) => {
              const st = r.status === "SETTLED" || r.status === "PAID_BEFORE" ? ["Pagada", "pos"] : r.status === "CANCELLED" ? ["Cancelada", ""] : r.dueDate < today ? ["Atrasada", "neg"] : r.status === "PARTIAL" ? ["En parte", ""] : ["Pendiente", ""];
              return (
                <div key={r.id} className="mv-row">
                  <span className="grow"><span className="t" style={{ display: "block" }}>Cuota {r.number}/{debt.installments} · {fmtDate(r.dueDate)}</span><span className="s">Capital <span className="mv-amt">{fm(r.capital)}</span> · interés <span className="mv-amt">{fm(r.interest)}</span> · <span className={st[1]}>{st[0]}</span></span></span>
                  <b className="v mv-num mv-amt">{fm(r.total)}</b>
                </div>
              );
            })}
          </div>
        </details>
      )}

      <details className="mv-card mv-more">
        <summary>Condiciones</summary>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "6px 12px", fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>
          {debt.installmentAmount && <><span>Cuota informada</span><b className="mv-amt" style={{ color: "var(--ink)" }}>{fm(debt.installmentAmount)}</b></>}
          <span>Sistema</span><b style={{ color: "var(--ink)" }}>{SYS[debt.system]}</b>
          <span>Desde</span><b style={{ color: "var(--ink)" }}>{fmtDate(debt.startDate)}</b>
          <span>TNA</span><b style={{ color: "var(--ink)" }}>{pct(debt.tna)}</b>
          <span>TEA</span><b style={{ color: "var(--ink)" }}>{pct(debt.tea)}</b>
          <span>CFT</span><b style={{ color: "var(--ink)" }}>{pct(debt.cft)}</b>
          {debt.notes && <><span>Notas</span><b style={{ color: "var(--ink)" }}>{debt.notes}</b></>}
        </div>
      </details>

      <details className="mv-card mv-more">
        <summary>Editar o eliminar</summary>
        <ActionForm action={updateDebtAction} className="mv-web">
          {back}<input type="hidden" name="debtId" value={debt.id} />
          {hasPayments ? (
            <>
              <label className="field">¿A quién le debes?<input name="creditor" defaultValue={debt.creditor} /></label>
              <label className="field">Tipo<input name="kind" defaultValue={debt.kind} /></label>
              <label className="field">Notas<input name="notes" defaultValue={debt.notes ?? ""} /></label>
              <p className="sub" style={{ margin: 0 }}>Ya registraste pagos, así que acá se cambian el nombre, el tipo y las notas. Si el monto, las cuotas o la tasa están mal, elimínalo y cárgalo de nuevo.</p>
            </>
          ) : (
            <DebtFormFields edit accounts={[]} today={isoDate(today)} baseCurrency={debt.currency} d={{ creditor: debt.creditor, kind: debt.kind, system: debt.system, principal: num(debt.principal), installments: debt.installments ? String(debt.installments) : "", firstDue: firstDue ? isoDate(firstDue) : "", installmentAmount: num(debt.installmentAmount), tna: num(debt.tna), tea: num(debt.tea), cft: num(debt.cft), startDate: isoDate(debt.startDate), paidInstallments: paidBefore ? String(paidBefore) : "", notes: debt.notes ?? "", vatPct: num(debt.vatPct), insurancePct: num(debt.insurancePct), insuranceFixed: num(debt.insuranceFixed), rows: debt.system === "MANUAL" ? debt.schedule.map((r) => ({ due: isoDate(r.dueDate), total: String(r.total) })) : undefined }} />
          )}
          <div><Submit>Guardar cambios</Submit></div>
        </ActionForm>
        <form action={deleteDebtAction} className="mv-fs mv-del">
          {back}<input type="hidden" name="debtId" value={debt.id} />
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>¿Lo cargaste por error? Elimínalo: se borran las cuotas{hasPayments ? " y los pagos que registraste" : ""}.</p>
          <ConfirmSubmit className="mv-btn mv-danger" question={`¿Eliminar el préstamo de ${debt.creditor}? Se borran todas sus cuotas${hasPayments ? " y los pagos que registraste (el saldo de tus cuentas vuelve a como estaba)" : ""}${debt.accountId ? " y el dinero que entró en la cuenta" : ""}. No se puede deshacer.`} yes="Sí, eliminar">Eliminar préstamo</ConfirmSubmit>
        </form>
      </details>
    </main>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { matchingPaid, paidSoFar, remaining } from "@/server/ledger";
import { isEstimatedGrain, loadSaleHref } from "@/server/grain";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { deleteObligationAction, linkToPendingAction, payObligationAction, updateObligationAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { PayChoice } from "@/app/app/proximos/[id]/pay-choice";
import { symbolOf } from "@/lib/countries";
import { MvForm, MvSubmit } from "../../form-ui";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const ob = await getDb().obligation.findFirst({ where: { id, workspaceId: workspace.id }, select: { direction: true } });
  return { title: ob?.direction === "RECEIVABLE" ? "Registrar cobro" : "Registrar pago" };
}

// Registrar un pago o cobro pendiente (mismas reglas que la web), y corregirlo o eliminarlo.
export default async function PagarMovil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace, modules, plan } = await requireWorkspace();
  const db = getDb();
  const ob = await db.obligation.findFirst({ where: { id, workspaceId: workspace.id }, include: { payments: true, category: { select: { name: true } } } });
  if (!ob || ob.status === "SETTLED" || ob.status === "CANCELLED") notFound();
  if (modules.cereal && isEstimatedGrain({ ...ob, category: ob.category?.name, paid: paidSoFar(ob) }) && (await canUse(plan, "cereal"))) redirect(loadSaleHref(ob.dueDate));
  const accounts = await db.account.findMany({ where: { workspaceId: workspace.id, active: true, currency: ob.currency, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const left = remaining(ob);
  const inc = ob.direction === "RECEIVABLE";
  const rule = ob.recurringRuleId ? await db.recurringRule.findFirst({ where: { id: ob.recurringRuleId, workspaceId: workspace.id }, select: { accountId: true } }) : null;
  const card = ob.sourceType === "card" && ob.sourceId ? await db.creditCard.findFirst({ where: { id: ob.sourceId, workspaceId: workspace.id }, select: { payAccountId: true } }) : null;
  const preferred = [rule?.accountId, card?.payAccountId].find((x) => x && accounts.some((a) => a.id === x)) ?? accounts[0]?.id;
  const fmt = (n: number) => new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  const today = todayIn(workspace.timezone);
  const recurring = !!ob.recurringRuleId;
  const stmt = ob.sourceType === "card" ? await db.cardStatement.findUnique({ where: { obligationId: ob.id }, include: { card: { select: { financeRate: true } } } }) : null;
  const isDebt = ob.sourceType === "debt";
  const settleDefault = (inc || recurring || isDebt) && !stmt;
  const already = !ob.sourceType && ob.payments.length === 0 ? await matchingPaid(db, workspace.id, ob) : null;
  const editable = ob.sourceType !== "card" && ob.sourceType !== "grain";
  const deletable = editable && ob.sourceType !== "debt" && ob.payments.length === 0;
  const cats = editable ? await db.category.findMany({ where: { workspaceId: workspace.id, archived: false, kind: inc ? "INCOME" : "EXPENSE" }, orderBy: [{ parentId: "asc" }, { name: "asc" }] }) : [];
  const options = cats.filter((c) => !c.parentId).flatMap((p) => [{ id: p.id, label: p.name }, ...cats.filter((c) => c.parentId === p.id).map((c) => ({ id: c.id, label: `${p.name} › ${c.name}` }))]);
  const late = ob.dueDate < today;

  return (
    <main className="mv-main">
      <header className="mv-head" style={{ justifyContent: "flex-start", gap: 12 }}>
        <Link className="mv-ibtn" href="/movil/proximos" aria-label="Volver a Próximos"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg></Link>
        <h1 className="mv-hello" style={{ fontSize: 20 }}>{inc ? "Registrar cobro" : "Registrar pago"}</h1>
      </header>

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{ob.description}</div>
        <div className={`mv-num mv-amt ${inc ? "pos" : ""}`} style={{ fontSize: 34 }}>{formatMoney(left, ob.currency)}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: late ? "#A3231B" : "var(--muted)" }}>{inc ? "Falta cobrar" : "Falta pagar"} · {late ? "venció" : "vence"} el {fmtDate(ob.dueDate)}</div>
        {!left.equals(ob.amount) && <div style={{ fontSize: 13, color: "var(--muted)" }}>Total: {formatMoney(ob.amount, ob.currency)}</div>}
        {stmt && <div style={{ fontSize: 13, color: "var(--muted)" }}>Pago mínimo: {formatMoney(stmt.minimumAmount, ob.currency)}</div>}
      </section>

      {already && (
        <form action={linkToPendingAction} className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10, background: "#FFF6E5" }}>
          <input type="hidden" name="obligationId" value={ob.id} /><input type="hidden" name="transactionId" value={already.id} /><input type="hidden" name="back" value="/movil" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Ya cargaste <b>{already.description}</b> el {fmtDate(already.effectiveDate)} por {formatMoney(already.amount, already.currency)}. Si es el mismo, no lo registres de nuevo.</span>
          <button className="mv-btn pri" type="submit" style={{ flex: "none" }}>Es el mismo</button>
        </form>
      )}

      {accounts.length ? (
        <MvForm action={payObligationAction}>
          <input type="hidden" name="obligationId" value={ob.id} />
          <input type="hidden" name="kind" value={inc ? "cobro" : "pago"} />
          <input type="hidden" name="back" value={`/movil/proximos?listo=${inc ? "cobro" : "pago"}`} />
          {stmt
            ? <PayChoice total={fmt(left.toNumber())} minimum={fmt(Math.min(Number(stmt.minimumAmount), left.toNumber()))} symbol={symbolOf(ob.currency)} interest={stmt.card.financeRate ? `TNA ${Number(stmt.card.financeRate).toString().replace(".", ",")}%` : null} />
            : <label className="mv-lbl">{inc ? "¿Cuánto cobraste?" : "¿Cuánto pagaste?"}<input className="mv-input" name="amount" inputMode="decimal" defaultValue={fmt(left.toNumber())} /></label>}
          <label className="mv-lbl">Fecha<input className="mv-input" name="date" type="date" defaultValue={isoDate(today)} max={isoDate(today)} /></label>
          <fieldset className="mv-fs">
            <legend className="mv-lbl" style={{ marginBottom: 6 }}>{inc ? "¿En qué cuenta entró?" : "¿De qué cuenta salió?"}</legend>
            <div className="mv-radios">
              {accounts.map((a) => <label key={a.id}><input type="radio" name="accountId" value={a.id} defaultChecked={a.id === preferred} /><span>{a.name}</span></label>)}
            </div>
          </fieldset>
          {!stmt && (
            <label className="mv-check">
              <input type="checkbox" name="settle" defaultChecked={settleDefault} />
              <span><b>Fue el total</b><br /><span>{inc ? "Si cobraste otro monto, queda así y no queda nada pendiente." : "Si vino por otro monto, queda así y no queda nada pendiente."} Desmárcalo si fue una parte y falta el resto.</span></span>
            </label>
          )}
          {(recurring || isDebt) && (
            <label className="mv-check">
              <input type="checkbox" name="updateFuture" />
              <span><b>Usar este monto para las próximas {isDebt ? "cuotas" : "veces"}</b></span>
            </label>
          )}
          <MvSubmit>{inc ? "Registrar cobro" : "Registrar pago"}</MvSubmit>
        </MvForm>
      ) : (
        <div className="mv-card mv-empty">Necesitas una cuenta activa en {ob.currency}. <Link className="mv-link" href="/movil/explorar/cuentas?nueva=1">Crear cuenta</Link></div>
      )}

      {editable && (
        <details className="mv-card mv-more">
          <summary>Corregir o eliminar</summary>
          <MvForm action={updateObligationAction}>
            <input type="hidden" name="id" value={ob.id} />
            <input type="hidden" name="back" value="/movil" />
            <label className="mv-lbl">Concepto<input className="mv-input" name="description" defaultValue={ob.description} /></label>
            <label className="mv-lbl">Monto total<input className="mv-input" name="amount" inputMode="decimal" defaultValue={fmt(Number(ob.amount))} /></label>
            <label className="mv-lbl">{inc ? "Fecha de cobro" : "Vence el"}<input className="mv-input" name="dueDate" type="date" defaultValue={isoDate(ob.dueDate)} /></label>
            <label className="mv-lbl">Categoría<select className="mv-input" name="categoryId" defaultValue={ob.categoryId ?? ""}><option value="">Sin categoría</option>{options.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
            <label className="mv-lbl">Nota<input className="mv-input" name="notes" defaultValue={ob.notes ?? ""} placeholder="Opcional" /></label>
            {recurring && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Se repite: el cambio es solo para esta vez.</p>}
            {isDebt && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Es una cuota de préstamo: el cronograma muestra el monto y la fecha nuevos.</p>}
            <MvSubmit className="mv-btn mv-big">Guardar cambios</MvSubmit>
          </MvForm>
          {deletable && (
            <MvForm action={deleteObligationAction} className="mv-fs mv-del">
              <input type="hidden" name="id" value={ob.id} />
              <input type="hidden" name="back" value="/movil" />
              <span style={{ fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>{recurring ? "¿Esta vez no va? Se saca solo esta vez." : "¿Lo cargaste por error? Se borra del todo."}</span>
              <ConfirmSubmit className="mv-btn mv-danger" question={`¿Eliminar ${ob.description}${recurring ? " (solo esta vez)" : ""}?`} yes="Sí, eliminar">Eliminar</ConfirmSubmit>
            </MvForm>
          )}
        </details>
      )}
    </main>
  );
}

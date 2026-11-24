import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { accountBalances, listMovements } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, period, todayIn } from "@/lib/dates";
import { reconcileAction, toggleAccountAction, updateAccountAction } from "@/app/actions/app";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MvBackHead } from "../../../head";
import { MvForm, MvSubmit } from "../../../form-ui";
import { CountUp } from "../../../ui";

export const metadata: Metadata = { title: "Cuenta" };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Barras del saldo al cierre de cada mes.
function BalanceBars({ data, currency }: { data: { label: string; value: number }[]; currency: string }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="mv-bars" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }} role="img" aria-label={`Saldo de los últimos meses: ${data.map((d) => `${d.label} ${formatMoney(d.value, currency)}`).join(", ")}`}>
      {data.map((d, i) => (
        <div key={i} style={{ height: 116, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
          <i style={{ height: `${Math.max(6, Math.round((Math.abs(d.value) / max) * 88))}px`, background: d.value < 0 ? "#F2B8B5" : i === data.length - 1 ? "var(--brand)" : "#A9C9B6" }} />
          <span style={{ color: "var(--faint)" }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default async function CuentaMovil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const a = await db.account.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!a || a.type === "CREDIT_CARD") notFound();
  const today = todayIn(workspace.timezone);
  const [balances, mv] = await Promise.all([accountBalances(db, workspace.id, today), listMovements(db, workspace.id, { accountId: a.id, take: 40 })]);
  const bal = balances.get(a.id) ?? ZERO;
  const mes = mv.filter((t) => period(t.effectiveDate) === period(today));
  const ent = mes.filter((t) => t.direction === "IN").reduce((s, t) => s.plus(t.amount.toString()), ZERO);
  const sal = mes.filter((t) => t.direction === "OUT").reduce((s, t) => s.plus(t.amount.toString()), ZERO);
  const ends = Array.from({ length: 5 }, (_, k) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 4 + k, 0)));
  const after = await db.transaction.findMany({ where: { workspaceId: workspace.id, accountId: a.id, effectiveDate: { gt: ends[0], lte: today } }, select: { effectiveDate: true, direction: true, amount: true } });
  const hist = [...ends.map((e) => ({ label: MES[e.getUTCMonth()], value: after.filter((t) => t.effectiveDate > e).reduce((s, t) => (t.direction === "IN" ? s.minus(t.amount.toString()) : s.plus(t.amount.toString())), bal).toNumber() })), { label: "hoy", value: bal.toNumber() }]
    .filter((_, i, arr) => i === arr.length - 1 || ends[i] >= new Date(Date.UTC(a.initialDate.getUTCFullYear(), a.initialDate.getUTCMonth(), 0)));
  const odd = bal.isNegative() && a.type !== "INVESTMENT";

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar/cuentas" sub={a.institution || ACCOUNT_TYPE_LABEL[a.type]} title={a.name} />

      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Saldo actual{a.active ? "" : " · desactivada"}</div>
          <div style={{ fontSize: 32, letterSpacing: "-.02em" }} className={odd ? "neg" : ""}><CountUp className="mv-num mv-amt" value={bal.toNumber()} currency={a.currency} /></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{a.type === "INVESTMENT" ? "Está invertido: no cuenta como dinero disponible." : "Disponible para usar."}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Entró este mes</div><b className="mv-num mv-amt pos">+ {formatMoney(ent, a.currency)}</b></div>
          <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Salió este mes</div><b className="mv-num mv-amt">− {formatMoney(sal, a.currency)}</b></div>
        </div>
        {a.active && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link className="mv-btn" href="/movil/cargar?tipo=transferencia" style={{ borderColor: "var(--field-line)" }}>Transferir</Link>
            <Link className="mv-btn pri" href="/movil/cargar">+ Movimiento</Link>
          </div>
        )}
      </section>

      {odd && <p className="mv-error" role="alert">El saldo quedó negativo. ¿Falta cargar un ingreso? Si tu banco dice otra cosa, corrige el saldo más abajo.</p>}

      {hist.length > 2 && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 className="mv-h2" style={{ fontSize: 16 }}>Cómo fue el saldo</h2>
          <BalanceBars data={hist} currency={a.currency} />
        </section>
      )}

      <section className="mv-sec" style={{ gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: "var(--muted)" }}>Últimos movimientos</h2>
        {mv.length ? (
          <div className="mv-card-list mv-cas">
            {mv.map((t) => (
              <Link key={t.id} className="mv-row" href={`/movil/movimientos/${t.id}`} style={t.reversedBy || t.reversalOfId ? { opacity: 0.6 } : undefined}>
                <span className="mv-date"><b style={{ fontSize: 15 }}>{t.effectiveDate.getUTCDate()}</b><small style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>{MES[t.effectiveDate.getUTCMonth()]}</small></span>
                <span className="grow"><span className="t" style={{ display: "block" }}>{t.description}</span><span className="s">{t.category?.name ?? (t.type === "TRANSFER" ? "Entre tus cuentas" : t.type === "ADJUSTMENT" ? "Corrección de saldo" : "Sin categoría")}</span></span>
                <b className={`v mv-num mv-amt ${t.direction === "IN" ? "pos" : ""}`}>{t.direction === "IN" ? "+ " : "− "}{formatMoney(t.amount, a.currency)}</b>
              </Link>
            ))}
          </div>
        ) : <div className="mv-card mv-empty">Todavía no hay movimientos en esta cuenta.</div>}
      </section>

      <details className="mv-card mv-more" open={odd}>
        <summary>¿No coincide con tu banco?</summary>
        <MvForm action={reconcileAction}>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Escribe el saldo que ves en tu banco. Si es distinto, agregamos una corrección por la diferencia. Tus movimientos anteriores no cambian.</p>
          <input type="hidden" name="accountId" value={a.id} />
          <label className="mv-lbl">Saldo según el banco<input className="mv-input" name="target" inputMode="decimal" defaultValue={bal.toFixed(2).replace(".", ",")} /></label>
          {a.lastReconciledAt && <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>Última corrección: {fmtDate(a.lastReconciledAt)}</p>}
          <MvSubmit className="mv-btn mv-big">Corregir el saldo</MvSubmit>
        </MvForm>
      </details>

      <details className="mv-card mv-more">
        <summary>Editar cuenta</summary>
        <MvForm action={updateAccountAction}>
          <input type="hidden" name="id" value={a.id} />
          <label className="mv-lbl">Nombre<input className="mv-input" name="name" defaultValue={a.name} /></label>
          <label className="mv-lbl">Banco o institución<input className="mv-input" name="institution" defaultValue={a.institution ?? ""} /></label>
          <label className="mv-lbl">Notas<input className="mv-input" name="notes" defaultValue={a.notes ?? ""} /></label>
          <MvSubmit className="mv-btn mv-big">Guardar cambios</MvSubmit>
        </MvForm>
        <form action={toggleAccountAction} className="mv-fs mv-del">
          <input type="hidden" name="id" value={a.id} />
          <input type="hidden" name="back" value="/movil" />
          {a.active
            ? <ConfirmSubmit className="mv-btn mv-danger" question={`¿Desactivar ${a.name}? Deja de aparecer para cargar movimientos y no suma en tus saldos. Sus movimientos quedan y la puedes reactivar cuando quieras.`} yes="Sí, desactivar">Desactivar cuenta</ConfirmSubmit>
            : <button className="mv-btn pri mv-big" type="submit">Reactivar cuenta</button>}
        </form>
      </details>
    </main>
  );
}

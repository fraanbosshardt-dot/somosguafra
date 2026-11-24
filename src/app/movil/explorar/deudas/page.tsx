import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listDebts } from "@/server/debts";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { createDebtAction } from "@/app/actions/modules";
import { DebtFormFields } from "@/app/app/deudas/debt-form";
import { MvBackHead } from "../../head";
import { CountUp, MvIcon, Toast } from "../../ui";

export const metadata: Metadata = { title: "Deudas y préstamos" };

export default async function DeudasMovil({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { workspace } = await requireWorkspace();
  const { borrada } = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [all, accounts] = await Promise.all([listDebts(db, workspace.id, today), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, select: { id: true, name: true, currency: true } })]);
  const active = all.filter((d) => d.debt.status === "ACTIVE"), closed = all.filter((d) => d.debt.status !== "ACTIVE");
  const cur = workspace.baseCurrency;
  const total = active.filter((d) => d.debt.currency === cur).reduce((s, d) => s.plus(d.remainingCapital), ZERO);
  const thisMonth = active.flatMap((d) => d.open).filter((r) => period(r.dueDate) === period(today) || r.dueDate < today).reduce((s, r) => s.plus(r.total.toString()), ZERO);
  const lastDue = active.flatMap((d) => d.open).reduce<Date | null>((m, r) => (!m || r.dueDate > m ? r.dueDate : m), null);
  return (
    <main className="mv-main">
      {borrada && <Toast text="Listo, eliminamos el préstamo con sus cuotas." />}
      <MvBackHead href="/movil/explorar" sub="Pagos y deudas" title="Deudas y préstamos" />
      {active.length > 0 && (
        <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>Te falta devolver</div>
            <div style={{ fontSize: 32, letterSpacing: "-.02em" }}><CountUp className="mv-num mv-amt" value={total.toNumber()} currency={cur} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Falta pagar este mes</div><b className={`mv-amt ${thisMonth.isZero() ? "pos" : ""}`}>{thisMonth.isZero() ? "Al día" : formatMoney(thisMonth, cur)}</b></div>
            <div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>Terminas de pagar</div><b>{lastDue ? fmtPeriod(period(lastDue)) : "—"}</b></div>
          </div>
        </section>
      )}
      {active.length > 0 && (
        <div className="mv-card-list mv-cas">
          {active.map((d) => (
            <Link key={d.debt.id} href={`/movil/explorar/deudas/${d.debt.id}`} className="mv-row" style={{ flexWrap: "wrap" }}>
              <span className="mv-date" style={d.overdue > 0 ? { background: "#FDECEA", color: "#A3231B" } : undefined}><MvIcon name="bank" /></span>
              <span className="grow"><span className="t" style={{ display: "block" }}>{d.debt.creditor}</span><span className="s">{d.overdue > 0 ? "Atrasada · " : ""}{d.debt.installments ? `${d.settledCount} de ${d.debt.installments} cuotas` : d.debt.kind}{d.next ? ` · próxima ${fmtDate(d.next.dueDate)}` : ""}</span></span>
              <b className="v mv-num mv-amt">{formatMoney(d.remainingCapital, d.debt.currency)}</b>
              {d.debt.installments ? <span style={{ width: "100%", paddingLeft: 54, display: "block" }}><span style={{ display: "block", height: 6, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${(d.settledCount / d.debt.installments) * 100}%`, background: "#E08A1E" }} /></span></span> : null}
            </Link>
          ))}
        </div>
      )}
      <details className="mv-card mv-more" open={active.length === 0}>
        <summary>Nueva deuda o préstamo</summary>
        <ActionForm action={createDebtAction} className="mv-web">
          <input type="hidden" name="back" value="/movil" />
          <DebtFormFields accounts={accounts} today={isoDate(today)} baseCurrency={cur} />
          <div><Submit>Guardar deuda</Submit></div>
        </ActionForm>
      </details>
      {closed.length > 0 && (
        <details className="mv-card mv-more">
          <summary>Terminadas ({closed.length})</summary>
          <div className="mv-card-list" style={{ margin: "0 -16px" }}>
            {closed.map((d) => <Link key={d.debt.id} className="mv-row" href={`/movil/explorar/deudas/${d.debt.id}`}><span className="grow"><span className="t" style={{ display: "block" }}>{d.debt.creditor}</span><span className="s">{d.debt.status === "CANCELLED" ? `Cancelada${d.debt.cancelledAt ? ` el ${fmtDate(d.debt.cancelledAt)}` : ""}` : "Pagada por completo"}</span></span><MvIcon name="chev" /></Link>)}
          </div>
        </details>
      )}
    </main>
  );
}

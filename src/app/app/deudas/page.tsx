import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { debtSummary } from "@/server/financial-summaries";
import { listDebts } from "@/server/debts";
import { formatMoney, ZERO } from "@/lib/money";
import { fmtDate, fmtPeriod, isoDate, period, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createDebtAction } from "@/app/actions/modules";
import { DebtFormFields } from "./debt-form";

export const metadata: Metadata = { title: "Deudas y préstamos" };

export default async function Debts({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { workspace } = await requireWorkspace();
  const { borrada } = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [all, accounts] = await Promise.all([listDebts(db, workspace.id, today), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, select: { id: true, name: true, currency: true } })]);
  const active = all.filter((d) => d.debt.status === "ACTIVE"), closed = all.filter((d) => d.debt.status !== "ACTIVE");
  const cur = workspace.baseCurrency;
  const summaries = debtSummary(active, today);
  const lastDue = active.flatMap((d) => d.open).reduce<Date | null>((m, r) => (!m || r.dueDate > m ? r.dueDate : m), null);
  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Deudas y préstamos" desc="Consultá cuotas, pagos y capital estimado de cada deuda." />
      {borrada && <p className="notice g" role="status">Listo, eliminamos el préstamo con sus cuotas.</p>}
      {summaries.map((s) => <div className="card" key={s.currency}><div className="chead"><h3>Deudas en {s.currency}</h3></div><div className="acts" style={{ gap: 28 }}><Stat label="Capital pendiente según cronograma" value={formatMoney(s.capital, s.currency)} /><Stat label="Cuotas del mes y atrasadas" value={s.due.isZero() ? "Al día" : formatMoney(s.due, s.currency)} tone={s.due.isZero() ? "pos" : undefined} /></div></div>)}
      {summaries.length > 0 && <details className="card more"><summary>Cómo se calculan estos importes</summary><p className="sub">Las cuotas del mes y atrasadas descuentan los pagos parciales. El capital y las cuotas con intereses son conceptos distintos: no se suman entre sí. Si pagaste parte de una cuota con intereses o cargos, el capital se estima proporcionalmente al cronograma. Confirmá el saldo con el acreedor antes de cancelar.</p></details>}
      {lastDue && <p className="sub">Último vencimiento registrado: {fmtPeriod(period(lastDue))}.</p>}
      {active.length > 0 && (
        <div className="grid g3">{active.map((d) => (
          <Link key={d.debt.id} href={`/app/deudas/${d.debt.id}`} className="card dcard" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="chead" style={{ marginBottom: 6 }}><div><h3>{d.debt.creditor}</h3><p className="sub">{d.debt.kind}</p></div>{d.overdue > 0 && <span className="pill r">Atrasada</span>}</div>
            <div className="num" style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 600 }}>{formatMoney(d.remainingCapital, d.debt.currency)}</div><p className="sub">te falta devolver</p>
            {d.debt.installments ? (<><div className="bar" style={{ margin: "12px 0 6px" }}><i style={{ width: `${(d.settledCount / d.debt.installments) * 100}%`, background: "var(--ink)" }} /></div><div className="sub" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><span>{d.settledCount} de {d.debt.installments} cuotas</span>{d.next && <span>Próxima: {fmtDate(d.next.dueDate)}</span>}</div></>) : <p className="sub" style={{ marginTop: 12 }}>Sin cuotas ni fecha pactada</p>}
          </Link>
        ))}</div>
      )}
      <div className="card">
        <details className="more" open={active.length === 0}>
          <summary>+ Nueva deuda o préstamo</summary>
          <ActionForm action={createDebtAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <DebtFormFields accounts={accounts} today={isoDate(today)} baseCurrency={cur} />
            <div><Submit>Guardar deuda</Submit></div>
          </ActionForm>
        </details>
        {closed.length > 0 && (
          <details className="more"><summary>Deudas terminadas ({closed.length})</summary>
            <div className="list" style={{ paddingTop: 6 }}>{closed.map((d) => <Link key={d.debt.id} className="li" href={`/app/deudas/${d.debt.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{d.debt.creditor}</div><div className="s">{d.debt.status === "CANCELLED" ? `Cancelada el ${d.debt.cancelledAt ? fmtDate(d.debt.cancelledAt) : ""}` : "Pagada por completo"}</div></div><span className="pill g">Cerrada</span></Link>)}</div>
          </details>
        )}
      </div>
    </>
  );
}

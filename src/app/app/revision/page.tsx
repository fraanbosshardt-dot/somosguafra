import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { todayIn, period, periodStart, fmtPeriod, fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { reviewNextStep } from "@/lib/review-next-step";

export const metadata: Metadata = { title: "Revisión del mes" };
export default async function MonthReview() {
  const { workspace } = await requireWorkspace(), db = getDb();
  const today = todayIn(workspace.timezone), month = period(today), first = periodStart(month);
  const [accounts, uncategorized, overdue, incomeRules, expenseRules] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true, currency: true, lastReconciledAt: true } }),
    db.transaction.count({ where: { workspaceId: workspace.id, economicPeriod: month, type: { in: ["INCOME", "EXPENSE"] }, categoryId: null } }),
    db.obligation.count({ where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } } }),
    db.recurringRule.count({ where: { workspaceId: workspace.id, direction: "RECEIVABLE", pausedAt: null, OR: [{ endDate: null }, { endDate: { gt: today } }] } }),
    db.recurringRule.count({ where: { workspaceId: workspace.id, direction: "PAYABLE", pausedAt: null, OR: [{ endDate: null }, { endDate: { gt: today } }] } }),
  ]);
  const checked = accounts.filter((a) => a.lastReconciledAt && a.lastReconciledAt >= first).length;
  const readyChecks = Number(accounts.length > 0 && checked === accounts.length) + Number(overdue === 0) + Number(uncategorized === 0);
  const next = reviewNextStep({ accountCount: accounts.length, uncheckedId: accounts.find(a => !a.lastReconciledAt || a.lastReconciledAt < first)?.id, overdue, uncategorized, month });
  return <div className="narrow wide month-review">
    <PageHead crumb="Mi dinero" title="Revisión del mes" desc={`${fmtPeriod(month)}: comprobá lo que cargaste antes de decidir cuánto podés gastar.`} actions={<Link className="btn" href="/app">Volver al inicio</Link>} />
    <div className="notice">La revisión no mueve dinero ni cierra tus registros. Podés corregirlos cuando quieras. Los pendientes solo se dan por pagados o cobrados cuando lo confirmás.</div>
    <p className="sub">{readyChecks} de 3 controles automáticos al día: saldos revisados, sin atrasos y categorías completas. Revisá también tus ingresos y gastos futuros en el paso 4.</p>
    <div className="review-outcome card"><h2>Tu próximo paso</h2><p>{!accounts.length ? "Agregá tu primera cuenta para empezar." : checked < accounts.length ? `Te falta revisar ${accounts.length-checked} ${accounts.length-checked === 1 ? "saldo" : "saldos"}.` : overdue > 0 ? "Revisá los pendientes con fecha pasada: confirmá solo los que ocurrieron." : uncategorized > 0 ? "Completá las categorías para que tus presupuestos representen mejor tus gastos." : "Los tres controles automáticos están al día. Falta tu revisión de los ingresos y gastos futuros; esto no garantiza que hayas cargado todo."}</p><div className="acts"><Link className="btn pri" href={next.href}>{next.label}</Link><Link className="lnk" href="/app/resumen">Ver resumen del mes</Link></div></div>
    <div className="grid g2">
      <section className="card"><div className="chead"><h2 style={{ fontSize: 19 }}>1. Compará tus saldos</h2><span className="pill">{checked} de {accounts.length}</span></div>
        <p className="sub">Revisá cada saldo contra el banco, la billetera o tu efectivo. Un ajuste corrige el registro; no hace una transferencia real.</p>
        <div className="list">{accounts.map((a) => <Link className="li" key={a.id} href={`/app/cuentas/${a.id}`}><div className="grow"><b>{a.name} · {a.currency}</b><div className="sub">{a.lastReconciledAt ? `Última conciliación: ${fmtDate(a.lastReconciledAt)}` : "Todavía no conciliaste esta cuenta"}</div></div><span className={`review-account-action ${a.lastReconciledAt && a.lastReconciledAt >= first ? "is-reviewed" : "is-pending"}`}>{a.lastReconciledAt && a.lastReconciledAt >= first ? "Revisada este mes" : "Revisar"}</span></Link>)}</div>
        {!accounts.length && <Link className="btn pri" href="/app/cuentas?nueva=1">Agregar una cuenta</Link>}
      </section>
      <section className="card"><h2 style={{ fontSize: 19 }}>2. Revisá los pendientes</h2><p>{overdue ? `${overdue} pagos o cobros tienen fecha pasada y siguen pendientes.` : "No hay pagos ni cobros atrasados registrados."}</p><p className="sub">Si ya ocurrieron, confirmalos. Si cambió la fecha o el importe, corregilos. No los borres para hacer desaparecer una diferencia.</p><Link className="btn" href="/app/proximos">Revisar próximos pagos</Link></section>
      <section className="card"><h2 style={{ fontSize: 19 }}>3. Completá las categorías</h2><p>{uncategorized ? `${uncategorized} ${uncategorized === 1 ? "movimiento del mes está" : "movimientos del mes están"} sin categoría.` : "Los ingresos y gastos del mes tienen categoría."}</p><p className="sub">Clasificarlos ayuda a entender los informes y el presupuesto.</p><Link className="btn" href={`/app/movimientos?mes=${month}`}>Revisar movimientos</Link></section>
      <section className="card"><h2 style={{ fontSize: 19 }}>4. Prepará lo que viene</h2><p>{incomeRules} {incomeRules === 1 ? "ingreso" : "ingresos"} y {expenseRules} {expenseRules === 1 ? "gasto" : "gastos"} que se repiten.</p><p className="sub">Revisá fechas, importes y cuándo terminan. Si tus ingresos son variables, cargá estimaciones y corregilas al cobrar. Un dato que falta cambia la proyección.</p><div className="acts"><Link className="btn" href="/app/recurrentes">Revisar recurrentes</Link><Link className="btn pri" href="/app/flujo">Ver la proyección</Link></div></section>
    </div>
  </div>;
}

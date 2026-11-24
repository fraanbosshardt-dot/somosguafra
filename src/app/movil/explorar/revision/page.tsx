import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fmtDate, fmtPeriod, period, periodStart, todayIn } from "@/lib/dates";
import { MvBackHead } from "../../head";
import { MvIcon } from "../../ui";

export const metadata: Metadata = { title: "Revisión del mes" };

// Cuatro pasos para cerrar el mes: saldos, pendientes, categorías y lo que viene.
export default async function RevisionMovil() {
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone), month = period(today), first = periodStart(month);
  const [accounts, uncategorized, overdue, incomeRules, expenseRules] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true, currency: true, lastReconciledAt: true } }),
    db.transaction.count({ where: { workspaceId: workspace.id, economicPeriod: month, type: { in: ["INCOME", "EXPENSE"] }, categoryId: null } }),
    db.obligation.count({ where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } } }),
    db.recurringRule.count({ where: { workspaceId: workspace.id, direction: "RECEIVABLE", pausedAt: null } }),
    db.recurringRule.count({ where: { workspaceId: workspace.id, direction: "PAYABLE", pausedAt: null } }),
  ]);
  const checked = accounts.filter((a) => a.lastReconciledAt && a.lastReconciledAt >= first).length;
  const done = [accounts.length > 0 && checked === accounts.length, overdue === 0, uncategorized === 0, incomeRules + expenseRules > 0];
  const steps: { title: string; text: string; href: string; cta: string }[] = [
    { title: "Compara tus saldos", text: `${checked} de ${accounts.length} cuentas revisadas este mes. Un ajuste corrige el registro; no mueve dinero.`, href: "/movil/explorar/cuentas", cta: "Ver cuentas" },
    { title: "Revisa los pendientes", text: overdue ? `${overdue} pagos o cobros tienen fecha pasada y siguen pendientes.` : "No hay pagos ni cobros atrasados.", href: "/movil/proximos", cta: "Revisar próximos" },
    { title: "Completa las categorías", text: uncategorized ? `${uncategorized} ${uncategorized === 1 ? "movimiento del mes está" : "movimientos del mes están"} sin categoría.` : "Los movimientos del mes tienen categoría.", href: "/movil/movimientos", cta: "Revisar movimientos" },
    { title: "Prepara lo que viene", text: `${incomeRules} ingresos y ${expenseRules} gastos que se repiten. Revisa fechas y montos.`, href: "/movil/explorar/recurrentes", cta: "Revisar recurrentes" },
  ];
  const n = done.filter(Boolean).length;

  return (
    <main className="mv-main">
      <MvBackHead href="/movil/explorar" sub="Mi dinero" title="Revisión del mes" />
      <section className="mv-card" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>{fmtPeriod(month)}</div>
        <b style={{ fontSize: 22 }}>{n === 4 ? "Todo listo este mes" : `${n} de 4 pasos hechos`}</b>
        <span style={{ display: "block", height: 8, borderRadius: 99, background: "#EDF0ED", overflow: "hidden" }}><i className="mv-grow-x" style={{ display: "block", height: "100%", width: `${Math.max(3, n * 25)}%`, background: "var(--brand)" }} /></span>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", fontWeight: 600 }}>La revisión no mueve dinero ni cierra tus registros. Puedes corregir cuando quieras.</p>
      </section>
      <div className="mv-cas" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {steps.map((s, i) => (
          <section key={s.title} className="mv-card" style={{ display: "flex", gap: 12 }}>
            <span className="mv-date" style={done[i] ? { background: "var(--mint)", color: "var(--brand)" } : undefined}>{done[i] ? <MvIcon name="check" stroke={2.6} /> : <b style={{ fontSize: 16 }}>{i + 1}</b>}</span>
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <b style={{ fontSize: 15 }}>{s.title}</b>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{s.text}</span>
              {i === 0 && accounts.length > 0 && (
                <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {accounts.map((a) => {
                    const ok = !!a.lastReconciledAt && a.lastReconciledAt >= first;
                    return <Link key={a.id} href={`/movil/explorar/cuentas/${a.id}`} style={{ fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between", gap: 8 }}><span>{a.name}</span><span style={{ color: ok ? "var(--pos)" : "var(--warn)" }}>{ok ? "Revisada" : a.lastReconciledAt ? `Última: ${fmtDate(a.lastReconciledAt)}` : "Revisar"}</span></Link>;
                  })}
                </span>
              )}
              <Link className="mv-link" href={s.href} style={{ minHeight: 32 }}>{s.cta}</Link>
            </span>
          </section>
        ))}
      </div>
    </main>
  );
}

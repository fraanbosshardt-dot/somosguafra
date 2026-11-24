import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { budgetFor } from "@/server/planning";
import { formatMoney, ZERO } from "@/lib/money";
import { addMonths, fmtPeriod, period, periodEnd, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { copyBudgetAction } from "@/app/actions/modules";
import { ActionForm, Submit } from "@/components/forms";
import { BudgetEditor } from "./budget-editor";
import { symbolOf } from "@/lib/countries";

export const metadata: Metadata = { title: "Presupuestos" };

export default async function Budgets({ searchParams }: { searchParams: Promise<{ mes?: string; copiado?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const canCarry = await canUse(plan, "informes");
  const sp = await searchParams;
  const p = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : period(todayIn(workspace.timezone));
  const cur = workspace.baseCurrency;
  const b = await budgetFor(getDb(), workspace.id, p, cur, todayIn(workspace.timezone));
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur);
  // "Te queda" mira solo las categorías con límite: lo que gastás en las demás no descuenta de un presupuesto que no pusiste.
  const limited = b.rows.filter((r) => r.limit);
  const sum = (f: (r: (typeof limited)[number]) => typeof b.totals.limit) => limited.reduce((s, r) => s.plus(f(r)), ZERO);
  const lim = sum((r) => r.limit!), spentLim = sum((r) => r.spent), commLim = sum((r) => r.committed.plus(r.scheduled));
  const left = lim.minus(spentLim).minus(commLim);
  const hasBudget = !!b.budget && lim.gt(0);
  // Promedio gastado por categoría en los 3 meses anteriores (para sugerir el límite).
  const db = getDb();
  const prev = [addMonths(p, -1), addMonths(p, -2), addMonths(p, -3)];
  const [txs, allCats] = await Promise.all([
    db.transaction.groupBy({ by: ["categoryId", "direction"], where: { workspaceId: workspace.id, currency: cur, type: "EXPENSE", economicPeriod: { in: prev } }, _sum: { amount: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, kind: "EXPENSE" }, select: { id: true, parentId: true } }),
  ]);
  const parentOf = new Map(allCats.map((c) => [c.id, c.parentId ?? c.id]));
  const avg = new Map<string, number>();
  for (const t of txs) { const k = parentOf.get(t.categoryId ?? "") ?? ""; const v = Number(t._sum.amount ?? 0) * (t.direction === "OUT" ? 1 : -1); avg.set(k, (avg.get(k) ?? 0) + v / 3); }
  const editor = (
      <div className="card">
        <details className="more" open={!hasBudget}>
          <summary>{hasBudget ? "Editar límites del mes" : "Crear presupuesto del mes"}</summary>
          <BudgetEditor key={`${p}:${b.budget?.id ?? "new"}`} period={p} symbol={symbolOf(cur)} hasBudget={hasBudget} ended={periodEnd(p) < todayIn(workspace.timezone)} cats={b.categories.map((c) => { const l = b.budget?.lines.find((x) => x.categoryId === c.id); return { id: c.id, name: c.name, avg: avg.get(c.id) ?? 0, used: (() => { const r = b.rows.find((r) => r.id === c.id); return r ? (r.spent.gt(0) ? r.spent : ZERO).plus(r.committed).plus(r.scheduled).toFixed(2) : "0"; })(), limit: l ? l.limitAmount.toFixed(2) : null, projectRemaining: l?.projectRemaining ?? false }; })} />
        </details>
      </div>
  );
  return (
    <>
      <PageHead crumb="Planificar" title="Presupuestos" desc="Controlá tus gastos por categoría, sin confundir el límite con lo gastado." toolbar={<nav className="budget-period" aria-label="Mes del presupuesto"><Link className="btn" href={`/app/presupuestos?mes=${addMonths(p, -1)}`} aria-label="Mes anterior">‹</Link><strong>{fmtPeriod(p)}</strong><Link className="btn" href={`/app/presupuestos?mes=${addMonths(p, 1)}`} aria-label="Mes siguiente">›</Link></nav>} />
      {sp.copiado === "1" && <p className="notice g" role="status">Presupuesto copiado. Se conservaron los límites y las opciones, sin copiar gastos.</p>}
      {hasBudget ? (
        <>
          <div className="card bdg-stats"><Stat label="Límite del mes" value={fm(lim)} /><Stat label="Gastado" value={fm(spentLim)} /><Stat label="Previsto" value={fm(commLim)} /><Stat label={left.isNegative() ? "Exceso entre gastado y previsto" : "Margen del presupuesto"} value={fm(left.abs())} tone={left.isNegative() ? "neg" : "pos"} /></div>
          <p className="sub">«Previsto» incluye lo que falta pagar y lo programado por categoría. El margen es lo que queda de tus límites, no el saldo de tus cuentas.</p>
          {editor}
          {/* Una tarjeta por categoría con límite: cuánto queda, la barra y lo gastado */}
          <div className="bdg-grid">{limited.map((r) => {
            const pct = r.spent.dividedBy(r.limit!).times(100).toNumber();
            const comm = Math.max(0, Math.min(100 - Math.max(0, pct), r.committed.plus(r.scheduled).dividedBy(r.limit!).times(100).toNumber()));
            const over = r.spent.gt(r.limit!), plannedOver = !over && r.available!.lt(0), near = !over && (r.pct ?? 0) >= 80;
            return (
              <div className={`bdg ${over ? "over" : near ? "near" : ""}`} key={r.id}>
                <div className="bdg-top">
                  <b className="bdg-name">{r.name}</b>
                  <div className="bdg-left"><b className={`num ${r.available!.isNegative() ? "neg" : ""}`}>{fm(r.available!.abs())}</b><span>{r.available!.isNegative() ? "sobre el límite" : "de margen"}</span></div>
                </div>
                <div className="bdg-bar" role="img" aria-label={`${Math.round(pct)}% gastado y ${Math.round(r.committed.plus(r.scheduled).dividedBy(r.limit!).times(100).toNumber())}% previsto del límite`}><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /><i className="c" style={{ width: `${comm}%` }} /></div>
                <dl className="budget-breakdown">
                  <div><dt>Límite del mes</dt><dd>{fm(r.limit!)}</dd></div>
                  <div><dt>Gastado</dt><dd>{fm(r.spent)}</dd></div>
                  <div><dt>Previsto</dt><dd>{fm(r.committed.plus(r.scheduled))}</dd></div>
                </dl>
                <p className={`sub budget-status ${over || plannedOver ? "neg" : ""}`}>{over ? "Ya superaste el límite con tus gastos." : plannedOver ? "Vas a superar el límite con lo previsto." : `${Math.round(pct)}% gastado${near ? " · Poco margen restante" : ""}`}</p>
                <div className="acts"><Link className="btn sm" href={`/app/presupuestos/detalle?mes=${p}&categoria=${r.id}&ver=gastos`}>Ver gastos</Link><Link className="btn sm" href={`/app/presupuestos/detalle?mes=${p}&categoria=${r.id}&ver=previstos`}>Ver previstos</Link></div>
                {r.projectRemaining && <p className="sub budget-estimate"><span className="pill">Estimación</span> {periodEnd(p) < todayIn(workspace.timezone) ? "Mes finalizado: no agrega salidas futuras." : `${fm(r.estimate)} adicionales en el flujo al finalizar este mes.`}</p>}
              </div>
            );
          })}</div>
          {b.rows.some((r) => !r.limit && r.spent.gt(0)) && (
            <div className="card">
              <div className="chead"><div><h3>Sin límite</h3><p className="sub">Lo que gastaste en categorías que no controlás. No descuenta del presupuesto.</p></div></div>
              <div className="list">{b.rows.filter((r) => !r.limit && r.spent.gt(0)).map((r) => (
                <div className="li" key={r.id}><div className="grow"><div className="t">{r.name}</div></div><span className="num">{fm(r.spent)}</span></div>
              ))}</div>
            </div>
          )}
        </>
      ) : (
        <>{editor}<p className="sub">Ya registraste {fm(b.totals.spent)} en gastos este mes. Crear límites te permite seguirlos por categoría; no vuelve a registrar esas compras.</p></>
      )}
      <details className="card more budget-options"><summary>Opciones del mes</summary><div className="product-form">
        <div><b>Copiar límites del mes anterior</b><p className="sub">Conserva los límites y sus opciones, sin copiar gastos. Solo si este mes todavía no tiene límites.</p><ActionForm action={copyBudgetAction}><input type="hidden" name="from" value={addMonths(p, -1)} /><input type="hidden" name="to" value={p} /><Submit className="btn" disabled={hasBudget} pending="Copiando…">Copiar límites</Submit></ActionForm></div>
        <div><b>Copiar y sumar margen {!canCarry && <span className="pill">Pro</span>}</b><p className="sub">Revisá cuánto margen positivo del mes terminado se sumaría al límite siguiente. No mueve dinero ni se repite automáticamente.</p><Link className="btn" href={`/app/presupuestos/trasladar?desde=${addMonths(p,-1)}`}>{canCarry ? "Revisar antes de copiar" : "Conocer esta opción Pro"}</Link></div>
      </div></details>
      <details className="card more"><summary>Cómo se calcula y cómo usarlo con tarjetas</summary><p className="sub">El límite menos lo gastado y lo previsto da el margen. Una compra pendiente pasa de previsto a gastado al pagarla: no se descuenta dos veces. La proyección agrega solo el margen estimado al flujo y no mueve dinero.</p><p className="sub">Si cargás la tarjeta solo por el total del resumen, no se puede conocer cuánto corresponde a cada categoría. Para que esos consumos descuenten de su presupuesto, usá el detalle de compras por categoría. Las compras en cuotas consumen el presupuesto por el total en el mes de compra; las cuotas siguen sus vencimientos en el flujo.</p><p className="sub">En Inicio, el disponible hasta tu próximo cobro descuenta pagos cargados; no incluye todo el presupuesto pendiente de gastar. Para anticiparlo, consultá Flujo de caja con estimaciones.</p></details>

    </>
  );
}

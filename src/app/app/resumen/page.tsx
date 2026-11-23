import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { categoryReport } from "@/server/io";
import { formatMoney } from "@/lib/money";
import { validPeriod, period, todayIn, fmtPeriod } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
export const metadata = { title: "Resumen del mes" };
export default async function MonthlySummary({ searchParams }: { searchParams: Promise<{ mes?: string; moneda?: string }> }) {
  const { workspace } = await requireWorkspace(), sp = await searchParams, db = getDb();
  const month = validPeriod(sp.mes) ? sp.mes! : period(todayIn(workspace.timezone));
  const accounts = await db.account.findMany({ where: { workspaceId: workspace.id }, select: { currency: true }, distinct: ["currency"] });
  const currencies = [...new Set([workspace.baseCurrency, ...accounts.map(a => a.currency)])];
  const cur = currencies.includes(sp.moneda ?? "") ? sp.moneda! : workspace.baseCurrency;
  const report = await categoryReport(db, workspace.id, cur, month, 1), totals = report.totals[0];
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, cur);
  return <>
    <PageHead crumb="Mi dinero" title="Resumen del mes" desc={`${fmtPeriod(month)} · ${cur}. Una lectura sencilla de lo registrado.`} actions={<Link className="btn" href="/app/revision">Revisar mis datos</Link>} />
    <form className="product-filters card" method="get"><label className="field">Mes<input type="month" name="mes" defaultValue={month} /></label><label className="field">Moneda<select name="moneda" defaultValue={cur}>{currencies.map(c => <option key={c}>{c}</option>)}</select></label><button className="btn" type="submit">Ver resumen</button></form>
    <div className="card grid g3 monthly-totals"><Stat label="Ingresos registrados" value={fm(totals.income)} /><Stat label="Gastos registrados" value={fm(totals.expense)} /><Stat label="Diferencia del mes" value={fm(totals.income.minus(totals.expense))} /></div>
    <p className="sub">Se agrupa por el mes al que corresponde cada registro, aunque se haya pagado otro día. Los reintegros restan gastos y las transferencias entre tus cuentas no cuentan como ingresos o gastos. Las monedas se muestran por separado.</p>
    <section className="card product-section"><div className="chead"><h2>En qué se fue</h2><Link className="lnk" href={`/app/movimientos?mes=${month}`}>Ver movimientos</Link></div>
      {report.rows.length ? <div className="list">{report.rows.map(row => <div className="li" key={row.name}><span className="grow">{row.name}</span><b className="num">{fm(row.values[0])}</b></div>)}</div> : <p className="sub">No hay gastos registrados en esta moneda y mes. Podés empezar cargando una compra.</p>}
    </section>
    <p className="notice">La diferencia no es tu saldo bancario ni una proyección: no incluye lo que todavía no pagaste o cobraste. <Link className="lnk" href="/app/flujo">Ver lo que viene</Link></p>
    <div className="acts"><Link className="btn pri" href="/app/movimientos/nuevo">Cargar movimiento</Link><Link className="btn" href="/app/informes">Comparaciones e informes · Pro</Link></div>
  </>;
}

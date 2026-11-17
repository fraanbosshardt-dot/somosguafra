import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fmtDate, fmtPeriod, period, todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { budgetDetail } from "@/server/planning";
import { remaining } from "@/server/ledger";
import { PageHead, Stat, Tabs } from "@/components/page";

export const metadata: Metadata = { title: "Detalle del presupuesto" };

export default async function BudgetDetail({ searchParams }: { searchParams: Promise<{ mes?: string; categoria?: string; ver?: string; pagina?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams, today = todayIn(workspace.timezone);
  const p = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mes ?? "") ? sp.mes! : period(today);
  const view = sp.ver === "previstos" ? "previstos" : "gastos";
  const data = await budgetDetail(getDb(), workspace.id, p, workspace.baseCurrency, sp.categoria ?? "", view, Number(sp.pagina) || 1, today);
  if (!data) notFound();
  const { row, expenses, pending, count, page, pages } = data;
  const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, workspace.baseCurrency);
  const href = (ver: string, pagina = 1) => `/app/presupuestos/detalle?${new URLSearchParams({ mes: p, categoria: row.id, ver, pagina: String(pagina) })}`;
  return <>
    <PageHead crumb={`Presupuestos · ${fmtPeriod(p)}`} title={row.name} desc="Revisá los registros que componen este presupuesto." actions={<Link className="btn" href={`/app/presupuestos?mes=${p}`}>Volver a Presupuestos</Link>} />
    <div className="card bdg-stats"><Stat label="Límite del mes" value={fm(row.limit!)} /><Stat label="Gastado neto" value={fm(row.spent)} /><Stat label="Previsto" value={fm(row.committed.plus(row.scheduled))} /><Stat label={row.available!.lt(0) ? "Exceso previsto" : "Margen"} value={fm(row.available!)} /></div>
    <p className="sub">Incluye esta categoría y sus subcategorías, en {workspace.baseCurrency}, por mes del gasto. Puede diferir del mes en que se pagó. Los reintegros descuentan del gastado.</p>
    <Tabs current={view} items={[{ key: "gastos", label: "Gastos y reintegros", href: href("gastos") }, { key: "previstos", label: "Pendientes y programados", href: href("previstos") }]} />
    <div className="card">
      <h2>{view === "gastos" ? "Gastos y reintegros" : "Pendientes por pagar"}</h2>
      <p className="sub">{count} registros · Página {page} de {pages} · Hasta 50 por página</p>
      <div className="list">
        {expenses.map((t) => <Link className="li" href={`/app/movimientos/${t.id}`} key={t.id}><div className="grow"><b>{t.description}</b><div className="sub">{fmtDate(t.effectiveDate)} · {t.direction === "IN" ? "Reintegro / reversión" : "Gasto"}</div></div><span className="num">{t.direction === "IN" ? "−" : ""}{fm(t.amount)}</span></Link>)}
        {pending.map((o) => <Link className="li" href={`/app/proximos/${o.id}`} key={o.id}><div className="grow"><b>{o.description}</b><div className="sub">Vence {fmtDate(o.dueDate)} · Importe que falta pagar</div></div><span className="num">{fm(remaining(o))}</span></Link>)}
        {!count && <p className="sub">No hay {view === "gastos" ? "gastos ni reintegros" : "pagos pendientes"} para esta categoría y mes.</p>}
      </div>
      {pages > 1 && <nav className="acts" aria-label="Páginas del detalle">{page > 1 && <Link className="btn" href={href(view, page - 1)}>Anterior</Link>}{page < pages && <Link className="btn" href={href(view, page + 1)}>Siguiente</Link>}</nav>}
    </div>
    {view === "previstos" && <div className="card"><h2>Programados todavía sin cargar</h2><p className="sub">Recurrentes y suscripciones de tarjeta de este mes. Al registrarse, pasan a pendientes o gastos sin duplicarse. No incluye el margen estimado de compras nuevas.</p><div className="list">{row.scheduledItems.map((item, i) => <div className="li" key={`${item.date.toISOString()}:${i}`}><div className="grow"><b>{item.description}</b><div className="sub">{fmtDate(item.date)}</div></div><span className="num">{fm(item.amount)}</span></div>)}{!row.scheduledItems.length && <p className="sub">No hay importes programados adicionales.</p>}</div><div className="acts"><Link className="btn" href="/app/recurrentes">Ver recurrentes</Link><Link className="btn" href="/app/tarjetas">Ver tarjetas</Link></div></div>}
  </>;
}

import Link from "next/link";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { recurringCosts } from "@/server/recurring-costs";
import { todayIn } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHead } from "@/components/page";
import { ProGate } from "@/components/pro";
const FREQUENCY:Record<string,string>={DAILY:"Diario",WEEKLY:"Semanal",BIWEEKLY:"Cada 2 semanas",MONTHLY:"Mensual",BIMONTHLY:"Cada 2 meses",QUARTERLY:"Trimestral",SEMIANNUAL:"Semestral",ANNUAL:"Anual",CUSTOM:"Mensual personalizado"};
export const metadata = { title: "Costo de mis servicios" };
export default async function Costs() {
  const { workspace, plan } = await requireWorkspace();
  if (!await canUse(plan,"informes")) return <ProGate crumb="Planificar" title="Costo de mis servicios" text="Reuní gastos recurrentes y suscripciones de tarjeta y compará su equivalente anual, por moneda." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const data = await recurringCosts(getDb(),workspace.id,todayIn(workspace.timezone));
  return <><PageHead crumb="Planificar" title="Costo de mis servicios" desc="Los gastos activos que se repiten, reunidos en una sola vista." actions={<Link className="btn" href="/app/recurrentes">Editar recurrentes</Link>} />
    <p className="notice">Equivalente anual orientativo: supone que el importe actual se repite todo un año. No considera aumentos, fechas de fin, inflación ni cambios de moneda. Para el calendario real, usá Flujo de caja.</p>
    <div className="grid g3">{data.totals.map(t => <div className="card" key={t.currency}><div className="lbl">Equivalente anual · {t.currency}</div><b className="num" style={{fontSize:24}}>{formatMoney(t.annual,t.currency)}</b></div>)}</div>
    <section className="card product-section"><h2>Revisá qué querés mantener</h2><div className="list">{data.rows.map(r => <div className="li" key={r.id}><div className="grow"><b>{r.name}</b><div className="s">{r.source} · {formatMoney(r.amount,r.currency)} por ocurrencia · {FREQUENCY[r.frequency]}{r.interval>1?` · cada ${r.interval} períodos`:""}{r.variable?" · importe variable":""}</div></div><div><b className="num">{formatMoney(r.annual,r.currency)}</b><div className="s">equivalente por año</div></div><Link className="btn sm" href={r.href}>Revisar</Link></div>)}</div>{!data.rows.length && <p className="sub">Todavía no hay gastos recurrentes activos o suscripciones de tarjeta.</p>}</section>
    <p className="sub">Si cargaste el mismo servicio como recurrente y como suscripción de tarjeta, revisalo para no duplicarlo. Editar o terminar un registro acá no cancela el servicio contratado con su empresa.</p>
  </>;
}

import { AdminSections } from "@/components/admin-sections";
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { planSettings } from "@/server/plans";
import { retention, byCountry, funnel, monthlyCosts, overview, revenueByMonth, signupMethods, signupsByDay } from "@/server/admin-metrics";
import { countryByCode } from "@/lib/countries";
import { can } from "@/server/admin-team";
import { PageHead } from "@/components/page";
import { Bars, HBars, Stats, ars, int, pct } from "@/components/admin-ui";

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ sinpermiso?: string }> }) {
  const admin = await requireAdmin();
  if(!can(admin.role,"operations"))redirect("/admin/soporte");
  const { sinpermiso } = await searchParams;
  const db = getDb();
  const settings = await planSettings(db);
  const [o, days, rev, fun, countries, methods, costs, cohorts] = await Promise.all([
    overview(db, settings.pricesArs ?? { monthly: 0, yearly: 0 }), signupsByDay(db, 30), revenueByMonth(db, 6), funnel(db), byCountry(db), signupMethods(db, 30), monthlyCosts(db), retention(db),
  ]);
  const thisMonth = rev[rev.length - 1]?.n ?? 0;
  return (
    <>
<PageHead title="Resumen" desc="Cómo viene Somos Guafra: clientes, uso, plata y lo que espera respuesta." />
{o.unverifiable > 0 && <p className="notice a">{o.unverifiable} espacios tienen cobertura histórica sin un pago conciliado. No se cuentan como pagadores confirmados.</p>}
{sinpermiso && <p className="notice a">Tu rol no tiene acceso a esa sección.</p>}
<Stats items={[
        ["Clientes", int(o.users), `+${int(o.newWeek)} en 7 días`],
        ["Activos en 24 horas", int(o.dau), `${int(o.mau)} en 30 días`],
        ["Pagan Pro", int(o.paid), `${pct(o.conversion)} del total`],
        ["Pro regalado", int(o.gifted), `${int(o.trials)} en prueba`],
        ["Ingreso recurrente mensual", o.mrrUnknown ? "Por conciliar" : ars(o.mrr), "MRR según importes contratados"],
        ["Pérdida de pagadores (30 días)", o.churn === null ? "No aplica" : pct(o.churn), o.startingPaid ? `${o.lostPaid} de ${o.startingPaid} pagadores iniciales` : "Sin clientes pagos en la base"],
        ["Renovación desactivada", o.renewalOff, "con cobertura paga vigente"],
        ["Intentos pendientes", o.pending, "sin confundirlos con bajas"],
      ]} />
<AdminSections items={[{id:"evolucion",columns:2,label:"Evolución",content:<><div className="card">
          <div className="chead"><h3>Altas por día</h3><span className="sub">Últimos 30 días · {int(days.reduce((t, d) => t + d.n, 0))} en total</span></div>
          <Bars label="Cuentas nuevas por día" data={days.map((d) => ({ key: d.key, n: d.n, tick: `${Number(d.key.slice(8))} ${MES[Number(d.key.slice(5, 7)) - 1]}` }))} />
          <p className="adm-hint" style={{ marginTop: 10 }}>Últimos 30 días: {int(methods.google)} con Google y {int(methods.email)} con correo.</p>
        </div>
<div className="card">
          <div className="chead"><h3>Cobrado por mes</h3><span className="sub">En pesos · cobros confirmados</span></div>
          <Bars label="Cobrado por mes en pesos" format={ars} data={rev.map((r) => ({ key: r.key, n: r.n, tick: `${MES[Number(r.key.slice(5, 7)) - 1]} ${r.key.slice(2, 4)}` }))} />
          {can(admin.role, "owner") && <p className="adm-hint" style={{ marginTop: 10 }}>Este mes: {ars(thisMonth)} cobrados contra {ars(costs.total)} de gastos. <Link className="lnk" href="/admin/finanzas">Ver finanzas</Link></p>}
        </div></>},
{id:"clientes",columns:2,label:"Activación y retención",content:<><div className="card">
          <div className="chead"><h3>Activación</h3><span className="sub">Cuentas titulares · D7 se mide desde esta versión</span></div>
          <HBars rows={fun} base={fun[0].n || 1} />
        </div>
<div className="card"><div className="chead"><h3>Retención de clientes</h3><span className="sub">Días completos · Argentina · medición desde esta versión</span></div><div className="tw" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table><thead><tr><th>Ventana</th><th>Cuentas medibles</th><th>Volvieron ese día</th><th>Retención</th></tr></thead><tbody>{cohorts.map(c => <tr key={c.days}><td>D{c.days}</td><td>{c.eligible}</td><td>{c.returned}</td><td>{c.rate === null ? "Todavía no aplica" : pct(c.rate)}</td></tr>)}</tbody></table></div></div></>},
{id:"distribucion",label:"Distribución",content:<><div className="card">
          <div className="chead"><h3>Clientes por país</h3></div>
          <HBars rows={countries.map((c) => ({ label: c.key === "OTROS" ? "Otros" : countryByCode(c.key).name, n: c.n }))} />
        </div></>},
{id:"atencion",label:"Atención y privacidad",content:<><div className="grid g2">
        <div className="card"><div className="chead"><h3>Soporte</h3><Link className="lk" href="/admin/soporte">Ver</Link></div><p className="sub" style={{ fontSize: 14 }}>{o.openTickets ? `${o.openTickets} ${o.openTickets === 1 ? "consulta espera" : "consultas esperan"} respuesta.` : "No hay consultas sin responder."}</p></div>
        <div className="card"><div className="chead"><h3>Privacidad</h3></div><p className="sub" style={{ fontSize: 14 }}>El panel muestra solo cantidades y totales del negocio. Nunca los montos ni los gastos de un cliente.</p></div>
      </div></>}]}/>
</>
  );
}

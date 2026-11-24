import { AdminSections } from "@/components/admin-sections";
import { checkoutFollowup } from "@/lib/checkout-followup";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { can } from "@/server/admin-team";
import { billingConfig } from "@/server/billing";
import { fmtDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { Stats, int } from "@/components/admin-ui";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Pagination } from "@/components/pagination";
import { pageNumber } from "@/lib/pagination";
import { paymentLabel, subscriptionLabel } from "@/lib/payment-labels";
import { adminBillingReport, BILLING_PAGE_SIZE } from "@/server/admin-billing-report";
import { adminCancelSubAction, adminCreateCouponAction, adminToggleCouponAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Cobros y cupones" };

export default async function Billing({ searchParams }: { searchParams: Promise<{ pagoerror?: string; suscripciones?: string; pagos?: string; intentos?: string; estado?: string }> }) {
  const { pagoerror, suscripciones, pagos, intentos, estado } = await searchParams;
  const subPage = pageNumber(suscripciones), paymentPage = pageNumber(pagos);
  const admin = await requireAdmin("operations");
  const owner = can(admin.role, "owner");
  const db = getDb();
  const attemptPage = pageNumber(intentos), cutoff = new Date(Date.now() - 24 * 3600_000);
  const attemptWhere = estado === "incomplete" ? { status: "pending", createdAt: { lte: cutoff } } : estado === "pending" ? { status: "pending", createdAt: { gt: cutoff } } : estado === "review" ? { status: { in: ["creating", "uncertain", "paused"] } } : estado === "converted" ? { status: "authorized" } : estado === "closed" ? { status: { in: ["cancelled", "superseded"] } } : {};
  const [attempts, attemptTotal] = await Promise.all([
    db.billingAgreement.findMany({ where: attemptWhere, include: { workspace: { include: { members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { id: true, email: true } } } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: BILLING_PAGE_SIZE, skip: (attemptPage - 1) * BILLING_PAGE_SIZE }),
    db.billingAgreement.count({ where: attemptWhere }),
  ]);
  const [report, coupons] = await Promise.all([adminBillingReport(db, subPage, paymentPage), db.coupon.findMany({ orderBy: { createdAt: "desc" } })]);
  const { subs, invoices, subTotal, invoiceTotal, active, pastDue, renewing, rejected } = report;
  const bill = await billingConfig(db);
  const href = (s: number, p: number) => `/admin/cobros?suscripciones=${s}&pagos=${p}`;
  const who = (w: { members: { user: { id: string; name?: string; email: string } }[] }) => w.members[0]?.user;
  return (
    <>
{pagoerror && <p className="notice r" role="alert">{pagoerror.slice(0, 300)}</p>}
<PageHead title="Cobros y cupones" desc="Suscripciones de Mercado Pago, pagos y descuentos." actions={owner ? <a className="btn" href="/admin/export/pagos">Descargar pagos (Excel)</a> : undefined} />
{!bill.enabled && <p className="notice a">Los cobros con Mercado Pago todavía no están activados: faltan MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET en Vercel, o el precio de Pro en pesos en Ajustes. Mientras tanto, podés regalar Pro desde Clientes.</p>}
<Stats items={[["Suscripciones activas", int(active)], ["Con pago pendiente", int(pastDue)], ["Renuevan en 7 días", int(renewing)], ["Pagos rechazados", int(rejected), "últimos 30 días · todos los registros"]]} />
<AdminSections items={[{id:"suscripciones",label:"Suscripciones",content:<><div className="card">
        <div className="chead"><h3>Suscripciones</h3></div>
        {subs.length ? <div className="tw" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table>
          <thead><tr><th>Cliente</th><th>Ciclo</th><th>Estado</th><th>Cupón</th><th>Desde</th><th /></tr></thead>
          <tbody>{subs.map((s) => { const u = who(s.workspace); return (
            <tr key={s.id}>
              <td>{u ? <Link className="lnk" href={`/admin/usuarios/${u.id}`}>{u.email}</Link> : "—"}</td>
              <td>{s.billingCycle === "yearly" ? "Anual" : "Mensual"}</td>
              <td><span className={`pill ${s.status === "ACTIVE" ? "g" : s.status === "PAST_DUE" ? "r" : ""}`}>{subscriptionLabel(s.status)}</span></td>
              <td>{s.couponCode ?? "—"}</td>
              <td>{fmtDate(s.createdAt)}</td>
              <td>{owner && s.status !== "CANCELED" && <form action={adminCancelSubAction}><input type="hidden" name="workspaceId" value={s.workspaceId} /><ConfirmSubmit className="btn ghost sm" question={`¿Cancelar la renovación de ${u?.email ?? "esta cuenta"}? Se solicita la baja de futuros cobros a Mercado Pago. El acceso ya cubierto se conserva${s.currentPeriodEnd ? ` hasta el ${fmtDate(s.currentPeriodEnd)}` : ""}. No genera un reembolso.`} yes="Cancelar renovación">Cancelar renovación</ConfirmSubmit></form>}</td>
            </tr>); })}</tbody>
        </table></div> : <div className="empty">Todavía no hay suscripciones pagas.</div>}
        <Pagination page={subPage} size={BILLING_PAGE_SIZE} total={subTotal} href={p => href(p, paymentPage)} label="Páginas de suscripciones" />
      </div></>},
{id:"intentos",label:"Intentos de contratación",content:<div className="card">
  <div className="chead"><div><h3>Intentos de contratación</h3><p className="sub">Una solicitud sin completar no es una baja ni un ingreso. La antigüedad no cancela contratos en Mercado Pago.</p></div></div>
  <form method="get" action="/admin/cobros#panel-intentos" className="frow" style={{alignItems:"end",marginBottom:20}}><label className="field">Seguimiento<select name="estado" defaultValue={estado ?? ""}><option value="">Todos</option><option value="pending">Pendientes: menos de 24 h</option><option value="incomplete">Sin completar: desde 24 h</option><option value="review">Requieren verificación / pausados</option><option value="converted">Autorizados</option><option value="closed">Cerrados</option></select></label><button className="btn" type="submit">Filtrar intentos</button></form>
  {attempts.length ? <div className="tw" tabIndex={0} role="region" aria-label="Intentos de contratación"><table><thead><tr><th>Cliente</th><th>Solicitud</th><th>Seguimiento</th><th>Creada</th><th>Última conciliación</th></tr></thead><tbody>{attempts.map(a => { const u = who(a.workspace); return <tr key={a.id}><td>{u ? <Link className="lnk" href={`/admin/usuarios/${u.id}`}>{u.email}</Link> : "Sin titular"}</td><td>{a.cycle === "yearly" ? "Anual" : "Mensual"}<br />{formatMoney(a.amount,a.currency)}</td><td>{checkoutFollowup(a).label}{a.cancelReason && <div className="sub">{a.cancelReason}</div>}</td><td>{fmtDate(a.createdAt)}</td><td>{a.lastReconciledAt ? fmtDate(a.lastReconciledAt) : "Todavía sin conciliar"}</td></tr>; })}</tbody></table></div> : <div className="empty">No hay intentos con este filtro.</div>}
  <Pagination page={attemptPage} size={BILLING_PAGE_SIZE} total={attemptTotal} href={p => `/admin/cobros?intentos=${p}&estado=${encodeURIComponent(estado ?? "")}#panel-intentos`} label="Páginas de intentos" />
</div>},
{id:"pagos",label:"Pagos",content:<><div className="card">
        <div className="chead"><h3>Últimos pagos</h3><span className="sub">Las devoluciones se hacen desde Mercado Pago y se reflejan acá solas</span></div>
        {invoices.length ? <div className="tw" tabIndex={0} role="region" aria-label="Tabla con desplazamiento horizontal"><table>
          <thead><tr><th>Fecha</th><th>Cliente</th><th>Importe</th><th>Estado</th></tr></thead>
          <tbody>{invoices.map((i) => { const u = who(i.workspace); return (
            <tr key={i.id}><td>{fmtDate(i.paidAt ?? i.createdAt)}</td><td>{u ? <Link className="lnk" href={`/admin/usuarios/${u.id}`}>{u.email}</Link> : "—"}</td><td>{formatMoney(i.amount.toString(), i.currency)}</td>
              <td><span className={`pill ${i.status === "approved" ? "g" : ["rejected", "charged_back"].includes(i.status) ? "r" : ""}`}>{paymentLabel(i.status)}</span></td></tr>); })}</tbody>
        </table></div> : <div className="empty">Sin pagos todavía.</div>}
        <Pagination page={paymentPage} size={BILLING_PAGE_SIZE} total={invoiceTotal} href={p => `${href(subPage, p)}#panel-pagos`} label="Páginas de pagos" />
      </div></>},
{id:"cupones",label:"Cupones",content:<><div className="card">
        <div className="chead"><h3>Cupones de descuento</h3><span className="sub">El cliente lo escribe al pasar a Pro (Configuración → Plan)</span></div>
        {owner && (
          <ActionForm action={adminCreateCouponAction} className="frow" style={{ alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
            <label className="field" style={{ flex: "1 1 150px" }}>Código<input name="code" required placeholder="BIENVENIDA" style={{ textTransform: "uppercase" }} /></label>
            <label className="field" style={{ flex: "0 1 110px" }}>Descuento %<input name="percent" inputMode="numeric" required placeholder="20" /></label>
            <label className="field" style={{ flex: "0 1 120px" }}>Usos máximos<input name="maxUses" inputMode="numeric" placeholder="Sin límite" /></label>
            <label className="field" style={{ flex: "0 1 160px" }}>Vence<input name="until" type="date" /></label>
            <label className="field" style={{ flex: "1 1 160px" }}>Nota<input name="note" placeholder="Ej.: Instagram" /></label>
            <Submit>Crear cupón</Submit>
          </ActionForm>
        )}
        {coupons.length ? <div className="list">{coupons.map((c) => {
          const expired = c.expiresAt && c.expiresAt < new Date(), full = c.maxUses !== null && c.uses >= c.maxUses;
          return (
            <div className="li" key={c.id}>
              <div className="grow"><div className="t"><b style={{ fontWeight: 500 }}>{c.code}</b> · {c.percentOff}% menos</div><div className="s">{int(c.uses)}{c.maxUses !== null ? ` de ${int(c.maxUses)}` : ""} usos{c.expiresAt ? ` · vence ${fmtDate(c.expiresAt)}` : ""}{c.note ? ` · ${c.note}` : ""}</div></div>
              <span className={`pill ${c.active && !expired && !full ? "g" : ""}`}>{!c.active ? "Pausado" : expired ? "Vencido" : full ? "Agotado" : "Activo"}</span>
              {owner && <form action={adminToggleCouponAction}><input type="hidden" name="id" value={c.id} /><button className="btn ghost sm" type="submit">{c.active ? "Pausar" : "Reactivar"}</button></form>}
            </div>
          );
        })}</div> : <p className="adm-hint">No hay cupones.</p>}
      </div></>}]}/>
</>
  );
}

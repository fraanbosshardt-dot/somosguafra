import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { billingConfig } from "@/server/billing";
import { publicPlan } from "@/server/public-plan";
import { checkoutAction } from "@/app/actions/modules";
import { PageHead } from "@/components/page";
import { OnceButton } from "@/components/forms";
import { planDay } from "@/components/subscription-summary";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Contratar Pro" };
export default async function Purchase({ searchParams }: { searchParams: Promise<{ ciclo?: string }> }) {
  const { workspace, user } = await requireOwner();
  const { needsVerifiedEmail } = await import("@/server/email-verify");
  if (needsVerifiedEmail(user)) redirect("/confirmar-correo");
  const cycle = (await searchParams).ciclo === "anual" ? "yearly" : "monthly";
  const db = getDb();
  const [bill, sub, agreement] = await Promise.all([billingConfig(db), db.subscription.findUnique({ where: { workspaceId: workspace.id } }), db.billingAgreement.findFirst({ where: { workspaceId: workspace.id, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" } })]);
  const view = publicPlan(sub, true, new Date(), { agreement });
  if (!view.canChoosePlan && !(view.canResumeCheckout && agreement?.cycle === cycle) && !(cycle === "yearly" && view.canUpgradeAnnual)) redirect("/app/configuracion?tab=plan");
  const same = view.canResumeCheckout && agreement?.cycle === cycle;
  const replacing = view.canResumeCheckout && !same;
  const amount = same && agreement ? Number(agreement.amount) : cycle === "yearly" ? bill.yearly : bill.monthly;
  return <>
    <PageHead title="Tu próximo paso con Pro" desc="Revisá el importe y cuándo comienza antes de continuar." />
    <div className="card purchase-summary">
      <span className="pill g">Pro {cycle === "yearly" ? "anual" : "mensual"}</span>
      <h2>{formatMoney(String(amount), "ARS")} <small>por {cycle === "yearly" ? "año" : "mes"}</small></h2>
      {cycle === "yearly" && <p className="sub">Un pago por el año completo. Equivale a {formatMoney(String(Math.round(amount / 12)), "ARS")} por mes.</p>}
      <div className="purchase-dates"><div><span>Primer cobro</span><b>{view.purchaseStartsAt ? planDay(view.purchaseStartsAt, workspace.timezone) : "Al autorizar en Mercado Pago"}</b></div><div><span>Renovación</span><b>{cycle === "yearly" ? "Cada año" : "Cada mes"}</b></div></div>
      {view.freeUntil && <p className="notice">Conservás tu acceso gratuito hasta el {planDay(view.freeUntil, workspace.timezone)}. La fecha del primer cobro se confirma también en Mercado Pago.</p>}
      {view.canUpgradeAnnual && <p className="notice">El anual comienza al finalizar tu cobertura actual. Al autorizarlo se detiene la renovación mensual.</p>}
      <form action={checkoutAction} style={{ display: "grid", gap: 16 }}>
        <input type="hidden" name="cycle" value={cycle} />
        <input type="hidden" name="expectedAmount" value={amount.toFixed(2)} />
        {same && <input type="hidden" name="intent" value="resume" />}
        {replacing && <><input type="hidden" name="replacePendingId" value={agreement?.id} /><label className="check"><input type="checkbox" name="replaceConfirmed" value="yes" required /> Confirmo reemplazar mi solicitud sin completar por este ciclo. Mercado Pago puede enviar un aviso de cancelación de la solicitud anterior; mi acceso vigente se conserva.</label></>}
        <p className="sub">Se renueva por {formatMoney(String(amount), "ARS")} cada {cycle === "yearly" ? "año" : "mes"} hasta que canceles. Podés gestionar la baja desde Mi plan. Volver del checkout no confirma un pago por sí solo.</p>
        {bill.enabled ? <OnceButton className="btn pri" pending="Verificando y abriendo Mercado Pago…">Continuar a Mercado Pago</OnceButton> : <p className="notice a">Los cobros no están disponibles en este momento.</p>}
      </form>
      <div className="acts" style={{ marginTop: 20 }}><Link className="lnk" href={`/app/contratar?ciclo=${cycle === "yearly" ? "mensual" : "anual"}`}>Elegir {cycle === "yearly" ? "mensual" : "anual"}</Link><Link className="lnk" href="/app/configuracion?tab=plan">Volver a Mi plan</Link></div>
      <p className="plan-fine">Al continuar revisás las condiciones de contratación en Mercado Pago. <Link href="/terminos">Términos</Link> · <Link href="/reembolsos">Reembolsos</Link></p>
    </div>
  </>;
}

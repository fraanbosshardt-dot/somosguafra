import Link from "next/link";
import type { SubscriptionView } from "@/server/public-plan";
import { SubscriptionSummary, planDate } from "./subscription-summary";
import { checkoutAction, cancelPlanAction, startTrialAction } from "@/app/actions/modules";
import { OnceButton } from "./forms";
import { ConfirmSubmit } from "./confirm-submit";
import { PLAN_FEATURES } from "@/lib/modules";
import { formatMoney } from "@/lib/money";
import { Icon } from "./icons";
import { BillingRefresh } from "./billing-refresh";

type Bill = { enabled: boolean; monthly: number; yearly: number; currency: string };
export function PlanSubscriptionCard({ view, bill, timeZone, annual = false }: { view: SubscriptionView; bill: Bill; timeZone: string; annual?: boolean }) {
  const save = bill.monthly > 0 ? Math.max(0, Math.round((1 - bill.yearly / (12 * bill.monthly)) * 100)) : 0;
  const summary = <SubscriptionSummary view={view} timeZone={timeZone} />;
  const purchase = bill.enabled && view.canSubscribe;
  const days = view.freeUntil ? Math.max(1, Math.ceil((Date.parse(view.freeUntil) - Date.now()) / 864e5)) : 0;
  return <div className="card">
    <BillingRefresh waiting={view.billing === "pending"} />
    {purchase ? <div className="plan-up">
      <div className="plan-why">
        {summary}
        <h4>{view.freeUntil ? "Elegí cómo seguir con Pro" : "Pasate a Pro"}</h4>
        {days > 0 && <p className="plan-note">Te {days === 1 ? "queda 1 día" : `quedan ${days} días`} de acceso gratuito. Los conservás al suscribirte.</p>}
        <ul>{PLAN_FEATURES.filter(f => f.plan === "pro").slice(0, 5).map(f => <li key={f.name}><Icon name="check" />{f.name}</li>)}</ul>
      </div>
      <div className="plan-box" id="pagar-pro">
        <form action={checkoutAction} className="plan-buy">
          <div className="plan-cycle" role="radiogroup" aria-label="Cómo querés pagar">
            <label><input type="radio" name="cycle" value="monthly" defaultChecked={!annual} /><span>Por mes</span></label>
            <label><input type="radio" name="cycle" value="yearly" defaultChecked={annual} /><span>Por año{save > 0 && <em>−{save} %</em>}</span></label>
          </div>
          <div className="plan-price m"><b>{formatMoney(String(bill.monthly), bill.currency)}</b><span>ARS por mes</span></div>
          <div className="plan-price y"><b>{formatMoney(String(bill.yearly), bill.currency)}</b><span>ARS por año</span><small>Equivale a {formatMoney(String(Math.round(bill.yearly / 12)), bill.currency)} por mes</small></div>
          <OnceButton className="btn pri plan-cta" pending="Abriendo Mercado Pago…">Continuar en Mercado Pago</OnceButton>
        </form>
        {view.canStartTrial && <form action={startTrialAction}><OnceButton className="btn plan-trial" pending="Activando…">Probar 14 días gratis</OnceButton></form>}
        <p className="plan-fine">{view.purchaseStartsAt ? `El primer cobro se programa para el ${planDate(view.purchaseStartsAt, timeZone)}.` : "El primer cobro se procesa al autorizar la suscripción."} Después se renueva según el ciclo elegido hasta que lo canceles.</p>
      </div>
    </div> : <>{summary}<div className="plan-paid">
      {bill.enabled && view.canResumeCheckout && <form action={checkoutAction}><input type="hidden" name="intent" value="resume" /><OnceButton pending="Verificando…">Retomar solicitud {view.pendingCycle === "yearly" ? "anual" : "mensual"}</OnceButton></form>}
      {bill.enabled && view.canUpgradeAnnual && <form action={checkoutAction} className="plan-upg">
        <input type="hidden" name="cycle" value="yearly" />
        <div><b>Pasate al anual{save > 0 ? ` y ahorrá ${save} %` : ""}</b><p>{formatMoney(String(bill.yearly), bill.currency)} por año. {view.purchaseStartsAt ? `Empieza el ${planDate(view.purchaseStartsAt, timeZone)}, al terminar tu período actual.` : "Respeta tu período actual."} Al autorizarlo se detiene la renovación mensual.</p></div>
        <OnceButton pending="Abriendo Mercado Pago…">Pasar a anual</OnceButton>
      </form>}
      {view.canCancel && <form action={cancelPlanAction}><ConfirmSubmit className="btn" question={view.coverageUntil ? `¿Cancelar la suscripción y las solicitudes pendientes? Se detienen las renovaciones y conservás Pro hasta el ${planDate(view.coverageUntil, timeZone)}.` : "¿Cancelar la suscripción y las solicitudes pendientes? No se programarán nuevas renovaciones."} yes="Sí, cancelar">Cancelar suscripción</ConfirmSubmit></form>}
      {!bill.enabled && view.canSubscribe && <p className="sub">Los cobros no están disponibles en este momento. Volvé a intentar más tarde.</p>}
      {!bill.enabled && view.canStartTrial && <form action={startTrialAction}><OnceButton>Probar 14 días gratis</OnceButton></form>}
      {(view.paymentIssue || view.billing === "past_due" || view.billing === "pending") && <Link className="lnk" href="/contacto?area=pagos">Necesito ayuda con el pago</Link>}
    </div></>}
  </div>;
}

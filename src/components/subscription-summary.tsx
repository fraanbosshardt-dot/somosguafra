import type { SubscriptionView } from "@/server/public-plan";

export function planDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone, dateStyle: "long" }).format(new Date(value));
}
export function planDay(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone, day: "numeric", month: "long", year: "numeric" }).format(new Date(value));
}
export function SubscriptionSummary({ view, timeZone, compact = false }: { view: SubscriptionView; timeZone: string; compact?: boolean }) {
  const cycle = view.billingCycle === "yearly" ? "anual" : "mensual";
  const title = view.access === "trial" ? "Estás probando Pro" : view.access === "paid" ? "Tu plan Pro" : view.access === "granted" ? "Tenés Pro activado" : "Tu plan Gratis";
  // La landing comunica acceso y precio. El seguimiento operativo queda en Tu plan.
  if (compact) return <div className="subscription-summary">
    <b>{title}</b>
    {view.freeUntil ? <p>Pro gratis hasta el {planDay(view.freeUntil, timeZone)}.</p> : view.coverageUntil ? <p>Tenés Pro hasta el {planDay(view.coverageUntil, timeZone)}.</p> : null}
    {view.canceling ? <p>Estamos verificando la cancelación con Mercado Pago.</p> : (view.billing === "active" || view.billing === "scheduled") && view.nextChargeAt && <p>Próximo cobro {cycle}: {planDate(view.nextChargeAt, timeZone)}.</p>}
  </div>;
  return <div className="subscription-summary">
    {compact ? <b>{title}</b> : <h3>{title}</h3>}
    {view.freeUntil ? <p>Pro gratis hasta el {planDay(view.freeUntil, timeZone)}.</p> : view.coverageUntil ? <p>Tenés Pro hasta el {planDate(view.coverageUntil, timeZone)}.</p> : null}
    {view.canceling ? <p role="status"><b>Cancelación en verificación.</b> Registramos tu pedido y estamos confirmándolo con Mercado Pago. Todavía no podemos asegurar que se hayan detenido los cobros. No inicies otra suscripción; podés reintentar la baja o escribirnos desde Ayuda. El acceso ya cubierto se conserva.</p> : view.billing === "pending" ? <p><b>Solicitud {view.pendingCycle === "yearly" ? "anual" : view.pendingCycle === "monthly" ? "mensual" : "de suscripción"} pendiente.</b> {view.canResumeCheckout ? "Abrir el checkout no confirma una suscripción ni un pago. Podés salir y retomar la misma solicitud; cerrar la página no pide la baja." : "Estamos verificando la solicitud. No inicies otro pago."}</p> :
      view.billing === "scheduled" ? <p><b>Pro {cycle} programado.</b> {view.nextChargeAt ? `Primer cobro programado: ${planDate(view.nextChargeAt, timeZone)}.` : "La fecha del primer cobro se confirma en Mercado Pago."}</p> :
      view.billing === "active" ? <p><b>Suscripción {cycle} autorizada.</b> {view.nextChargeAt ? `Próximo cobro: ${planDate(view.nextChargeAt, timeZone)}.` : "Revisá la fecha del próximo cobro en Mercado Pago."} {view.plan === "FREE" && "Todavía no hay un período de acceso confirmado."}</p> :
      view.billing === "past_due" ? <p><b>La suscripción requiere revisión.</b> Verificá el medio de pago en Mercado Pago o consultanos desde Ayuda. No contrates otra suscripción para repetir el cobro.</p> :
      view.billing === "canceled" ? <p><b>Renovación cancelada.</b> No hay nuevos cobros programados. {view.coverageUntil ? "Al terminar tu acceso vigente, volvés a Gratis." : "Seguís con Gratis y conservás tus datos."}</p> :
      view.canSubscribe ? <p>{view.freeUntil ? "Todavía no contrataste una suscripción. Podés elegir mensual o anual; el cobro comienza al terminar tu período gratuito." : view.coverageUntil ? "Podés contratar mensual o anual para continuar cuando termine tu acceso actual." : "Podés contratar Pro mensual o anual."}</p> :
      view.access === "granted" ? <p>Tenés Pro sin una suscripción de cobro activa.</p> : null}
    {view.canChoosePlan && view.canDiscardCheckout && <p>Podés elegir mensual o anual. Antes de cambiar de ciclo te pedimos confirmar el reemplazo de la solicitud sin completar.</p>}
    {view.pendingAmount && <p>Importe de la solicitud: {new Intl.NumberFormat("es-AR", { style: "currency", currency: view.recurringCurrency }).format(Number(view.pendingAmount))} por {view.pendingCycle === "yearly" ? "año" : "mes"}.</p>}
    {view.recurringAmount && <p>Importe contratado: {new Intl.NumberFormat("es-AR", { style: "currency", currency: view.recurringCurrency }).format(Number(view.recurringAmount))} por {view.billingCycle === "yearly" ? "año" : "mes"}.</p>}
    {view.freeUntil && view.billing === "none" && <p>Si no contratás Pro, al terminar volvés a Gratis. Tus datos se conservan.</p>}
    {view.paymentIssue && <p>Hay un pago que requiere revisión. Consultá su estado en Tu plan antes de pagar de nuevo.</p>}
    {!view.owner && <p>La contratación y la baja las administra el dueño del espacio.</p>}
    {view.owner && (view.billing === "past_due" || view.paymentIssue) && <p>Para revisar el medio de pago, usá tu cuenta de Mercado Pago. <a className="lnk" href="https://www.mercadopago.com.ar/ayuda/" target="_blank" rel="noopener noreferrer">Abrir la ayuda oficial de Mercado Pago</a>. No ingreses datos de tarjeta en formularios de soporte.</p>}
  </div>;
}

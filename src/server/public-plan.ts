import { effectivePlan } from "./plans";

type Subscription = {
  plan: string; status: string; provider?: string | null; providerRef?: string | null;
  billingCycle?: string | null; trialEndsAt: Date | null; currentPeriodEnd?: Date | null;
  legacyPaidUntil?: Date | null; nextPaymentAt?: Date | null;
};
type Agreement = {
  status: string; cycle: string; providerRef?: string | null; checkoutUrl?: string | null;
  startsAt?: Date | null; amount?: { toString(): string } | string | number; currency?: string;
  cancelRequestedAt?: Date | null;
};
type Context = { agreement?: Agreement | null; lastPaymentStatus?: string | null };
const cycleOf = (value?: string | null) => value === "monthly" || value === "yearly" ? value : null;
const future = (date: Date | null | undefined, now: Date) => date && date > now ? date : null;

// Acceso gratuito/pagado y contrato de cobro son dimensiones distintas.
// Una autorización de Mercado Pago no elimina el período gratuito restante.
export function publicPlan(sub: Subscription | null, owner: boolean, now = new Date(), context: Context = {}) {
  const plan = effectivePlan(sub, now);
  const freeUntil = future(sub?.trialEndsAt, now);
  const coverageUntil = [freeUntil, future(sub?.currentPeriodEnd, now), future(sub?.legacyPaidUntil, now)]
    .reduce<Date | null>((last, date) => date && (!last || date > last) ? date : last, null);
  const agreement = context.agreement;
  const canceling = !!agreement?.cancelRequestedAt;
  const pending = !!agreement && ["creating", "uncertain", "pending"].includes(agreement.status);
  const contract = !!(sub?.provider === "mercadopago" && sub.providerRef && ["ACTIVE", "PAST_DUE"].includes(sub.status)) || !!(agreement?.providerRef && ["authorized", "paused"].includes(agreement.status));
  const billingCycle = cycleOf(contract ? sub?.billingCycle ?? agreement?.cycle : sub?.provider === "mercadopago" ? sub.billingCycle : null);
  const paid = plan === "PRO" && sub?.provider === "mercadopago" && !!sub.currentPeriodEnd && sub.currentPeriodEnd > now && (!freeUntil || sub.currentPeriodEnd > freeUntil);
  const access = plan !== "PRO" ? "free" : freeUntil ? "trial" : paid ? "paid" : "granted";
  const permanentGrant = access === "granted" && sub?.provider !== "mercadopago" && !sub?.trialEndsAt && !sub?.currentPeriodEnd;
  const startsAt = future(agreement?.startsAt, now) ?? freeUntil;
  const paused = sub?.status === "PAST_DUE" || agreement?.status === "paused" || context.lastPaymentStatus === "rejected";
  const billing = pending ? "pending" : contract ? paused ? "past_due" : startsAt ? "scheduled" : "active" : sub?.status === "CANCELED" ? "canceled" : "none";
  const canSubscribe = owner && !canceling && !contract && !pending && !permanentGrant;
  const canUpgradeAnnual = owner && !canceling && contract && !pending && !paused && billingCycle === "monthly" && plan === "PRO" && !!coverageUntil;
  const canResumeCheckout = owner && !canceling && pending && agreement?.status === "pending" && !!agreement.providerRef && !!agreement.checkoutUrl;
  const canChoosePlan = !canceling && (canSubscribe || (canResumeCheckout && !contract && !permanentGrant));
  const canCancel = owner && contract && !(pending && !agreement?.providerRef);
  const canDiscardCheckout = owner && pending && agreement?.status === "pending" && !!agreement.providerRef && agreement.providerRef !== sub?.providerRef;
  const paymentIssue = ["rejected", "refunded", "charged_back", "cancelled"].includes(context.lastPaymentStatus ?? "");
  const nextChargeAt = contract ? future(sub?.nextPaymentAt, now) ?? startsAt : null;
  return {
    plan, access, billing, owner, paid, billingCycle, canceling, canSubscribe, canChoosePlan, canUpgradeAnnual, canResumeCheckout, canCancel, canDiscardCheckout,
    canStartTrial: owner && canSubscribe && plan === "FREE" && sub?.plan === "FREE" && !sub.trialEndsAt && sub.provider !== "mercadopago",
    trial: freeUntil?.toISOString().slice(0, 10) ?? null,
    freeUntil: freeUntil?.toISOString() ?? null, coverageUntil: coverageUntil?.toISOString() ?? null,
    purchaseStartsAt: coverageUntil?.toISOString() ?? null, nextChargeAt: nextChargeAt?.toISOString() ?? null,
    pendingCycle: pending ? cycleOf(agreement?.cycle) : null,
    pendingAmount: pending && agreement?.amount != null && Number(agreement.amount) > 0 ? String(agreement.amount) : null, paymentIssue,
    recurringAmount: contract && !pending && agreement?.providerRef === sub?.providerRef && agreement?.amount != null && Number(agreement.amount) > 0 ? String(agreement.amount) : null,
    recurringCurrency: agreement?.currency ?? "ARS",
  };
}
export type SubscriptionView = ReturnType<typeof publicPlan>;

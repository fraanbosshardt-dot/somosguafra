import { effectivePlan } from "./plans";

type Subscription = {
  plan: string; status: string; provider?: string | null; providerRef?: string | null;
  billingCycle?: string | null; trialEndsAt: Date | null; currentPeriodEnd?: Date | null;
};

// La presentación y el enlace de contratación comparten la misma elegibilidad.
// El cobro vuelve a comprobar permisos, importe y período en el servidor.
export function publicPlan(sub: Subscription | null, owner: boolean, now = new Date()) {
  const plan = effectivePlan(sub, now);
  const trial = plan === "PRO" && sub?.status === "TRIALING" && sub.trialEndsAt ? sub.trialEndsAt.toISOString().slice(0, 10) : null;
  const paid = plan === "PRO" && !trial && sub?.provider === "mercadopago" && !!sub.providerRef && sub.status === "ACTIVE";
  const billingCycle = paid && (sub?.billingCycle === "monthly" || sub?.billingCycle === "yearly") ? sub.billingCycle : null;
  const canUpgradeAnnual = owner && paid && billingCycle === "monthly" && !!sub?.currentPeriodEnd && sub.currentPeriodEnd > now;
  return { plan, trial, paid, owner, billingCycle, canUpgradeAnnual };
}

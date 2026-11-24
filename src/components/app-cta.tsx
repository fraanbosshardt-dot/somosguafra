"use client";
// Botones de la web pública: Gratis va al pago de Pro; Pro vuelve a la app.
// Se decide en el navegador, así la página se sirve igual para todos (y rápido, desde caché).
import { useEffect, useState, type ReactNode } from "react";
import { landingCheckoutAction } from "@/app/actions/purchase";
import type { SubscriptionView } from "@/server/public-plan";
import { OnceButton } from "./forms";
import { planSelectionHref } from "@/lib/plan-navigation";

export function useHasSession() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(/(?:^|; )somosguafra_in=1/.test(document.cookie)); }, []);
  return on;
}

export type PublicPlan = Partial<SubscriptionView> & { logged: boolean; timeZone?: string };
let planRequest: Promise<PublicPlan> | undefined;
function requestPublicPlan() {
  // All CTAs mounted together share only the in-flight request, never a persistent account cache.
  if (!planRequest) planRequest = fetch("/api/mi-plan", { cache: "no-store" }).then(r => {
    if (!r.ok) throw new Error("Plan no disponible");
    return r.json() as Promise<PublicPlan>;
  }).finally(() => { planRequest = undefined; });
  return planRequest;
}

export function usePublicPlan() {
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  useEffect(() => {
    if (!/(?:^|; )somosguafra_in=1/.test(document.cookie)) return;
    let active = true;
    requestPublicPlan().then((value: PublicPlan) => { if (active) setPlan(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return plan;
}

export function AppCta({ className, label, href = "/registro", logged = false, navigation = false }: { className: string; label: string; href?: string; logged?: boolean; navigation?: boolean }) {
  const hasSession = useHasSession();
  const plan = usePublicPlan();
  const on = plan ? plan.logged : hasSession || logged;
  if (on && navigation) return <a className={className} href="/app">Mi espacio</a>;
  const app = !plan?.canSubscribe || plan?.owner === false;
  const target = !on ? href : plan?.billing === "pending" || plan?.billing === "past_due" || plan?.canceling ? "/app/configuracion?tab=plan" : app ? "/app" : "/#planes";
  const text = !on ? label : target.includes("tab=plan") ? "Ver mi plan" : app ? "Mi espacio" : "Elegir plan Pro";
  return <a className={className} href={target}>{text}</a>;
}

function CheckoutButton({ className, cycle, amount, children }: { className: string; cycle: "monthly" | "yearly"; amount: number; children: ReactNode }) {
  return <form action={landingCheckoutAction} className="landing-checkout-form">
    <input type="hidden" name="cycle" value={cycle} />
    <input type="hidden" name="expectedAmount" value={amount} />
    <OnceButton className={className} pending="Verificando y continuando…">{children}</OnceButton>
  </form>;
}

export function SubscribeCta({ className, cycle, amount, children, trialLabel }: { className: string; cycle: "monthly" | "yearly"; amount: number; children: ReactNode; upgradeLabel?: string; trialLabel?: string }) {
  const plan = usePublicPlan();
  if (plan?.logged && (!plan.canSubscribe || plan.access === "paid" || plan.access === "granted")) {
    if (className.includes("checkout-yearly")) return null;
    const href = planSelectionHref(plan.canChoosePlan, cycle);
    return <a className={className} href={href}>Ver mi plan</a>;
  }
  return <CheckoutButton className={className} cycle={cycle} amount={amount}>{plan?.access === "trial" ? trialLabel ?? `Elegir Pro ${cycle === "yearly" ? "anual" : "mensual"}` : children}</CheckoutButton>;
}

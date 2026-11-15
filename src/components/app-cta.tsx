"use client";
// Botones de la web pública: Gratis va al pago de Pro; Pro vuelve a la app.
// Se decide en el navegador, así la página se sirve igual para todos (y rápido, desde caché).
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { checkoutAction } from "@/app/actions/modules";
import type { SubscriptionView } from "@/server/public-plan";
import { OnceButton } from "./forms";

export function useHasSession() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(/(?:^|; )somosguafra_in=1/.test(document.cookie)); }, []);
  return on;
}

export type PublicPlan = Partial<SubscriptionView> & { logged: boolean; timeZone?: string };

export function usePublicPlan() {
  const [plan, setPlan] = useState<PublicPlan | null>(null);
  useEffect(() => {
    if (!/(?:^|; )somosguafra_in=1/.test(document.cookie)) return;
    let active = true;
    fetch("/api/mi-plan", { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error("Plan no disponible");
      return r.json();
    }).then((value: PublicPlan) => { if (active) setPlan(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return plan;
}

export function AppCta({ className, label, href = "/registro", logged = false, navigation = false }: { className: string; label: string; href?: string; logged?: boolean; navigation?: boolean }) {
  const hasSession = useHasSession();
  const plan = usePublicPlan();
  const on = plan ? plan.logged : hasSession || logged;
  if (on && (navigation || plan?.billing === "pending")) return <a className={className} href="/app">Ir a la app</a>;
  const app = !plan?.canSubscribe || plan?.owner === false;
  const target = !on ? href : plan?.access === "trial" && plan.canSubscribe ? "/#planes" : plan?.billing === "past_due" ? "/app/configuracion?tab=plan" : app ? "/app" : "/suscribirme?ciclo=mensual";
  const text = !on ? label : plan?.access === "trial" && plan.canSubscribe ? "Elegir plan Pro" : plan?.billing === "past_due" ? "Revisar mi pago" : app ? "Ir a la app" : plan ? "Pasar a Pro" : "Continuar";
  if (on && !app && plan?.logged && plan.access !== "trial") return <CheckoutButton className={className} cycle="monthly">Pasar a Pro</CheckoutButton>;
  return <a className={className} href={target}>{text}</a>;
}

function CheckoutButton({ className, cycle, children }: { className: string; cycle: "monthly" | "yearly"; children: ReactNode }) {
  return <form action={checkoutAction} className="checkout-cta" data-plan-cta="" data-billing-cycle={cycle}>
    <input type="hidden" name="cycle" value={cycle} />
    <OnceButton className={className} pending="Abriendo Mercado Pago…">{children}</OnceButton>
  </form>;
}

export function SubscribeCta({ className, cycle, children, upgradeLabel = "Pasar a anual", trialLabel }: { className: string; cycle: "monthly" | "yearly"; children: ReactNode; upgradeLabel?: string; trialLabel?: string }) {
  const logged = useHasSession();
  const plan = usePublicPlan();
  if (plan?.logged) {
    if (cycle === "yearly" && plan.canUpgradeAnnual) return <CheckoutButton className={className} cycle="yearly">{upgradeLabel}</CheckoutButton>;
    if (plan.canResumeCheckout && cycle === plan.pendingCycle) return <form action={checkoutAction} className="checkout-cta"><input type="hidden" name="intent" value="resume" /><OnceButton className={className} pending="Abriendo Mercado Pago…">Continuar pago</OnceButton></form>;
    if (!plan.canSubscribe) return null;
    return <CheckoutButton className={className} cycle={cycle}>{plan.access === "trial" ? trialLabel ?? `Elegir Pro ${cycle === "yearly" ? "anual" : "mensual"}` : children}</CheckoutButton>;
  }
  if (!plan && logged) return <a className={className} href="/app/configuracion?tab=plan">Ver opciones de Pro</a>;
  return <Link className={className} href={`/suscribirme?ciclo=${cycle === "yearly" ? "anual" : "mensual"}`} data-plan-cta="" data-billing-cycle={cycle}>{children}</Link>;
}

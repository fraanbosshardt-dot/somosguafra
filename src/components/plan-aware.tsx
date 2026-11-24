"use client";
// Precios con sesión: mensual puede pasar a anual; anual y Pro manual no se compran otra vez.
// - Prueba de Pro: avisa hasta cuándo y deja suscribirse.
// - Gratis: marca la tarjeta Gratis como tu plan.
import Link from "next/link";

import { usePublicPlan } from "./app-cta";

export function PlanAware({ children }: { children: React.ReactNode }) {
  const me = usePublicPlan();
  const state = !me?.logged ? "" : me.plan === "PRO" ? (me.access === "trial" ? "trial" : "pro") : "free";
  return (
    <div className="plan-aware" data-plan={state || undefined} data-upgrade-annual={me?.canUpgradeAnnual ? "true" : undefined}>
      {children}
      {state === "pro" && <div className="pa-go"><a className="ws-btn pri" href="/app">Mi espacio</a></div>}
    </div>
  );
}

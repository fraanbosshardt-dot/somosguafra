"use client";
// Precios con sesión: mensual puede pasar a anual; anual y Pro manual no se compran otra vez.
// - Prueba de Pro: avisa hasta cuándo y deja suscribirse.
// - Gratis: marca la tarjeta Gratis como tu plan.
import Link from "next/link";

import { usePublicPlan } from "./app-cta";
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fecha = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} de ${MES[m - 1]}`; };

export function PlanAware({ children }: { children: React.ReactNode }) {
  const me = usePublicPlan();
  const state = !me?.logged ? "" : me.plan === "PRO" ? (me.trial ? "trial" : "pro") : "free";
  return (
    <div className="plan-aware" data-plan={state || undefined} data-upgrade-annual={me?.canUpgradeAnnual ? "true" : undefined}>
      {state === "pro" && <div className="pa-note">
        <b>Tu plan actual: Pro{me?.billingCycle === "monthly" ? " mensual" : me?.billingCycle === "yearly" ? " anual" : ""}.</b>{" "}
        {me?.canUpgradeAnnual ? "Podés pasar al anual: respetamos tu período actual, sin adelantar el cobro." : me?.billingCycle === "yearly" ? "Ya tenés el plan anual activo; no hace falta contratarlo de nuevo." : "Ya tenés Pro activo; no hace falta contratarlo de nuevo."}{" "}
        <Link className="lnk" href="/app/configuracion?tab=plan">Ver mi plan</Link>
      </div>}
      {state === "trial" && me?.trial && <div className="pa-note"><b>Estás probando Pro hasta el {fecha(me.trial)}.</b> Si te suscribís, seguís con todo sin cortes.</div>}
      {state === "free" && <div className="pa-note"><b>Tu plan actual: Gratis.</b> Cuando quieras, pasate a Pro.</div>}
      {children}
      {state === "pro" && <div className="pa-go"><Link className="ws-btn pri" href="/app">Ir a la app</Link></div>}
    </div>
  );
}

"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { continueLandingCheckoutAction } from "@/app/actions/purchase";
import { OnceButton } from "@/components/forms";
export function ContinuePurchase() {
  const form = useRef<HTMLFormElement>(null), started = useRef(false);
  useEffect(() => { if (!started.current) { started.current = true; form.current?.requestSubmit(); } }, []);
  return <><p className="sub" role="status">Estamos verificando tu plan para continuar de forma segura.</p>
    <form ref={form} action={continueLandingCheckoutAction}><OnceButton className="btn pri auth-btn" pending="Abriendo Mercado Pago…">Continuar contratación</OnceButton></form>
    <p className="sub">Si ya hay una contratación en curso, te llevamos a Mi plan.</p><Link className="lnk" href="/app/configuracion?tab=plan">Ir a Mi plan</Link></>;
}

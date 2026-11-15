"use client";
import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { contactAction, type ContactState } from "@/app/actions/contact";
import { AREAS } from "@/lib/brand";

// Formulario de Contacto por área. Muestra el número de trámite al enviar.
export function ContactForm({ area: initial, email: initialEmail = "", name: initialName = "", cancellation = false }: { cancellation?: boolean; area: string; email?: string; name?: string }) {
  const [state, run, pending] = useActionState<ContactState, FormData>(contactAction, null);
  const [area, setArea] = useState(AREAS.some((a) => a.key === initial) ? initial : "soporte");

  if (state?.code) return (
    <div className="ws-done" role="status">
      <span className="ws-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
      <h2>¡Recibimos tu consulta!</h2>
      <p>Tu número de trámite es</p>
      <span className="ws-code">{state.code}</span>
      <p>Te respondemos por correo, normalmente en menos de 48 horas hábiles. {area === "arrepentimiento" ? "Guardá este número: es la constancia de tu pedido de arrepentimiento." : "Si escribís de nuevo, mencioná este número."}</p>
      <Link className="ws-btn" href="/">Volver al inicio</Link>
    </div>
  );

  const sel = AREAS.find((a) => a.key === area)!;
  return (
    // Se envía con onSubmit para que, si falta algo, no se borre lo escrito.
    <form className="ws-form" method="post" noValidate onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => run(fd)); }}>
      <h2>{cancellation ? "Dar de baja Pro" : "Escribinos"}</h2>
      {cancellation && <p className="sub">El pedido detiene las renovaciones una vez verificada la cuenta. Conservás el acceso ya pagado. No necesitás indicar un motivo ni contratar otro plan.</p>}
      <fieldset className="ws-areas">
        <legend>¿Sobre qué es tu consulta?</legend>
        {AREAS.map((a) => (
          <label key={a.key} className="ws-area">
            <input type="radio" name="area" value={a.key} checked={area === a.key} onChange={() => setArea(a.key)} />
            <b>{a.name}</b><span>{a.desc}</span>
          </label>
        ))}
      </fieldset>
      <div className="ws-fields">
        <label className="ws-field">Tu nombre<input name="name" autoComplete="name" defaultValue={initialName} required maxLength={120} /></label>
        <label className="ws-field">Tu correo<input name="email" type="email" autoComplete="email" defaultValue={initialEmail} required maxLength={200} /></label>
        <label className="ws-field full">Asunto<input name="subject" defaultValue={cancellation ? "Baja de Pro" : undefined} required maxLength={160} placeholder={area === "arrepentimiento" ? "Quiero cancelar Pro y pedir la devolución" : `Ej.: ${sel.desc.split(",")[0]}`} /></label>
        <label className="ws-field full">Mensaje<textarea name="body" defaultValue={cancellation ? "Solicito dar de baja la renovación de Pro de la cuenta indicada en este formulario." : undefined} required maxLength={5000} placeholder={area === "arrepentimiento" ? "Contanos el correo de tu cuenta y la fecha en que contrataste Pro." : "Contanos con detalle, así te respondemos bien."} />
          {area === "privacidad" && <small>Si pedís borrar tus datos, escribinos desde el correo de tu cuenta.</small>}</label>
      </div>
      <label className="ws-hp" aria-hidden="true">No completar<input name="website" tabIndex={-1} autoComplete="off" /></label>
      {state?.error && <p className="ws-err" role="alert">{state.error}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
        <button className="ws-btn pri" type="submit" disabled={pending} aria-busy={pending}>{pending ? "Enviando…" : "Enviar consulta"}</button>
        <p className="ws-fine">Usamos tus datos solo para responderte. <Link href="/privacidad">Privacidad</Link>.</p>
      </div>
    </form>
  );
}

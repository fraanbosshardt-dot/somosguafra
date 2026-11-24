"use client";
import { useState } from "react";
const TOPICS = [
  ["Planes y pagos", "Si pagaste, revisá Mi plan y esperá la confirmación de Mercado Pago. No repitas un pago aprobado. Podés elegir mensual o anual durante el trial; el primer cobro se informa antes de autorizar.", "/contacto?area=pagos"],
  ["Confirmar mi correo", "Abrí Confirmar correo desde el aviso de la app e ingresá el código de seis números. Revisá spam o pedí otro código. Nunca compartas ese código con soporte.", "/contacto?area=soporte"],
  ["Renovación o devolución", "La renovación se gestiona desde Mi plan. Al cancelarla conservás el período cubierto. Pedir una devolución es una gestión distinta y se realiza desde Contacto → Arrepentimiento.", "/contacto?area=arrepentimiento"],
  ["Necesito ayuda con la app", "Contanos qué pantalla usabas, qué esperabas que ocurriera y qué mensaje apareció. No incluyas contraseñas, códigos ni datos completos de tarjetas.", "/contacto?area=soporte"],
] as const;
export function SupportGuide() {
  const [topic, setTopic] = useState<number | null>(null);
  return <div className="card"><h3>Ayuda rápida</h3><p className="sub">Respuestas breves para estas gestiones.</p><div className="help-quick-actions">{TOPICS.map(([name], i) => <button key={name} className={`btn ${i === topic ? "pri" : ""}`} type="button" aria-pressed={i === topic} onClick={() => setTopic(i)}>{name}</button>)}</div><div aria-live="polite">{topic !== null && <><p style={{ lineHeight: 1.7 }}>{TOPICS[topic][1]}</p><a className="lnk" href={TOPICS[topic][2]}>Hablar con una persona →</a></>}</div></div>;
}

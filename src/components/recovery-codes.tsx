"use client";
import { useActionState } from "react";
import { generateRecoveryCodesAction } from "@/app/actions/recovery";

export function RecoveryCodes({ remaining }: { remaining: number }) {
  const [state, action, pending] = useActionState(generateRecoveryCodesAction, null);
  return <div className="card">
    <div className="chead"><div><h3>Si perdés el teléfono</h3><p className="sub">Guardá códigos de recuperación fuera de este dispositivo. Cada uno sirve una sola vez, después de ingresar con tu cuenta.</p></div></div>
    {state?.codes ? <div role="status">
      <p>Estos códigos se muestran una sola vez. Los anteriores ya no funcionan.</p>
      <ul className="recovery-list">{state.codes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
      <button className="btn" type="button" onClick={() => {
        const blob = new Blob([`somosguafra — códigos de recuperación\nCada código sirve una sola vez. Guardalos en un lugar privado.\n\n${state.codes!.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob), link = document.createElement("a");
        link.href = url; link.download = "somosguafra-recuperacion.txt"; link.click(); URL.revokeObjectURL(url);
      }}>Descargar códigos</button>
    </div> : <>
      <p className="sub">{remaining ? `Te quedan ${remaining} códigos sin usar.` : "Todavía no tenés códigos de recuperación."}</p>
      <details className="more"><summary>{remaining ? "Reemplazar códigos" : "Generar códigos"}</summary>
        <p className="sub">Al generar nuevos códigos, los anteriores dejan de servir. Confirmá con tu app de autenticación.</p>
        <form action={action} className="frow" style={{ alignItems: "end", marginTop: 12 }}>
          <label className="field">Código de la app<input name="code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required /></label>
          <button className="btn pri" disabled={pending}>{pending ? "Generando…" : "Generar y reemplazar"}</button>
        </form>
        {state?.error && <p className="notice r" role="alert">{state.error}</p>}
      </details>
    </>}
  </div>;
}

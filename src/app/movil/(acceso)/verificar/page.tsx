import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { logoutAction, verifyLoginCodeAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";
import { MvLogo } from "../logo";

export const metadata: Metadata = { title: "Verificación" };

export default async function VerificarMovil() {
  const s = await getSession();
  if (!s) redirect("/movil/ingresar");
  if (!s.user.totpEnabledAt || s.twoFactorVerified) redirect("/movil");
  return (
    <main className="mv-auth">
      <MvLogo />
      <div>
        <h1>Revisa tu app de códigos</h1>
        <p className="lead">Abre Google Authenticator (o la que uses) y escribe el código de 6 números de Somos Guafra. Cambia cada 30 segundos.</p>
      </div>
      <ActionForm action={verifyLoginCodeAction} className="mv-web">
        <OtpInput autoSubmit />
        <Submit className="btn pri" pending="Verificando…">Verificar</Submit>
      </ActionForm>
      <details className="mv-card mv-more">
        <summary>Usar un código de recuperación</summary>
        <ActionForm action={verifyLoginCodeAction} className="mv-web">
          <label className="field">Código de recuperación<input name="recoveryCode" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="xxxxx-xxxxx-xxxxx-xxxxx" maxLength={40} required /></label>
          <Submit className="btn pri" pending="Verificando…">Ingresar con este código</Submit>
        </ActionForm>
      </details>
      <a href="/contacto?area=soporte" style={{ color: "var(--brand)", fontWeight: 800, fontSize: 14 }}>¿Perdiste el celular? Escríbenos</a>
      <form action={logoutAction}><button type="submit" className="mv-btn" style={{ width: "100%", borderColor: "var(--field-line)" }}>Usar otra cuenta</button></form>
    </main>
  );
}

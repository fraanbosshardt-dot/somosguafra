import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ActionForm, Submit } from "@/components/forms";
import { loginAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";
import { GoogleButton, GoogleNotice } from "@/components/google-button";
import { googleEnabled } from "@/lib/auth/google";
import { MvLogo } from "../logo";

export const metadata: Metadata = { title: "Ingresar" };

// Ingresar en la app. Usa la misma acción que la web; al estar en /movil vuelve a la app.
export default async function IngresarMovil({ searchParams }: { searchParams: Promise<{ nueva?: string; google?: string }> }) {
  const { nueva, google } = await searchParams;
  const s = await getSession();
  if (s && (!s.user.totpEnabledAt || s.twoFactorVerified)) redirect("/movil");
  return (
    <main className="mv-auth">
      <MvLogo />
      <div>
        <h1>Ingresa a tu cuenta</h1>
        <p className="lead">¿No tienes cuenta? <Link href="/movil/registro" style={{ color: "var(--brand)", fontWeight: 800 }}>Créala gratis</Link></p>
      </div>
      {nueva && <p className="mv-ok">Listo, ya puedes ingresar con tu contraseña nueva.</p>}
      <div className="mv-web"><GoogleNotice code={google} /><GoogleButton desde="ingresar" /></div>
      {googleEnabled() && <span className="mv-or">o con tu correo</span>}
      <ActionForm action={loginAction} className="mv-web">
        <label className="field">Correo<input name="email" type="email" autoComplete="username" placeholder="nombre@correo.com" required /></label>
        <label className="field">Contraseña<input name="password" type="password" autoComplete="current-password" placeholder="Tu contraseña" required /></label>
        <input type="hidden" name="remember" value="on" />
        <Submit className="btn pri" pending="Entrando…">Ingresar</Submit>
      </ActionForm>
      <Link href="/recuperar" style={{ color: "var(--brand)", fontWeight: 800, fontSize: 14 }}>Olvidé mi contraseña</Link>
    </main>
  );
}

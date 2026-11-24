import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ActionForm, PasswordStrength, Submit } from "@/components/forms";
import { signupAction } from "@/app/actions/auth";
import { getSession } from "@/lib/auth/session";
import { GoogleButton, GoogleNotice } from "@/components/google-button";
import { googleEnabled } from "@/lib/auth/google";
import { MvLogo } from "../logo";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function RegistroMovil({ searchParams }: { searchParams: Promise<{ google?: string }> }) {
  const { google } = await searchParams;
  if (await getSession()) redirect("/movil");
  return (
    <main className="mv-auth">
      <MvLogo />
      <div>
        <h1>Crea tu cuenta</h1>
        <p className="lead">¿Ya tienes cuenta? <Link href="/movil/ingresar" style={{ color: "var(--brand)", fontWeight: 800 }}>Ingresa</Link></p>
      </div>
      <div className="mv-web"><GoogleNotice code={google} /><GoogleButton desde="registro" /></div>
      {googleEnabled() && <span className="mv-or">o con tu correo</span>}
      <ActionForm action={signupAction} className="mv-web">
        <label className="field">Nombre<input name="name" autoComplete="name" placeholder="Tu nombre" required /></label>
        <label className="field">Correo<input name="email" type="email" autoComplete="email" placeholder="nombre@correo.com" required /></label>
        <PasswordStrength />
        <label className="simtg">
          <input type="checkbox" name="terms" required />
          <span>Acepto los <Link href="/terminos" style={{ color: "var(--brand)", fontWeight: 800 }}>términos y condiciones</Link> y la <Link href="/privacidad" style={{ color: "var(--brand)", fontWeight: 800 }}>política de privacidad</Link>.</span>
        </label>
        <Submit className="btn pri" pending="Creando tu cuenta…">Crear cuenta</Submit>
      </ActionForm>
      <p className="lead" style={{ fontSize: 13 }}>Sin tarjeta y sin conectar tu banco.</p>
    </main>
  );
}

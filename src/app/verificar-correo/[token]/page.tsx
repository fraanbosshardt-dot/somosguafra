import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { getDb } from "@/lib/db";
import { checkVerifyToken } from "@/server/account-mail";
import { cookies } from "next/headers";
import { PURCHASE_COOKIE, readPurchaseIntent } from "@/server/purchase-intent";

export const metadata: Metadata = { title: "Confirmar correo", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = getDb();
  const user = await checkVerifyToken(db, token);
  const intent = readPurchaseIntent((await cookies()).get(PURCHASE_COOKIE)?.value);
  const next = intent ? `/suscribirme?ciclo=${intent.cycle === "yearly" ? "anual" : "mensual"}` : "/app";
  if (user && !user.emailVerified) await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
  return (
    <AuthShell>
      <h1>{user ? "Listo, tu correo quedó confirmado" : "El enlace venció o no es válido"}</h1>
      <p className="sub">{user ? "Gracias. Tu cuenta ya tiene el correo confirmado." : "Abrí la pantalla de confirmación para ingresar tu código o pedir uno nuevo."}</p>
      <Link className="btn pri auth-btn" href={user ? next : "/confirmar-correo"}>{user ? intent ? "Continuar con mi plan" : "Ir a la app" : "Confirmar mi correo"}</Link>
    </AuthShell>
  );
}

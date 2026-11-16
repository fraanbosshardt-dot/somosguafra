// Comprar Pro desde el sitio, en un solo camino:
// - sin sesión: crear cuenta (o ingresar) y, apenas entra, va a pagar;
// - con Pro ya pago: no deja comprar otra vez;
// - en Gratis o en la prueba gratis: directo a Mercado Pago.
// Después de pagar vuelve a la app.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { publicPlan } from "@/server/public-plan";
import { PURCHASE_COOKIE, readPurchaseIntent } from "@/server/purchase-intent";
import { pickMembership } from "@/server/sharing";

export const dynamic = "force-dynamic";
const AFTER_COOKIE = "somosguafra_after";

export async function GET(req: Request) {
  const anual = new URL(req.url).searchParams.get("ciclo") === "anual";
  const target = `/suscribirme?ciclo=${anual ? "anual" : "mensual"}`;
  const s = await getSession();
  if (!s || (s.user.totpEnabledAt && !s.twoFactorVerified)) {
    // Se recuerda adónde iba (30 minutos): después de crear la cuenta o ingresar, sigue a pagar.
    (await cookies()).set(AFTER_COOKIE, target, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 30 * 60 });
    redirect(s ? "/verificar" : "/registro?pro=1");
  }
  const m = pickMembership(s.user.memberships, s.user.activeWorkspaceId);
  if (!m) redirect("/registro?pro=1");
  if (m.role !== "OWNER") redirect("/app/configuracion?soloduenio=1");
  const sub = m.workspace.subscription;
  // El mensual puede cambiar a anual. Los demás Pro activos no se compran dos veces.
  const agreement = await getDb().billingAgreement.findFirst({ where: { workspaceId: m.workspaceId, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" } });
  const offer = publicPlan(sub, true, new Date(), { agreement });
  if (!offer.canSubscribe || offer.access === "paid" || offer.access === "granted") redirect("/app/configuracion?tab=plan");
  const { needsVerifiedBillingEmail } = await import("@/server/email-verify");
  if (needsVerifiedBillingEmail(s.user)) {
    (await cookies()).set(AFTER_COOKIE, target, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 1800 });
    redirect("/confirmar-correo");
  }
  const intent = readPurchaseIntent((await cookies()).get(PURCHASE_COOKIE)?.value);
  // A signed intent exists only after a deliberate landing POST. GETs never create agreements.
  if (intent && intent.cycle === (anual ? "yearly" : "monthly")) redirect("/continuar-compra");
  redirect(`/app/contratar?ciclo=${anual ? "anual" : "mensual"}`);
}

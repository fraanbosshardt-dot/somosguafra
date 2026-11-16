"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { billingConfig } from "@/server/billing";
import { needsVerifiedBillingEmail } from "@/server/email-verify";
import { PURCHASE_COOKIE, readPurchaseIntent, signPurchaseIntent, type PurchaseIntent } from "@/server/purchase-intent";
import { landingPurchase, PLAN_PAGE } from "@/server/landing-purchase";
import { UserError } from "@/server/ledger";

async function proceed(intent: PurchaseIntent) {
  const jar = await cookies(), s = await getSession();
  const target = `/suscribirme?ciclo=${intent.cycle === "yearly" ? "anual" : "mensual"}`;
  if (!s || s.user.totpEnabledAt && !s.twoFactorVerified || needsVerifiedBillingEmail(s.user)) {
    jar.set("somosguafra_after", target, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 });
    redirect(!s ? "/registro?pro=1" : s.user.totpEnabledAt && !s.twoFactorVerified ? "/verificar" : "/confirmar-correo");
  }
  let destination: string;
  try {
    destination = await landingPurchase(getDb(), s.userId, intent, process.env.APP_URL || "http://localhost:3000");
  } catch (error) {
    // A stale displayed price requires explicit review. No new price is accepted silently.
    destination = error instanceof UserError && /precio cambió/.test(error.message)
      ? `/app/contratar?ciclo=${intent.cycle === "yearly" ? "anual" : "mensual"}`
      : `${PLAN_PAGE}&pagoerror=${encodeURIComponent(error instanceof UserError ? error.message : "No pudimos confirmar la solicitud. Revisá Mi plan antes de volver a intentar.")}`;
  }
  jar.delete(PURCHASE_COOKIE); jar.delete("somosguafra_after");
  redirect(destination);
}

export async function landingCheckoutAction(fd: FormData) {
  const cycle = fd.get("cycle");
  if (cycle !== "monthly" && cycle !== "yearly") redirect("/#planes");
  const bill = await billingConfig(getDb());
  const amount = cycle === "yearly" ? bill.yearly : bill.monthly;
  if (!bill.enabled) redirect("/contacto?area=pagos");
  if (!Number.isFinite(Number(fd.get("expectedAmount"))) || Number(fd.get("expectedAmount")) !== amount || amount <= 0) {
    (await cookies()).delete(PURCHASE_COOKIE);
    redirect(`/suscribirme?ciclo=${cycle === "yearly" ? "anual" : "mensual"}`);
  }
  const raw = signPurchaseIntent(cycle, amount);
  (await cookies()).set(PURCHASE_COOKIE, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 1800 });
  await proceed(readPurchaseIntent(raw)!);
}
export async function continueLandingCheckoutAction() {
  const intent = readPurchaseIntent((await cookies()).get(PURCHASE_COOKIE)?.value);
  if (!intent) redirect("/#planes");
  await proceed(intent);
}

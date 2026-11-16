import { createHmac, timingSafeEqual } from "node:crypto";
import { requireAuthSecret } from "@/lib/auth/secret";

export const PURCHASE_COOKIE = "somosguafra_purchase";
export type PurchaseIntent = { cycle: "monthly" | "yearly"; amount: number; expires: number };
const mac = (body: string) => createHmac("sha256", requireAuthSecret()).update(`purchase-v1:${body}`).digest("base64url");
export function signPurchaseIntent(cycle: PurchaseIntent["cycle"], amount: number, now = Date.now()) {
  if (!Number.isFinite(amount) || amount <= 0) throw Error("Precio inválido.");
  const body = Buffer.from(JSON.stringify({ cycle, amount, expires: now + 30 * 60_000 })).toString("base64url");
  return `${body}.${mac(body)}`;
}
export function readPurchaseIntent(raw: string | undefined, now = Date.now()): PurchaseIntent | null {
  if (!raw || raw.length > 1024) return null;
  try {
    const [body, signature, extra] = raw.split(".");
    if (!body || !signature || extra) return null;
    const want = Buffer.from(mac(body)), got = Buffer.from(signature);
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    const value = JSON.parse(Buffer.from(body, "base64url").toString());
    return ["monthly", "yearly"].includes(value.cycle) && Number.isFinite(value.amount) && value.amount > 0 && Number.isFinite(value.expires) && value.expires > now && value.expires <= now + 30 * 60_000 ? value : null;
  } catch { return null; }
}

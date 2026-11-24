// Planes: qué incluye Gratis y qué incluye Pro. El dueño lo cambia desde el panel interno.
import type { Db } from "./ledger";

import { FEATURE_KEYS, PLAN_FEATURES, FREE_LIMITS, type FeatureKey, type PlanFeature } from "@/lib/plan-features";
export { FREE_LIMITS };
export type { FeatureKey };
export const PRO_FEATURES: { key: FeatureKey; name: string; beta?: boolean }[] = FEATURE_KEYS.map((key) => ({ key, name: PLAN_FEATURES.find((f) => f.feature === key)!.name }));
export const FREE_INCLUDES = PLAN_FEATURES.filter((f) => f.plan === "free").map((f) => f.name);
export const PRICES_DEFAULT = { monthly: 5, yearly: 48 };

export function planFeatures(freeAlso: readonly FeatureKey[] = []): PlanFeature[] {
  return PLAN_FEATURES.map((f) => f.feature && freeAlso.includes(f.feature) ? { ...f, plan: "free" } : f);
}

export async function freeTrialAvailable(db: Pick<Db, "workspace" | "subscription" | "billingAgreement">, workspaceId: string) {
  const ws = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { billingDisabledAt: true } });
  const sub = await db.subscription.findUnique({ where: { workspaceId } });
  return !ws.billingDisabledAt && !!sub && !sub.trialEndsAt && sub.provider !== "mercadopago" && sub.plan === "FREE"
    && await db.billingAgreement.count({ where: { workspaceId, status: { not: "cancelled" } } }) === 0;
}

export async function startFreeTrial(db: Db, workspaceId: string) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    if (!await freeTrialAvailable(tx, workspaceId)) return false;
    await tx.subscription.update({ where: { workspaceId }, data: { plan: "PRO", status: "TRIALING", trialEndsAt: new Date(Date.now() + 14 * 864e5) } });
    return true;
  });
}

// pricesArs: el precio en pesos que se muestra en la web y en la app (si está cargado, reemplaza al de dólares).
type PlanSettings = { freeAlso: FeatureKey[]; prices: { monthly: number; yearly: number }; pricesArs?: { monthly: number; yearly: number } | null };

export async function planSettings(db: Pick<Db, "appSetting">): Promise<PlanSettings> {
  const s = await db.appSetting.findUnique({ where: { key: "plans" } });
  const v = (s?.value ?? {}) as Partial<PlanSettings>;
  const ars = v.pricesArs && v.pricesArs.monthly > 0 && v.pricesArs.yearly > 0 ? v.pricesArs : null;
  return { freeAlso: Array.isArray(v.freeAlso) ? v.freeAlso.filter((k) => PRO_FEATURES.some((f) => f.key === k)) : [], prices: { ...PRICES_DEFAULT, ...(v.prices ?? {}) }, pricesArs: ars };
}

// Precio para mostrar: siempre en pesos. Si todavía no está cargado, "a confirmar" (nunca en dólares).
export function priceLabel(s: Pick<PlanSettings, "prices" | "pricesArs">, cycle: "monthly" | "yearly") {
  if (s.pricesArs) return { text: `$ ${s.pricesArs[cycle].toLocaleString("es-AR")}`, amount: s.pricesArs[cycle], currency: "ARS" };
  return { text: "Precio a confirmar", amount: 0, currency: "ARS" };
}

export async function savePlanSettings(db: Db, value: PlanSettings) {
  await db.appSetting.upsert({ where: { key: "plans" }, create: { key: "plans", value }, update: { value } });
}

// Plan efectivo: Pro pago, o prueba gratis vigente. Si se canceló o el pago quedó pendiente, Pro sigue hasta el fin
// del período ya pagado.
export function effectivePlan(sub: { plan: string; status: string; trialEndsAt: Date | null; currentPeriodEnd?: Date | null; provider?: string | null } | null | undefined, now = new Date()): "FREE" | "PRO" {
  if (!sub) return "FREE";
  if (sub.status === "TRIALING") return sub.trialEndsAt && sub.trialEndsAt > now ? "PRO" : "FREE";
  if (sub.plan !== "PRO") return "FREE";
  if (sub.trialEndsAt && sub.trialEndsAt > now) return "PRO";
  if (sub.status === "ACTIVE" && sub.provider !== "mercadopago" && !sub.trialEndsAt && !sub.currentPeriodEnd) return "PRO";
  return sub.currentPeriodEnd && sub.currentPeriodEnd > now ? "PRO" : "FREE";
}

// Hasta cuándo cubre un pago: un mes o un año desde que se pagó.
export function paidUntil(paidAt: Date, cycle: string | null | undefined, offsetMinutes = 0) {
  const d = new Date(paidAt.getTime() + offsetMinutes * 60_000);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + (cycle === "yearly" ? 12 : 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return new Date(d.getTime() - offsetMinutes * 60_000);
}

export async function hasFeature(db: Pick<Db, "appSetting">, plan: "FREE" | "PRO", key: FeatureKey) {
  if (plan === "PRO") return true;
  return (await planSettings(db)).freeAlso.includes(key);
}

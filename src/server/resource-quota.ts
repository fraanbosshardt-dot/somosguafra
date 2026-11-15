import type { Prisma } from "@/generated/prisma/client";
import { effectivePlan, FREE_LIMITS } from "./plans";

// Se consulta después de bloquear el espacio, en la misma transacción que el alta.
export async function resourceQuotaAvailable(tx: Prisma.TransactionClient, workspaceId: string, kind: "accounts" | "goals") {
  const subscription = await tx.subscription.findUnique({ where: { workspaceId } });
  if (effectivePlan(subscription) === "PRO") return true;
  const settings = await tx.appSetting.findUnique({ where: { key: "plans" } });
  const freeAlso = (settings?.value as { freeAlso?: unknown } | null)?.freeAlso;
  if (Array.isArray(freeAlso) && freeAlso.includes("ilimitado")) return true;
  const count = kind === "accounts"
    ? await tx.account.count({ where: { workspaceId, active: true, type: { not: "CREDIT_CARD" } } })
    : await tx.goal.count({ where: { workspaceId } });
  return count < FREE_LIMITS[kind];
}

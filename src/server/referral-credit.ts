import type { Prisma } from "@/generated/prisma/client";
import { lockWorkspace } from "./workspace-lock";

// Se ejecuta dentro de la transacción del premio, o al volver a un espacio.
// Los días regalados nunca cambian un acuerdo de cobro ni una fecha autorizada en MP.
export async function applyReferralCredit(tx: Prisma.TransactionClient, workspaceId: string, now = new Date()) {
  await lockWorkspace(tx, workspaceId);
  const ws = await tx.workspace.findUniqueOrThrow({ where: { id: workspaceId }, include: { subscription: true } });
  if (!ws.referralCreditDays || ws.billingDisabledAt) return false;
  const sub = ws.subscription;
  if (await tx.billingAgreement.count({ where: { workspaceId, status: { not: "cancelled" } } })) return false;
  if (sub?.provider === "mercadopago" && (sub.status === "ACTIVE" || (sub.currentPeriodEnd && sub.currentPeriodEnd > now))) return false;
  // No reemplazar un acceso sin vencimiento por uno de 30 días.
  if (sub?.plan === "PRO" && sub.status === "ACTIVE" && sub.provider !== "mercadopago" && !sub.trialEndsAt && !sub.currentPeriodEnd) return false;
  const base = Math.max(now.getTime(), sub?.trialEndsAt?.getTime() ?? 0, sub?.currentPeriodEnd?.getTime() ?? 0);
  const trialEndsAt = new Date(base + ws.referralCreditDays * 864e5);
  const data = { plan: "PRO" as const, status: "TRIALING" as const, provider: "manual", providerRef: null, trialEndsAt, currentPeriodEnd: null, nextPaymentAt: null, canceledAt: null };
  await tx.subscription.upsert({ where: { workspaceId }, create: { workspaceId, ...data }, update: data });
  await tx.workspace.update({ where: { id: workspaceId }, data: { referralCreditDays: 0 } });
  await tx.auditLog.create({ data: { workspaceId, action: "referral.credit_applied", meta: { days: ws.referralCreditDays } } });
  return true;
}

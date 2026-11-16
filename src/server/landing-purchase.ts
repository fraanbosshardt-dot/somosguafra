import type { Db } from "./ledger";
import { publicPlan } from "./public-plan";
import { startCheckout } from "./billing";
import { pickMembership } from "./sharing";
import type { PurchaseIntent } from "./purchase-intent";
import { needsVerifiedBillingEmail } from "./email-verify";

export const PLAN_PAGE = "/app/configuracion?tab=plan";
// One routing policy for landing POSTs and the continuation after login. Never called by a GET handler.
export async function landingPurchase(db: Db, userId: string, intent: PurchaseIntent, baseUrl: string) {
  if (intent.expires <= Date.now()) return "/#planes";
  const user = await db.user.findUnique({ where: { id: userId }, include: { memberships: { orderBy: { createdAt: "asc" }, include: { workspace: { include: { subscription: true } } } } } });
  if (!user || user.deletedAt || user.suspendedAt) return "/ingresar";
  if (needsVerifiedBillingEmail(user)) return "/confirmar-correo";
  const m = pickMembership(user.memberships, user.activeWorkspaceId);
  if (!m || m.role !== "OWNER" || m.workspace.archivedAt || m.workspace.billingDisabledAt) return PLAN_PAGE;
  const [agreement, latestPayment] = await Promise.all([
    db.billingAgreement.findFirst({ where: { workspaceId: m.workspaceId, OR: [{ status: { not: "cancelled" } }, { cancelRequestedAt: { not: null } }] }, orderBy: { createdAt: "desc" } }),
    db.invoice.findFirst({ where: { workspaceId: m.workspaceId }, orderBy: [{ periodStart: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], select: { status: true } }),
  ]);
  const view = publicPlan(m.workspace.subscription, true, new Date(), { agreement, lastPaymentStatus: latestPayment?.status });
  // History alone is not a subscription: expired/cancelled users can buy again once no coverage/contract remains.
  if (view.canceling || view.billing !== "none" && view.billing !== "canceled" || ["pending", "in_process"].includes(latestPayment?.status ?? "")) return PLAN_PAGE;
  if (!view.canSubscribe || view.access === "paid" || view.access === "granted") return "/app";
  return startCheckout(db, m.workspaceId, user.email, intent.cycle, `${baseUrl.replace(/\/$/, "")}/pagos/volver?espacio=${encodeURIComponent(m.workspaceId)}`, undefined,
    view.purchaseStartsAt ? new Date(view.purchaseStartsAt) : null, undefined, intent.amount);
}

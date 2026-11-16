import type { PrismaClient } from "@/generated/prisma/client";

export const BILLING_PAGE_SIZE = 50;
export async function adminBillingReport(db: PrismaClient, subPage = 1, paymentPage = 1, now = new Date()) {
  const provider = { provider: "mercadopago" };
  const soon = new Date(now.getTime() + 7 * 864e5);
  const [subs, invoices, subTotal, invoiceTotal, active, pastDue, renewing, rejected] = await Promise.all([
    db.subscription.findMany({ where: provider, include: { workspace: { include: { members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { id: true, name: true, email: true } } } } } } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: BILLING_PAGE_SIZE, skip: (subPage - 1) * BILLING_PAGE_SIZE }),
    db.invoice.findMany({ include: { workspace: { include: { members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { id: true, email: true } } } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: BILLING_PAGE_SIZE, skip: (paymentPage - 1) * BILLING_PAGE_SIZE }),
    db.subscription.count({ where: provider }), db.invoice.count(),
    db.subscription.count({ where: { ...provider, status: "ACTIVE" } }),
    db.subscription.count({ where: { ...provider, status: "PAST_DUE" } }),
    db.subscription.count({ where: { ...provider, status: "ACTIVE", nextPaymentAt: { gt: now, lte: soon } } }),
    db.invoice.count({ where: { status: "rejected", createdAt: { gte: new Date(now.getTime() - 30 * 864e5) } } }),
  ]);
  return { subs, invoices, subTotal, invoiceTotal, active, pastDue, renewing, rejected };
}

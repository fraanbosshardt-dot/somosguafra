import Decimal from "decimal.js";
import type { PrismaClient } from "@/generated/prisma/client";
import { arsConverter } from "./admin-metrics";

export const SETTLEMENT_DEFAULTS = { releaseDays: 18, quotedFeePct: 3.55, totalFeePct: 4.30 };
export async function settlementSettings(db: PrismaClient) {
  const setting = await db.appSetting.findUnique({ where: { key: "settlement" } });
  const v = (setting?.value ?? {}) as Partial<typeof SETTLEMENT_DEFAULTS>;
  return { releaseDays: Number.isFinite(v.releaseDays) && v.releaseDays! >= 0 ? v.releaseDays! : 18, quotedFeePct: Number.isFinite(v.quotedFeePct) ? v.quotedFeePct! : 3.55, totalFeePct: Number.isFinite(v.totalFeePct) && v.totalFeePct! >= 0 && v.totalFeePct! <= 100 ? v.totalFeePct! : 4.30 };
}
export function estimateNet(amount: string, totalFeePct: number) { return new Decimal(amount).mul(new Decimal(100).minus(totalFeePct)).div(100).toFixed(2); }

export const FINANCE_PAGE_SIZE = 50;
export async function financeReport(db: PrismaClient, now = new Date(), invoicePage = 1) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [events, expenses, costs, invoices, config, invoiceTotal] = await Promise.all([
    db.paymentEvent.findMany({ where: { occurredAt: { gte: from }, invoice: { workspace: { excludeFromMetrics: false } } }, orderBy: { occurredAt: "asc" } }),
    db.companyExpense.findMany({ where: { paidAt: { gte: from } }, orderBy: { paidAt: "desc" } }),
    db.companyCost.findMany({ where: { active: true } }),
    db.invoice.findMany({ where: { workspace: { excludeFromMetrics: false } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: FINANCE_PAGE_SIZE, skip: (invoicePage - 1) * FINANCE_PAGE_SIZE, include: { workspace: { select: { name: true } } } }),
    settlementSettings(db),
    db.invoice.count({ where: { workspace: { excludeFromMetrics: false } } }),
  ]);
  const months = Array.from({ length: 6 }, (_, i) => ({ key: new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + i, 1)).toISOString().slice(0, 7), gross: 0, reversed: 0, expenses: 0, unknown: 0, estimatedDates: 0 }));
  const convert = await arsConverter(db, [...events.map(e => e.currency), ...expenses.map(e => e.currency)]);
  for (const event of events) {
    const row = months.find(m => m.key === event.occurredAt.toISOString().slice(0, 7));
    if (!row) continue;
    const value = convert(Number(event.amount), event.currency);
    if (value === null) row.unknown++; else if (event.kind === "gross") row.gross += value; else row.reversed += event.kind === "recovery" ? -value : value;
    if (event.estimatedDate) row.estimatedDates++;
  }
  for (const expense of expenses) {
    const row = months.find(m => m.key === expense.paidAt.toISOString().slice(0, 7));
    if (!row) continue;
    const value = convert(Number(expense.amount), expense.currency);
    if (value === null) row.unknown++; else row.expenses += value;
  }
  const where = { workspace: { excludeFromMetrics: false }, status: "approved", currency: "ARS" };
  const [known, released, missing] = await Promise.all([
    db.invoice.aggregate({ where: { ...where, netAmount: { not: null } }, _sum: { netAmount: true } }),
    db.invoice.aggregate({ where: { ...where, releaseStatus: "released", netAmount: { not: null } }, _sum: { netAmount: true } }),
    db.invoice.count({ where: { ...where, netAmount: null } }),
  ]);
  const knownNet = Number(known._sum.netAmount ?? 0), available = Number(released._sum.netAmount ?? 0);
  return { months, expenses, costs, invoices, config, knownNet, available, pendingRelease: knownNet - available, missing, invoiceTotal, truncated: invoiceTotal > FINANCE_PAGE_SIZE };
}

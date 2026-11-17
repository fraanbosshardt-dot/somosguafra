import type { Db } from "./ledger";
import { dec, ZERO, type MoneyValue } from "@/lib/money";
import { period, periodEnd, periodStart } from "@/lib/dates";
import { categoryReport } from "./io";

// Nunca suma monedas distintas ni vuelve a reclamar lo pagado parcialmente.
export function debtSummary(debts: { debt: { currency: string }; remainingCapital: MoneyValue; open: { dueDate: Date; total: MoneyValue; paid?: MoneyValue | null }[] }[], today: Date) {
  const totals = new Map<string, { currency: string; capital: typeof ZERO; due: typeof ZERO }>();
  for (const d of debts) {
    const row = totals.get(d.debt.currency) ?? { currency: d.debt.currency, capital: ZERO, due: ZERO };
    row.capital = row.capital.plus(dec(d.remainingCapital));
    for (const q of d.open) if (q.dueDate <= periodEnd(period(today))) {
      const left = dec(q.total).minus(dec(q.paid ?? ZERO));
      if (left.gt(0)) row.due = row.due.plus(left);
    }
    totals.set(row.currency, row);
  }
  return [...totals.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function accountActivity(db: Db, ws: string, accountId: string, today: Date, requestedPage = 1) {
  const where = { workspaceId: ws, accountId };
  const [total, sums] = await Promise.all([
    db.transaction.count({ where }),
    db.transaction.groupBy({ by: ["direction"], where: { ...where, effectiveDate: { gte: periodStart(period(today)), lte: periodEnd(period(today)) } }, _sum: { amount: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / 50));
  const page = Math.min(pages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  const movements = await db.transaction.findMany({ where, include: { category: true, reversedBy: { select: { id: true } } }, orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }, { id: "desc" }], take: 50, skip: (page - 1) * 50 });
  return { movements, total, page, pages, incoming: dec(sums.find((s) => s.direction === "IN")?._sum.amount ?? 0), outgoing: dec(sums.find((s) => s.direction === "OUT")?._sum.amount ?? 0) };
}

export async function monthlyReport(db: Db, ws: string, currency: string, month: string, accountId?: string) {
  const account = accountId ? await db.account.findFirst({ where: { workspaceId: ws, id: accountId }, select: { id: true, name: true } }) : null;
  if (accountId && !account) return null;
  const [movements, summary] = await Promise.all([
    db.transaction.findMany({ where: { workspaceId: ws, currency, economicPeriod: month, ...(account ? { accountId: account.id } : {}), NOT: { type: "TRANSFER", direction: "IN" } }, include: { account: { select: { name: true } }, category: { select: { name: true } } }, orderBy: [{ effectiveDate: "asc" }, { createdAt: "asc" }, { id: "asc" }] }),
    categoryReport(db, ws, currency, month, 1, account?.id),
  ]);
  return { account, movements, summary };
}

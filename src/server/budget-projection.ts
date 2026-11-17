// Estimaciones explícitas; nunca crea transacciones, obligaciones ni cambia saldos.
import type { Db } from "./ledger";
import { remaining } from "./ledger";
import { amountFor, occurrences } from "./recurring";
import { subDates } from "./cards";
import { dec, ZERO } from "@/lib/money";
import { period, periodEnd, periodStart } from "@/lib/dates";

export async function budgetProjection(db: Db, ws: string, currency: string, from: string, to: string, today: Date) {
  const budgets = await db.budget.findMany({ where: { workspaceId: ws, currency, period: { gte: from, lte: to }, lines: { some: { projectRemaining: true } } }, include: { lines: { where: { projectRemaining: true } } } });
  if (!budgets.length) return [];
  const periods = budgets.map((b) => b.period);
  const first = periodStart([...periods].sort()[0]), last = periodEnd([...periods].sort().at(-1)!);
  const [cats, expenses, pending, rules, taken, subscriptions] = await Promise.all([
    db.category.findMany({ where: { workspaceId: ws, kind: "EXPENSE" }, select: { id: true, name: true, parentId: true, archived: true } }),
    db.transaction.findMany({ where: { workspaceId: ws, currency, type: "EXPENSE", economicPeriod: { in: periods } }, select: { amount: true, direction: true, categoryId: true, economicPeriod: true, idempotencyKey: true } }),
    db.obligation.findMany({ where: { workspaceId: ws, currency, direction: "PAYABLE", economicPeriod: { in: periods }, status: { in: ["PENDING", "PARTIAL"] }, OR: [{ sourceType: null }, { sourceType: { not: "card" } }] }, include: { payments: true } }),
    db.recurringRule.findMany({ where: { workspaceId: ws, currency, direction: "PAYABLE", pausedAt: null, startDate: { lte: last } } }),
    db.obligation.findMany({ where: { workspaceId: ws, recurringRuleId: { not: null }, occurrenceDate: { gte: first, lte: last } }, select: { recurringRuleId: true, occurrenceDate: true } }),
    db.cardSubscription.findMany({ where: { card: { workspaceId: ws, currency, active: true, accountId: { not: null } }, startDate: { lte: last } } }),
  ]);
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId ?? c.id]));
  const byId = new Map(cats.map((c) => [c.id, c]));
  const spent = new Map<string, ReturnType<typeof dec>>(), committed = new Map<string, ReturnType<typeof dec>>(), scheduled = new Map<string, ReturnType<typeof dec>>();
  const key = (p: string, category: string) => `${p}/${category}`;
  const add = (map: typeof spent, p: string, cat: string | null, value: ReturnType<typeof dec>) => {
    const root = cat ? parentOf.get(cat) : undefined;
    if (!root) return;
    const k = key(p, root); map.set(k, (map.get(k) ?? ZERO).plus(value));
  };
  for (const tx of expenses) add(spent, tx.economicPeriod, tx.categoryId, tx.direction === "OUT" ? dec(tx.amount) : dec(tx.amount).neg());
  for (const ob of pending) add(committed, ob.economicPeriod, ob.categoryId, remaining(ob));
  const seen = new Set(taken.map((o) => `${o.recurringRuleId}/${o.occurrenceDate?.toISOString().slice(0, 10)}`));
  const begin = first > today ? first : today;
  for (const rule of rules) for (const date of occurrences(rule, begin, last)) {
    if (!seen.has(`${rule.id}/${date.toISOString().slice(0, 10)}`)) add(scheduled, period(date), rule.categoryId, amountFor(rule, date));
  }
  const charged = new Set(expenses.map((tx) => tx.idempotencyKey).filter(Boolean));
  // El consumo de tarjeta se cuenta en su mes, no otra vez al pagar el resumen.
  for (const sub of subscriptions) for (const month of periods) for (const date of subDates(sub, new Date(Math.max(periodStart(month).getTime(), today.getTime()) - 864e5), periodEnd(month))) {
    if (!charged.has(`sub:${sub.id}:${date.toISOString().slice(0, 10)}`)) add(scheduled, period(date), sub.categoryId, dec(sub.amount));
  }
  return budgets.flatMap((budget) => budget.lines.flatMap((line) => {
    const cat = byId.get(line.categoryId);
    if (!cat || cat.archived || cat.parentId) return [];
    const k = key(budget.period, cat.id), actual = spent.get(k) ?? ZERO, due = committed.get(k) ?? ZERO, planned = scheduled.get(k) ?? ZERO;
    // Un reintegro puede liberar el límite, pero no aumenta la estimación por encima de él.
    const used = (actual.gt(0) ? actual : ZERO).plus(due).plus(planned);
    const rest = dec(line.limitAmount).minus(used);
    return [{ categoryId: cat.id, name: cat.name, period: budget.period, date: periodEnd(budget.period), amount: periodEnd(budget.period) >= today && rest.gt(0) ? rest : ZERO, scheduled: planned }];
  }));
}

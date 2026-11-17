import { budgetProjection } from "./budget-projection";
import { resourceQuotaAvailable } from "./resource-quota";
import { lockWorkspace } from "./workspace-lock";
// Presupuestos y objetivos de ahorro.
import type { Db } from "./ledger";
import { remaining, UserError } from "./ledger";
import { dec, round2, ZERO, type MoneyValue } from "@/lib/money";
import { addMonths, periodEnd, periodStart, todayIn } from "@/lib/dates";
import type Decimal from "decimal.js";

// ---------- Presupuestos ----------

export async function budgetFor(db: Db, ws: string, p: string, currency: string, today = todayIn()) {
  const [budget, cats, tx, obs] = await Promise.all([
    db.budget.findUnique({ where: { workspaceId_period: { workspaceId: ws, period: p } }, include: { lines: true } }),
    db.category.findMany({ where: { workspaceId: ws, kind: "EXPENSE" }, orderBy: { name: "asc" } }),
    db.transaction.findMany({ where: { workspaceId: ws, currency, type: "EXPENSE", economicPeriod: p }, select: { amount: true, direction: true, categoryId: true } }),
    db.obligation.findMany({ where: { workspaceId: ws, currency, direction: "PAYABLE", status: { in: ["PENDING", "PARTIAL"] }, economicPeriod: p }, include: { payments: true } }),
  ]);
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId ?? c.id]));
  const top = cats.filter((c) => !c.parentId && !c.archived);
  const spent = new Map<string, Decimal>(), committed = new Map<string, Decimal>();
  const add = (m: Map<string, Decimal>, k: string, v: Decimal) => m.set(k, (m.get(k) ?? ZERO).plus(v));
  for (const t of tx) add(spent, parentOf.get(t.categoryId ?? "") ?? "none", t.direction === "OUT" ? dec(t.amount) : dec(t.amount).neg());
  for (const o of obs) add(committed, parentOf.get(o.categoryId ?? "") ?? "none", remaining(o));
  const estimates = await budgetProjection(db, ws, currency, p, p, today, true);
  const byCategory = new Map(estimates.map((e) => [e.categoryId, e]));
  const limits = new Map((budget?.lines ?? []).map((l) => [l.categoryId, dec(l.limitAmount)]));
  const rows = [...top.map((c) => ({ id: c.id, name: c.name })), { id: "none", name: "Sin categoría" }]
    .map((c) => {
      const limit = limits.get(c.id) ?? null, s = spent.get(c.id) ?? ZERO, cm = committed.get(c.id) ?? ZERO;
      const projectRemaining = !!budget?.lines.find((l) => l.categoryId === c.id)?.projectRemaining;
      const estimate = byCategory.get(c.id), scheduled = estimate?.scheduled ?? ZERO;
      return {
        ...c, projectRemaining, estimate: projectRemaining ? estimate?.amount ?? ZERO : ZERO,
        scheduledItems: estimate?.scheduledItems ?? [], scheduled, limit, spent: s, committed: cm,
        available: limit ? limit.minus(s).minus(cm).minus(scheduled) : null,
        pct: limit && limit.gt(0) ? s.plus(cm).plus(scheduled).dividedBy(limit).times(100).toNumber() : null,
      };
    })
    .filter((r) => r.limit || r.spent.gt(0) || r.committed.gt(0));
  const sum = (f: (r: (typeof rows)[number]) => Decimal | null) => rows.reduce((a, r) => a.plus(f(r) ?? ZERO), ZERO);
  return { budget, rows, categories: top, totals: { limit: sum((r) => r.limit), spent: sum((r) => r.spent), committed: sum((r) => r.committed), scheduled: sum((r) => r.scheduled) } };
}

export async function saveBudget(db: Db, ws: string, p: string, currency: string, lines: { categoryId: string; limit: MoneyValue | null; projectRemaining?: boolean }[], options: { onlyIfEmpty?: boolean } = {}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new UserError("Elegí un mes válido.");
  if (lines.length > 300 || new Set(lines.map((l) => l.categoryId)).size !== lines.length) throw new UserError("Revisá las categorías del presupuesto.");
  if (lines.some((l) => l.limit != null && (!round2(l.limit).isFinite() || round2(l.limit).lt(0) || round2(l.limit).gte("10000000000000000")))) throw new UserError("Revisá los límites: usá importes positivos dentro del rango permitido.");
  const cats = new Set((await db.category.findMany({ where: { workspaceId: ws, kind: "EXPENSE", parentId: null, archived: false }, select: { id: true } })).map((c) => c.id));
  const valid = lines.filter((l) => cats.has(l.categoryId) && l.limit != null && round2(l.limit).gt(0));
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, ws);
    if (options.onlyIfEmpty && await tx.budgetLine.count({ where: { budget: { workspaceId: ws, period: p } } })) throw new UserError("Este mes ya tiene un presupuesto. Revisá sus límites antes de reemplazarlo.");
    const b = await tx.budget.upsert({ where: { workspaceId_period: { workspaceId: ws, period: p } }, create: { workspaceId: ws, period: p, currency }, update: {} });
    await tx.budgetLine.deleteMany({ where: { budgetId: b.id } });
    if (valid.length) await tx.budgetLine.createMany({ data: valid.map((l) => ({ budgetId: b.id, categoryId: l.categoryId, limitAmount: round2(l.limit!).toFixed(2), projectRemaining: l.projectRemaining === true })) });
    return b;
  });
}

export async function copyBudget(db: Db, ws: string, from: string, to: string, currency: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to) || from === to) throw new UserError("Elegí meses distintos y válidos para copiar.");
  const prev = await db.budget.findUnique({ where: { workspaceId_period: { workspaceId: ws, period: from } }, include: { lines: true } });
  if (!prev || !prev.lines.length) throw new UserError("El mes anterior no tiene presupuesto para copiar.");
  const active = new Set((await db.category.findMany({ where: { workspaceId: ws, kind: "EXPENSE", parentId: null, archived: false }, select: { id: true } })).map((c) => c.id));
  const lines = prev.lines.filter((l) => active.has(l.categoryId));
  if (!lines.length) throw new UserError("El presupuesto anterior no tiene categorías activas para copiar.");
  return saveBudget(db, ws, to, currency, lines.map((l) => ({ categoryId: l.categoryId, limit: l.limitAmount, projectRemaining: l.projectRemaining })), { onlyIfEmpty: true });
}

export async function budgetDetail(db: Db, ws: string, p: string, currency: string, categoryId: string, view: "gastos" | "previstos", page: number, today: Date) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) throw new UserError("Elegí un mes válido.");
  const b = await budgetFor(db, ws, p, currency, today);
  const row = b.rows.find((r) => r.id === categoryId && r.limit);
  if (!row) return null;
  const children = await db.category.findMany({ where: { workspaceId: ws, parentId: categoryId }, select: { id: true } });
  const category = { in: [categoryId, ...children.map((c) => c.id)] };
  const scope = { workspaceId: ws, currency, economicPeriod: p, categoryId: category };
  const txWhere = { ...scope, type: "EXPENSE" as const };
  const obWhere = { ...scope, direction: "PAYABLE" as const, status: { in: ["PENDING", "PARTIAL"] as ("PENDING" | "PARTIAL")[] } };
  const count = view === "gastos" ? await db.transaction.count({ where: txWhere }) : await db.obligation.count({ where: obWhere });
  const current = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), Math.max(1, Math.ceil(count / 50)));
  const expenses = view === "gastos" ? await db.transaction.findMany({ where: txWhere, orderBy: [{ effectiveDate: "desc" }, { id: "desc" }], skip: (current - 1) * 50, take: 50 }) : [];
  const pending = view === "previstos" ? await db.obligation.findMany({ where: obWhere, include: { payments: true }, orderBy: [{ dueDate: "asc" }, { id: "asc" }], skip: (current - 1) * 50, take: 50 }) : [];
  return { row, expenses, pending, count, page: current, pages: Math.max(1, Math.ceil(count / 50)) };
}

// ---------- Objetivos ----------

export async function goalsOverview(db: Db, ws: string, today: Date) {
  const goals = await db.goal.findMany({ where: { workspaceId: ws }, include: { contributions: { orderBy: { date: "desc" } } }, orderBy: { createdAt: "asc" } });
  return goals.map((g) => {
    const saved = g.contributions.reduce((s, c) => s.plus(dec(c.amount)), ZERO);
    const left = dec(g.targetAmount).minus(saved);
    const monthsLeft = g.targetDate ? Math.max(1, (g.targetDate.getUTCFullYear() - today.getUTCFullYear()) * 12 + g.targetDate.getUTCMonth() - today.getUTCMonth()) : null;
    const needed = monthsLeft && left.gt(0) ? left.times(100).dividedBy(monthsLeft).ceil().dividedBy(100) : ZERO;
    const planned = g.monthlyContribution ? dec(g.monthlyContribution) : null;
    const eta = planned && planned.gt(0) && left.gt(0) ? addMonths(`${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`, Math.ceil(left.dividedBy(planned).toNumber())) : null;
    return { goal: g, saved, left: left.lt(0) ? ZERO : left, pct: Math.min(100, saved.dividedBy(dec(g.targetAmount)).times(100).toNumber()), monthsLeft, needed, planned, eta, done: left.lte(0), onTrack: !monthsLeft || !planned ? null : planned.gte(needed) };
  });
}

export async function addContribution(db: Db, ws: string, goalId: string, amount: MoneyValue, date: Date) {
  const g = await db.goal.findFirst({ where: { id: goalId, workspaceId: ws } });
  if (!g) throw new UserError("No encontramos ese objetivo.");
  const a = round2(amount);
  if (a.isZero()) throw new UserError("El importe no puede ser cero.");
  return db.goalContribution.create({ data: { goalId: g.id, amount: a.toFixed(2), date } });
}

export const monthBounds = (p: string) => ({ from: periodStart(p), to: periodEnd(p) });

export async function createGoal(db: Db, ws: string, input: { name: string; target: MoneyValue; currency: string; targetDate: Date | null; monthly: MoneyValue | null; saved: MoneyValue | null; today: Date }) {
  const target = round2(input.target), monthly = input.monthly == null ? null : round2(input.monthly), saved = input.saved == null ? ZERO : round2(input.saved);
  if (!input.name.trim() || input.name.length > 100) throw new UserError("Escribí un nombre de hasta 100 caracteres.");
  if (!target.gt(0) || saved.lt(0) || monthly?.lt(0)) throw new UserError("La meta tiene que ser positiva y los aportes no pueden ser negativos.");
  return db.$transaction(async (tx) => {
    await lockWorkspace(tx, ws);
    if (!(await resourceQuotaAvailable(tx, ws, "goals"))) throw new UserError("El plan Gratis incluye 3 objetivos. Pasá a Pro para tener más.");
    const goal = await tx.goal.create({ data: { workspaceId: ws, name: input.name.trim(), targetAmount: target.toFixed(2), currency: input.currency, targetDate: input.targetDate, monthlyContribution: monthly?.toFixed(2) ?? null } });
    if (saved.gt(0)) await tx.goalContribution.create({ data: { goalId: goal.id, amount: saved.toFixed(2), date: input.today } });
    return goal;
  });
}

// Editar la meta no mueve dinero ni modifica el historial de aportes o su moneda.
export async function editGoal(db: Db, ws: string, id: string, input: { name: string; target: MoneyValue; targetDate: Date | null; monthly: MoneyValue | null }) {
  const target = round2(input.target), monthly = input.monthly == null ? null : round2(input.monthly);
  if (!input.name.trim() || input.name.trim().length > 100) throw new UserError("Escribí un nombre de hasta 100 caracteres.");
  if (!target.isFinite() || !target.gt(0) || (monthly != null && (!monthly.isFinite() || monthly.lt(0)))) throw new UserError("La meta tiene que ser positiva y el aporte no puede ser negativo.");
  if (input.targetDate && !Number.isFinite(input.targetDate.getTime())) throw new UserError("Revisá la fecha de la meta.");
  const result = await db.goal.updateMany({ where: { id, workspaceId: ws }, data: { name: input.name.trim(), targetAmount: target.toFixed(2), targetDate: input.targetDate, monthlyContribution: monthly?.toFixed(2) ?? null } });
  if (!result.count) throw new UserError("No encontramos ese objetivo.");
}

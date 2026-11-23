import { createHash } from "node:crypto";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { lockWorkspace } from "./workspace-lock";
import { budgetFor } from "./planning";
import { addMonths, periodEnd, validPeriod } from "@/lib/dates";
import { ZERO } from "@/lib/money";
import { effectivePlan, hasFeature } from "./plans";

export async function previewBudgetCarry(db: Db, ws: string, from: string, currency: string, today: Date) {
  if (!validPeriod(from) || periodEnd(from) >= today) throw new UserError("El traslado se calcula desde un mes que ya terminó.");
  const source = await budgetFor(db, ws, from, currency, today);
  if (!source.budget || source.budget.currency !== currency) throw new UserError("No hay un presupuesto anterior en esta moneda.");
  const lines = source.rows.filter(r => r.limit && r.id !== "none").map(r => {
    const base = r.limit!, extra = r.available?.gt(0) ? r.available : ZERO;
    return { categoryId: r.id, name: r.name, base: base.toFixed(2), extra: extra.toFixed(2), total: base.plus(extra).toFixed(2), projectRemaining: r.projectRemaining };
  });
  if (!lines.length) throw new UserError("No hay límites activos para trasladar.");
  const to = addMonths(from, 1);
  const fingerprint = createHash("sha256").update(JSON.stringify({ from, to, currency, lines })).digest("hex");
  return { from, to, currency, lines, fingerprint };
}
export async function applyBudgetCarry(db: Db, ws: string, from: string, currency: string, today: Date, expected: string) {
  return db.$transaction(async tx => {
    await lockWorkspace(tx, ws);
    const space = await tx.workspace.findUniqueOrThrow({ where: { id: ws }, include: { subscription: true } });
    if (!await hasFeature(tx, effectivePlan(space.subscription), "informes")) throw new UserError("Trasladar margen es parte de Pro.");
    const preview = await previewBudgetCarry(tx as Db, ws, from, currency, today);
    if (preview.fingerprint !== expected) throw new UserError("El presupuesto cambió desde la revisión. Volvé a revisar antes de trasladar.");
    const existing = await tx.budget.findUnique({ where: { workspaceId_period: { workspaceId: ws, period: preview.to } }, include: { lines: true } });
    if (existing?.lines.length) throw new UserError("El mes de destino ya tiene límites. No se reemplazan ni se suma el margen dos veces.");
    const budget = await tx.budget.upsert({ where: { workspaceId_period: { workspaceId: ws, period: preview.to } }, create: { workspaceId: ws, period: preview.to, currency }, update: { currency } });
    await tx.budgetLine.createMany({ data: preview.lines.map(l => ({ budgetId: budget.id, categoryId: l.categoryId, limitAmount: l.total, projectRemaining: l.projectRemaining })) });
    const modules = space.modules && typeof space.modules === "object" && !Array.isArray(space.modules) ? space.modules : {};
    // Un recibo por el último traslado; el detalle se exporta y elimina con el espacio.
    await tx.workspace.update({ where: { id: ws }, data: { modules: { ...modules, _budgetCarry: { ...preview, at: new Date().toISOString() } } } });
    return preview;
  });
}

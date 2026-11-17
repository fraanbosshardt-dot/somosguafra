import { matchChatHelp } from "@/lib/chat-help";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { budgetFor, copyBudget, saveBudget } from "@/server/planning";
import { forecast } from "@/server/forecast";
import { budgetProjection } from "@/server/budget-projection";
import { createAccount, recordMovement, payObligation, cancelObligation, reverseTransaction } from "@/server/ledger";
import { createRule, materializeOccurrence } from "@/server/recurring";
import { createCard, cardPurchase, cardRefund, addSubscription, chargeSubscriptions, closeStatements } from "@/server/cards";
let t: Awaited<ReturnType<typeof startTestDb>>;
const d = (s: string) => new Date(`${s}T00:00:00Z`), today = d("2026-11-01");
beforeAll(async () => { t = await startTestDb(); }, 60000);
afterAll(async () => { await t?.stop(); });
let sequence = 0;
async function setup(project = true, currency = "ARS") {
  const user = await t.db.user.create({ data: { email: `budget-${sequence++}@audit.invalid`, name: "Demo", passwordHash: "fixture" } });
  const ws = (await createWorkspaceForUser(t.db, user.id)).id;
  const bank = await createAccount(t.db, ws, { name: "Banco demo", type: "SAVINGS", currency, initialBalance: "1000000", initialDate: today });
  const cat = await t.db.category.findFirstOrThrow({ where: { workspaceId: ws, kind: "EXPENSE", parentId: null } });
  await saveBudget(t.db, ws, "2026-11", currency, [{ categoryId: cat.id, limit: "500000", projectRemaining: project }]);
  return { ws, bank, cat, currency };
}
async function outlook(s: Awaited<ReturnType<typeof setup>>, date = today, months = 1, certainty: "prob" | "conf" = "prob") {
  return forecast(t.db, s.ws, { currency: s.currency, today: date, months, certainty });
}
async function estimate(s: Awaited<ReturnType<typeof setup>>, month = "2026-11", date = today) {
  return (await budgetProjection(t.db, s.ws, s.currency, month, month, date))[0];
}
it("solo reserva categorías activadas: sin gastos falsos, sin efecto en saldo, sin extender a meses sin presupuesto", async () => {
  const s = await setup(false);
  expect((await outlook(s)).events).toHaveLength(0);
  await saveBudget(t.db, s.ws, "2026-11", "ARS", [{ categoryId: s.cat.id, limit: "500000", projectRemaining: true }]);
  const before = { movements: await t.db.transaction.count({ where: { workspaceId: s.ws } }), pending: await t.db.obligation.count({ where: { workspaceId: s.ws } }) };
  const f = await outlook(s, today, 3);
  expect(f.cashNow.toString()).toBe("1000000");
  expect(f.events).toHaveLength(1);
  expect(f.events[0]).toMatchObject({ date: d("2026-11-30"), kind: "budget", certainty: "PROBABLE" });
  expect(f.rows.map((r) => r.end.toString())).toEqual(["500000", "500000", "500000"]);
  expect((await outlook(s, today, 1, "conf")).rows[0].end.toString()).toBe("1000000");
  expect(await t.db.transaction.count({ where: { workspaceId: s.ws } })).toBe(before.movements);
  expect(await t.db.obligation.count({ where: { workspaceId: s.ws } })).toBe(before.pending);
});
it("compra + pendiente + pago parcial + saldado conservan proyección sin duplicar", async () => {
  const s = await setup();
  await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Compra", amount: "120000", accountId: s.bank.id, categoryId: s.cat.id, status: "PAID", effectiveDate: today });
  const ob = await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Pedido", amount: "30000", accountId: s.bank.id, categoryId: s.cat.id, status: "PENDING", dueDate: d("2026-11-10") });
  expect((await estimate(s)).amount.toString()).toBe("350000");
  expect((await outlook(s)).rows[0].end.toString()).toBe("500000");
  await payObligation(t.db, s.ws, { obligationId: ob.obligationId!, accountId: s.bank.id, amount: "10000", date: today });
  expect((await estimate(s)).amount.toString()).toBe("350000");
  expect((await outlook(s)).rows[0].end.toString()).toBe("500000");
  await payObligation(t.db, s.ws, { obligationId: ob.obligationId!, accountId: s.bank.id, amount: "20000", date: today });
  const b = await budgetFor(t.db, s.ws, "2026-11", "ARS", today);
  expect(b.totals.spent.toString()).toBe("150000");
  expect(b.totals.committed.toString()).toBe("0");
  expect((await outlook(s)).rows[0].end.toString()).toBe("500000");
});
it("recurrentes proyectados o materializados reservan una sola vez; cancelarlos libera la estimación", async () => {
  const s = await setup();
  const r = await createRule(t.db, s.ws, { direction: "PAYABLE", description: "Servicio", amount: "100000", currency: "ARS", categoryId: s.cat.id, frequency: "MONTHLY", dayOfMonth: 20, startDate: d("2026-11-20") });
  expect((await estimate(s)).amount.toString()).toBe("400000");
  expect((await outlook(s)).rows[0].end.toString()).toBe("500000");
  const id = await materializeOccurrence(t.db, s.ws, r.id, d("2026-11-20"));
  expect((await estimate(s)).amount.toString()).toBe("400000");
  expect((await outlook(s)).rows[0].end.toString()).toBe("500000");
  await cancelObligation(t.db, s.ws, id);
  expect((await estimate(s)).amount.toString()).toBe("500000");
  expect((await outlook(s)).events.filter((e) => e.kind === "recurring" || e.kind === "pending")).toHaveLength(0);
});
it("categorías distintas, subcategorías archivadas y reintegros no mezclan ni superan el límite", async () => {
  const s = await setup();
  const child = await t.db.category.create({ data: { workspaceId: s.ws, kind: "EXPENSE", name: "Subcategoría", parentId: s.cat.id } });
  const movement = await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Compra", amount: "120000", accountId: s.bank.id, categoryId: child.id, status: "PAID", effectiveDate: today });
  await t.db.category.update({ where: { id: child.id }, data: { archived: true } });
  expect((await estimate(s)).amount.toString()).toBe("380000");
  expect((await budgetFor(t.db, s.ws, "2026-11", "ARS", today)).totals.spent.toString()).toBe("120000");
  await reverseTransaction(t.db, s.ws, movement.transactionId!);
  expect((await estimate(s)).amount.toString()).toBe("500000");
  await t.db.transaction.create({ data: { workspaceId: s.ws, accountId: s.bank.id, categoryId: s.cat.id, type: "EXPENSE", direction: "IN", amount: "20000", currency: "ARS", effectiveDate: today, economicPeriod: "2026-11", description: "Reintegro de compra anterior" } });
  expect((await estimate(s)).amount.toString()).toBe("500000");
  await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Sin categoría", amount: "1000", accountId: s.bank.id, status: "PAID", effectiveDate: today });
  expect((await estimate(s)).amount.toString()).toBe("500000");
});
it("compra con tarjeta consume presupuesto una vez y mantiene el vencimiento del resumen", async () => {
  const s = await setup();
  const card = await createCard(t.db, s.ws, { issuer: "Demo", name: "Tarjeta", limit: "900000", currency: "ARS", closingDay: 20, dueDay: 5, startDate: today });
  await cardPurchase(t.db, s.ws, { cardId: card.id, description: "Compra", amount: "120000", categoryId: s.cat.id, date: d("2026-11-10") });
  expect((await estimate(s)).amount.toString()).toBe("380000");
  const f = await outlook(s, d("2026-11-11"), 2);
  expect(f.rows[0].end.toString()).toBe("620000");
  expect(f.rows[1].end.toString()).toBe("500000");
  expect(f.events.filter((e) => e.kind === "card")).toHaveLength(1);
  await cardRefund(t.db, s.ws, { cardId: card.id, description: "Devolución", amount: "20000", categoryId: s.cat.id, date: d("2026-11-11") });
  expect((await estimate(s)).amount.toString()).toBe("400000");
  expect((await outlook(s, d("2026-11-12"), 2)).rows[1].end.toString()).toBe("500000");
});
it("cuotas de una compra anterior no consumen otro presupuesto mensual", async () => {
  const s = await setup();
  const card = await createCard(t.db, s.ws, { issuer: "Demo", name: "Cuotas", limit: "900000", currency: "ARS", closingDay: 20, dueDay: 25, startDate: today });
  await cardPurchase(t.db, s.ws, { cardId: card.id, description: "Compra en cuotas", amount: "120000", installments: 3, categoryId: s.cat.id, date: d("2026-11-10") });
  await copyBudget(t.db, s.ws, "2026-11", "2026-12", "ARS");
  expect((await estimate(s)).amount.toString()).toBe("380000");
  expect((await estimate(s, "2026-12")).amount.toString()).toBe("500000");
  const f = await outlook(s, d("2026-11-11"), 2);
  expect(f.rows[0].pendingOut.toString()).toBe("420000"); // 380k estimación + 40k primera cuota
  expect(f.rows[1].pendingOut.toString()).toBe("540000"); // nuevo presupuesto + cuota de compra anterior
});
it("suscripción de tarjeta prevista y luego cargada consume una sola vez, incluso a más de 40 meses", async () => {
  const s = await setup();
  const card = await createCard(t.db, s.ws, { issuer: "Demo", name: "Débitos", limit: "900000", currency: "ARS", closingDay: 20, dueDay: 25, startDate: today });
  await addSubscription(t.db, s.ws, { cardId: card.id, description: "Servicio", amount: "10000", dayOfMonth: 10, categoryId: s.cat.id, startDate: today });
  expect((await estimate(s)).amount.toString()).toBe("490000");
  expect((await outlook(s)).rows[0].end.toString()).toBe("500000");
  await chargeSubscriptions(t.db, s.ws, d("2026-11-11"));
  expect((await estimate(s, "2026-11", d("2026-11-11"))).amount.toString()).toBe("490000");
  expect((await outlook(s, d("2026-11-11"))).rows[0].end.toString()).toBe("500000");
  await copyBudget(t.db, s.ws, "2026-11", "2030-12", "ARS");
  const future = await budgetProjection(t.db, s.ws, "ARS", "2026-11", "2030-12", today);
  expect(future.find((b) => b.period === "2030-12")?.amount.toString()).toBe("490000");
});
it("exceso, presupuesto vencido y desactivación no generan estimaciones negativas o retroactivas", async () => {
  const s = await setup();
  await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Compra", amount: "600000", accountId: s.bank.id, categoryId: s.cat.id, status: "PAID", effectiveDate: today });
  expect((await estimate(s)).amount.toString()).toBe("0");
  expect((await outlook(s)).events.filter((e) => e.kind === "budget")).toHaveLength(0);
  await saveBudget(t.db, s.ws, "2026-11", "ARS", [{ categoryId: s.cat.id, limit: "900000", projectRemaining: true }]);
  expect((await estimate(s, "2026-11", d("2026-12-01"))).amount.toString()).toBe("0");
  await saveBudget(t.db, s.ws, "2026-11", "ARS", [{ categoryId: s.cat.id, limit: "900000", projectRemaining: false }]);
  expect(await estimate(s)).toBeUndefined();
});
it("aislamiento por espacio y moneda, validación de período y categorías ajenas", async () => {
  const s = await setup(), other = await setup(true, "USD");
  expect(await budgetProjection(t.db, s.ws, "USD", "2026-11", "2026-11", today)).toEqual([]);
  await expect(saveBudget(t.db, s.ws, "2026-13", "ARS", [])).rejects.toThrow(/mes válido/);
  for (const limit of [-1, "NaN", "Infinity", "10000000000000000"]) await expect(saveBudget(t.db, s.ws, "2026-11", "ARS", [{ categoryId: s.cat.id, limit }])).rejects.toThrow();
  await saveBudget(t.db, s.ws, "2026-11", "ARS", [{ categoryId: other.cat.id, limit: "900000", projectRemaining: true }]);
  expect(await estimate(s)).toBeUndefined();
  expect((await estimate(other)).amount.toString()).toBe("500000");
});

it("pagar el resumen, incluso parcialmente, no vuelve a consumir el presupuesto", async () => {
  const s = await setup();
  const card = await createCard(t.db, s.ws, { issuer: "Demo", name: "Resumen", limit: "900000", currency: "ARS", closingDay: 20, dueDay: 25, startDate: today });
  await t.db.creditCard.update({ where: { id: card.id }, data: { createdAt: today } });
  await cardPurchase(t.db, s.ws, { cardId: card.id, description: "Compra", amount: "120000", categoryId: s.cat.id, date: d("2026-11-10") });
  await closeStatements(t.db, s.ws, d("2026-11-21"));
  const statement = await t.db.obligation.findFirstOrThrow({ where: { workspaceId: s.ws, sourceType: "card" } });
  expect((await outlook(s, d("2026-11-21"))).rows[0].end.toString()).toBe("500000");
  await payObligation(t.db, s.ws, { obligationId: statement.id, accountId: s.bank.id, amount: "60000", date: d("2026-11-21") });
  expect((await estimate(s)).amount.toString()).toBe("380000");
  expect((await outlook(s, d("2026-11-21"))).rows[0].end.toString()).toBe("500000");
  await payObligation(t.db, s.ws, { obligationId: statement.id, accountId: s.bank.id, amount: "60000", date: d("2026-11-21") });
  expect((await estimate(s)).amount.toString()).toBe("380000");
  expect((await budgetFor(t.db, s.ws, "2026-11", "ARS", today)).totals.spent.toString()).toBe("120000");
  expect((await outlook(s, d("2026-11-21"))).rows[0].end.toString()).toBe("500000");
});
it("un pendiente de otro período conserva su salida de caja sin consumir el nuevo presupuesto", async () => {
  const s = await setup();
  await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Mes anterior", amount: "30000", accountId: s.bank.id, categoryId: s.cat.id, status: "PENDING", dueDate: d("2026-11-10"), economicPeriod: "2026-10" });
  expect((await estimate(s)).amount.toString()).toBe("500000");
  expect((await outlook(s)).rows[0].end.toString()).toBe("470000");
});

it("guardar y copiar conserva centavos y la opción de cada categoría", async () => {
  const s = await setup();
  await saveBudget(t.db, s.ws, "2026-11", "ARS", [{ categoryId: s.cat.id, limit: "500000.50", projectRemaining: true }]);
  await copyBudget(t.db, s.ws, "2026-11", "2026-12", "ARS");
  const copied = await t.db.budget.findUniqueOrThrow({ where: { workspaceId_period: { workspaceId: s.ws, period: "2026-12" } }, include: { lines: true } });
  expect(copied.lines[0].limitAmount.toFixed(2)).toBe("500000.50");
  expect(copied.lines[0].projectRemaining).toBe(true);
});

it("el bot distingue revisión de registros de reclamos por cobros reales de Pro", () => {
  expect(matchChatHelp("Veo pagos repetidos en próximos").topic?.id).toBe("duplicate-payments");
  expect(matchChatHelp("Me cobraron Pro dos veces")).toMatchObject({ topic: null, escalate: true, urgent: true, area: "pagos" });
  expect(matchChatHelp("Cómo armo un presupuesto").topic?.id).toBe("budgets");
});

import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { createGoal, editGoal, goalsOverview, saveBudget, budgetFor } from "@/server/planning";
import { createAccount, recordMovement } from "@/server/ledger";
import { forecast } from "@/server/forecast";
import { reviewUpcoming, upcomingMatches } from "@/lib/upcoming-review";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ws: string, other: string;
const day = new Date("2026-11-01T00:00:00Z");
beforeAll(async () => {
  t = await startTestDb();
  for (const email of ["planning@audit.invalid", "other-planning@audit.invalid"]) {
    const user = await t.db.user.create({ data: { email, name: "Demo", passwordHash: "fixture" } });
    const space = await createWorkspaceForUser(t.db, user.id);
    if (!ws) ws = space.id; else other = space.id;
  }
}, 60_000);
afterAll(async () => { await t?.stop(); });

it("editar la meta conserva moneda, aportes y dinero; permite completar una meta menor", async () => {
  const goal = await createGoal(t.db, ws, { name: "Viaje", target: "1000", currency: "ARS", targetDate: day, monthly: "100", saved: "400", today: day });
  const contributions = await t.db.goalContribution.findMany({ where: { goalId: goal.id } });
  const movements = await t.db.transaction.count();
  await editGoal(t.db, ws, goal.id, { name: " Viaje nuevo ", target: "300", targetDate: null, monthly: null });
  const saved = await t.db.goal.findUniqueOrThrow({ where: { id: goal.id } });
  expect(saved).toMatchObject({ name: "Viaje nuevo", currency: "ARS", targetDate: null, monthlyContribution: null });
  expect(saved.targetAmount.toString()).toBe("300");
  expect(await t.db.goalContribution.findMany({ where: { goalId: goal.id } })).toEqual(contributions);
  expect(await t.db.transaction.count()).toBe(movements);
  expect((await goalsOverview(t.db, ws, day)).find((g) => g.goal.id === goal.id)?.done).toBe(true);
  await expect(editGoal(t.db, other, goal.id, { name: "Ajeno", target: 1, targetDate: null, monthly: null })).rejects.toThrow(/No encontramos/);
  expect((await t.db.goal.findUniqueOrThrow({ where: { id: goal.id } })).name).toBe("Viaje nuevo");
});

it("rechaza metas, aportes, nombres y fechas inválidas sin alterar el objetivo", async () => {
  const goal = await createGoal(t.db, other, { name: "Ahorro", target: 1000, currency: "USD", targetDate: null, monthly: null, saved: null, today: day });
  const base = { name: "Ahorro", target: 1000, targetDate: null, monthly: null };
  for (const patch of [{ name: " " }, { name: "a".repeat(101) }, { target: 0 }, { target: -1 }, { target: "NaN" }, { monthly: -1 }, { monthly: "Infinity" }, { targetDate: new Date("invalid") }]) {
    await expect(editGoal(t.db, other, goal.id, { ...base, ...patch })).rejects.toThrow();
  }
  expect((await t.db.goal.findUniqueOrThrow({ where: { id: goal.id } })).targetAmount.toString()).toBe("1000");
});

it("diagnóstico: límite de presupuesto no crea gasto ni proyección; compras y pendientes se distinguen", async () => {
  const account = await createAccount(t.db, ws, { name: "Banco demo", type: "SAVINGS", currency: "ARS", initialBalance: "1000000", initialDate: day });
  const cat = await t.db.category.findFirstOrThrow({ where: { workspaceId: ws, kind: "EXPENSE", parentId: null } });
  await saveBudget(t.db, ws, "2026-11", "ARS", [{ categoryId: cat.id, limit: "500000" }]);
  const before = await budgetFor(t.db, ws, "2026-11", "ARS");
  expect(before.totals.spent.toString()).toBe("0");
  expect(before.totals.committed.toString()).toBe("0");
  const flow = await forecast(t.db, ws, { currency: "ARS", today: day, months: 1 });
  expect(flow.rows[0].end.toString()).toBe("1000000");
  expect(flow.events).toHaveLength(0);
  await recordMovement(t.db, ws, { kind: "EXPENSE", description: "Compra demo", accountId: account.id, categoryId: cat.id, amount: "120000", status: "PAID", effectiveDate: day });
  await recordMovement(t.db, ws, { kind: "EXPENSE", description: "Pedido pendiente demo", accountId: account.id, categoryId: cat.id, amount: "30000", status: "PENDING", dueDate: day });
  const after = (await budgetFor(t.db, ws, "2026-11", "ARS")).rows.find((r) => r.id === cat.id)!;
  expect(after.spent.toString()).toBe("120000");
  expect(after.committed.toString()).toBe("30000");
  expect(after.available?.toString()).toBe("350000");
});

const item = (id: string, description: string, date = "2026-11-20", direction = "PAYABLE", currency = "ARS", amount = "100") => ({ id, description, dueDate: new Date(`${date}T00:00:00Z`), direction, currency, amount });
it("revisión agrupa coincidencias sin confundir otros meses, monedas, importes o cobros", () => {
  const rows = [item("a", "Energía"), item("b", " ENERGIA  "), item("c", "Energía", "2026-12-20"), item("d", "Energía", undefined, "RECEIVABLE"), item("e", "Energía", undefined, undefined, "USD"), item("f", "Energía", undefined, undefined, undefined, "101")];
  expect([...upcomingMatches(rows)]).toEqual(["a", "b"]);
  expect(reviewUpcoming(rows, { q: "energia", matchesOnly: true }).shown.map((r) => r.id)).toEqual(["b", "a"]);
  expect(rows).toHaveLength(6);
});
it("búsqueda sin acentos y orden alfabético son globales, con fechas como desempate", () => {
  const rows = [item("a", "Zeta", "2026-11-01"), item("b", "Álquiler", "2026-12-01"), item("c", "Álquiler", "2026-11-03"), item("d", "Banco", "2026-11-02")];
  expect(reviewUpcoming(rows, { alphabetical: true }).shown.map((r) => r.id)).toEqual(["c", "b", "d", "a"]);
  expect(reviewUpcoming(rows, { q: "alquiler" }).shown.map((r) => r.id)).toEqual(["c", "b"]);
  expect(reviewUpcoming(rows, { direction: "RECEIVABLE" }).shown).toEqual([]);
  expect(rows[0].id).toBe("a");
});

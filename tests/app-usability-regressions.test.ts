import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { createAccount, recordMovement, reverseTransaction, payObligation } from "@/server/ledger";
import { createDebt, debtDetail } from "@/server/debts";
import { debtSummary, accountActivity, monthlyReport } from "@/server/financial-summaries";
import { categoryReport, exportMovementsXlsx } from "@/server/io";
import { readXlsx } from "@/lib/xlsx";
import { chatCasePage } from "@/server/chat-case-page";
import { validPeriod } from "@/lib/dates";
import { hasChatOpen, requestChatOpen, takeChatOpen } from "@/lib/open-chat";
import { simulationParams, sealSimulation, openSimulation } from "@/server/private-simulation";

let t: Awaited<ReturnType<typeof startTestDb>>;
const today = new Date("2026-11-17T00:00:00Z");
beforeAll(async () => { t = await startTestDb(); vi.stubEnv("AUTH_SECRET", "usability-synthetic-auth-secret-longer-than-32-characters"); }, 60000);
afterAll(async () => { await t?.stop(); vi.unstubAllEnvs(); });
let seq = 0;
async function setup() {
  const user = await t.db.user.create({ data: { name: "Demostración", email: `usability-${seq++}@audit.invalid`, passwordHash: "fixture" } });
  const ws = await createWorkspaceForUser(t.db, user.id);
  const bank = await createAccount(t.db, ws.id, { name: "Banco de prueba", type: "SAVINGS", currency: "ARS", initialBalance: "1000000", initialDate: new Date("2026-11-01T00:00:00Z") });
  const cat = await t.db.category.findFirstOrThrow({ where: { workspaceId: ws.id, kind: "EXPENSE", parentId: null } });
  return { user, ws: ws.id, bank, cat };
}
it("deudas separa monedas y descuenta pagos parciales, sin sumar cuotas futuras", () => {
  const data = debtSummary([
    { debt: { currency: "ARS" }, remainingCapital: "800", open: [{ dueDate: today, total: "100", paid: "40" }, { dueDate: new Date("2026-12-01"), total: "200", paid: 0 }] },
    { debt: { currency: "USD" }, remainingCapital: "50", open: [{ dueDate: new Date("2026-10-10"), total: "25", paid: "10" }] },
  ], today);
  expect(data.map((r) => [r.currency, r.capital.toString(), r.due.toString()])).toEqual([["ARS", "800", "60"], ["USD", "50", "15"]]);
});
it("totales de cuenta completos con 151 movimientos, lista paginada y aislamiento", async () => {
  const s = await setup(), other = await setup();
  await t.db.transaction.createMany({ data: Array.from({ length: 151 }, (_, i) => ({ workspaceId: s.ws, accountId: s.bank.id, type: "EXPENSE" as const, direction: "OUT" as const, amount: "10.25", currency: "ARS", categoryId: s.cat.id, description: `Compra ${i}`, economicPeriod: "2026-11", effectiveDate: today })) });
  const a = await accountActivity(t.db, s.ws, s.bank.id, today, 1), last = await accountActivity(t.db, s.ws, s.bank.id, today, 4);
  expect(a.outgoing.toString()).toBe("1547.75"); expect(a.movements).toHaveLength(50); expect(last.movements).toHaveLength(1); expect(a.total).toBe(151);
  expect(a.movements.some((x) => x.id === last.movements[0].id)).toBe(false);
  expect((await accountActivity(t.db, other.ws, s.bank.id, today)).total).toBe(0);
});
it("PDF e informe concilian reintegros y mes económico, y aíslan la cuenta", async () => {
  const s = await setup(), other = await setup();
  const tx = await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Compra", amount: "100", accountId: s.bank.id, categoryId: s.cat.id, status: "PAID", effectiveDate: today });
  await t.db.transaction.create({ data: { workspaceId: s.ws, accountId: s.bank.id, type: "EXPENSE", direction: "IN", amount: "20", currency: "ARS", categoryId: s.cat.id, description: "Devolución", economicPeriod: "2026-11", effectiveDate: new Date("2026-12-02") } });
  const pdf = (await monthlyReport(t.db, s.ws, "ARS", "2026-11", s.bank.id))!;
  expect(pdf.summary.totals[0].expense.toString()).toBe("80"); expect(pdf.movements).toHaveLength(2);
  expect(pdf.summary.totals[0].expense.toString()).toBe((await categoryReport(t.db, s.ws, "ARS", "2026-11", 1, s.bank.id)).totals[0].expense.toString());
  expect(await monthlyReport(t.db, other.ws, "ARS", "2026-11", s.bank.id)).toBeNull();
  await reverseTransaction(t.db, s.ws, tx.transactionId!);
  expect((await monthlyReport(t.db, s.ws, "ARS", "2026-11"))?.summary.totals[0].expense.toString()).toBe("-20");
});
it("Excel filtrado conserva mes económico, moneda y cuenta; exportación completa sigue disponible", async () => {
  const s = await setup();
  await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Noviembre", amount: "10", accountId: s.bank.id, status: "PAID", effectiveDate: today });
  await recordMovement(t.db, s.ws, { kind: "EXPENSE", description: "Octubre", amount: "20", accountId: s.bank.id, status: "PAID", effectiveDate: new Date("2026-10-15") });
  const filtered = readXlsx(Buffer.from(await exportMovementsXlsx(t.db, s.ws, { from: "2026-11", to: "2026-11", currency: "ARS", accountId: s.bank.id })));
  const full = readXlsx(Buffer.from(await exportMovementsXlsx(t.db, s.ws)));
  expect(filtered).toHaveLength(2); expect(full).toHaveLength(3); expect(filtered[1][1]).toBe("Noviembre");
});
it("historial del chat encuentra casos antiguos, pagina fechas iguales y no muestra casos ajenos", async () => {
  const s = await setup(), other = await setup();
  await t.db.contactMessage.createMany({ data: Array.from({ length: 36 }, (_, i) => ({ userId: s.user.id, code: `SG-AUDIT-${i}`, name: "Demo", email: s.user.email, subject: `Consulta ${i}`, area: "soporte", body: "Demostración", updatedAt: today })) });
  const actor = { user: s.user, visitorHash: null, ip: null };
  const one = await chatCasePage(t.db, actor), two = await chatCasePage(t.db, actor, { page: 2 });
  expect(one.total).toBe(36); expect(one.cases).toHaveLength(15); expect(two.cases).toHaveLength(15);
  expect(one.cases.some((x) => two.cases.some((y) => x.id === y.id))).toBe(false);
  expect((await chatCasePage(t.db, actor, { q: "Consulta 35" })).cases[0].subject).toBe("Consulta 35");
  expect((await chatCasePage(t.db, { user: other.user, visitorHash: null, ip: null })).total).toBe(0);
  expect((await chatCasePage(t.db, { user: null, visitorHash: "otro", ip: null })).total).toBe(0);
});
it("meses inválidos no pasan a consultas de fecha", () => {
  for (const value of ["2026-00", "2026-13", "2026-99", "hola", "2026-1", "2026-11-10"]) expect(validPeriod(value)).toBe(false);
  expect(validPeriod("2026-11")).toBe(true);
});
it("cálculos privados no revelan importes y rechazan otro usuario, espacio, alteración o vencimiento", () => {
  const values = { precio: "7499", cuotas: "12" }, now = Date.now();
  const token = sealSimulation(values, "u1", "ws1", now);
  expect(token).not.toContain("7499"); expect(openSimulation(token, "u1", "ws1", now)).toEqual(values);
  expect(openSimulation(token, "u2", "ws1", now)).toBeNull(); expect(openSimulation(token, "u1", "ws2", now)).toBeNull();
  expect(openSimulation(token.slice(0, -4) + "AAAA", "u1", "ws1", now)).toBeNull();
  expect(openSimulation(token, "u1", "ws1", now + 3600_001)).toBeNull();
});
it("simulación valida importes y rechaza cuotas pasadas y porcentajes fuera de rango", () => {
  const form = new FormData(); form.set("precio", "10.000"); form.set("cuotas", "6"); form.set("primera", "2026-12-01");
  expect(simulationParams(form, today).precio).toBe("10.000");
  form.set("primera", "2026-11-01"); expect(() => simulationParams(form, today)).toThrow(/primera cuota/);
  form.set("tab", "escenarios"); form.set("gastos", "Infinity"); expect(() => simulationParams(form, today)).toThrow(/gastos/);
});

it("una cuota parcial sin interés baja el capital y revertir el pago lo restaura", async () => {
  const s = await setup();
  const debt = await createDebt(t.db, s.ws, { creditor: "Demo", kind: "Personal", principal: "12000", currency: "ARS", system: "NO_INTEREST", installments: 3, startDate: today, firstDue: new Date("2026-11-20") });
  const before = (await debtDetail(t.db, s.ws, debt.id))!;
  const payment = await payObligation(t.db, s.ws, { obligationId: before.open[0].obligationId!, accountId: s.bank.id, amount: "1000", date: today });
  expect((await debtDetail(t.db, s.ws, debt.id))!.remainingCapital.toString()).toBe("11000");
  await reverseTransaction(t.db, s.ws, payment.transactionId!);
  expect((await debtDetail(t.db, s.ws, debt.id))!.remainingCapital.toString()).toBe("12000");
});

it("capital parcial con intereses queda estimado por la proporción del cronograma", async () => {
  const s = await setup();
  const debt = await createDebt(t.db, s.ws, { creditor: "Con intereses", kind: "Personal", principal: "12000", currency: "ARS", system: "FRENCH", installments: 3, tna: "120", startDate: today, firstDue: new Date("2026-11-20"), vatPct: "21" });
  const before = (await debtDetail(t.db, s.ws, debt.id))!;
  const half = before.open[0].total.dividedBy(2).toDecimalPlaces(2);
  await payObligation(t.db, s.ws, { obligationId: before.open[0].obligationId!, accountId: s.bank.id, amount: half, date: today });
  const after = (await debtDetail(t.db, s.ws, debt.id))!;
  expect(before.remainingCapital.minus(after.remainingCapital).toNumber()).toBeCloseTo(before.open[0].capital.dividedBy(2).toNumber(), 1);
  expect(after.futureSum.toNumber()).toBeCloseTo(before.futureSum.minus(half).toNumber(), 2);
});

it("abrir chat antes de montar el widget conserva una sola intención y el caso elegido", () => {
  vi.stubGlobal("window", new EventTarget());
  try {
    takeChatOpen(); requestChatOpen("SG-DEMO");
    expect(hasChatOpen()).toBe(true); expect(hasChatOpen()).toBe(true);
    expect(takeChatOpen()).toEqual({ code: "SG-DEMO" }); expect(takeChatOpen()).toBeNull();
    expect(hasChatOpen()).toBe(false);
    requestChatOpen(); expect(takeChatOpen()).toEqual({ code: undefined });
  } finally { vi.unstubAllGlobals(); }
});

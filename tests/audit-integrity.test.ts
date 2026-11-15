import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
const state = vi.hoisted(() => ({ db: null as unknown as PrismaClient }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({ getSession: async () => null }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "192.0.2.25" }) }));
import { contactAction } from "@/app/actions/contact";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { accountBalances, adjustBalance, createAccount, recordMovement, recordTransfer } from "@/server/ledger";
import { abandonedUnverified } from "@/server/email-verify";
import { createInvite } from "@/server/sharing";
import { insights } from "@/server/insights";
import { attachReferral, ensureReferralCode, rewardReferral } from "@/server/referrals";
import { applyReferralCredit } from "@/server/referral-credit";
import { createContactMessage } from "@/server/contact";
import { createGoal } from "@/server/planning";

let t: Awaited<ReturnType<typeof startTestDb>>, db: PrismaClient;
const day = new Date("2026-11-01T00:00:00Z");
beforeAll(async () => { t = await startTestDb(); db = t.db; state.db = db; });
afterAll(async () => { await t?.stop(); });
async function space(email: string, verified = false) {
  const u = await db.user.create({ data: { email, name: "Fixture", passwordHash: "x", emailVerified: verified ? new Date() : null } });
  const ws = await createWorkspaceForUser(db, u.id);
  return { u, ws };
}
const account = (ws: string, currency = "ARS") => createAccount(db, ws, { name: currency, type: "SAVINGS", currency, initialBalance: 0, initialDate: day });

it("AUD-01: no selecciona una cuenta financiera usada aunque esté inactiva y sin verificar", async () => {
  const { u, ws } = await space("history@audit.invalid");
  await db.user.update({ where: { id: u.id }, data: { createdAt: new Date(Date.now() - 70 * 864e5), lastSeenAt: new Date(Date.now() - 40 * 864e5) } });
  await account(ws.id);
  expect((await abandonedUnverified(db)).some((x) => x.id === u.id)).toBe(false);
  await db.user.update({ where: { id: u.id }, data: { lastSeenAt: null } });
  expect((await abandonedUnverified(db)).some((x) => x.id === u.id)).toBe(false);
});

it("AUD-02: dos conciliaciones simultáneas dejan el saldo pedido, sin duplicar", async () => {
  const { ws } = await space("balances@audit.invalid"), a = await account(ws.id);
  await Promise.all([1, 2].map(() => adjustBalance(db, ws.id, { accountId: a.id, targetBalance: 100, date: day })));
  expect((await accountBalances(db, ws.id)).get(a.id)?.toFixed(2)).toBe("100.00");
  expect(await db.transaction.count({ where: { workspaceId: ws.id, type: "ADJUSTMENT" } })).toBe(1);
  await Promise.all([
    adjustBalance(db, ws.id, { accountId: a.id, targetBalance: 100, date: day }),
    recordMovement(db, ws.id, { kind: "EXPENSE", description: "Concurrente", amount: 5, accountId: a.id, status: "PAID", effectiveDate: day }),
  ]);
  expect(["95.00", "100.00"]).toContain((await accountBalances(db, ws.id)).get(a.id)?.toFixed(2));
});

it("AUD-03: las invitaciones simultáneas reservan solo la última plaza", async () => {
  const { u, ws } = await space("owner@audit.invalid");
  await db.subscription.update({ where: { workspaceId: ws.id }, data: { plan: "PRO", status: "ACTIVE" } });
  for (let i = 0; i < 2; i++) await createInvite(db, ws.id, { email: `seed${i}@audit.invalid`, role: "VIEWER", invitedById: u.id });
  const results = await Promise.allSettled([2, 3].map((i) => createInvite(db, ws.id, { email: `parallel${i}@audit.invalid`, role: "VIEWER", invitedById: u.id })));
  expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(await db.workspaceInvite.count({ where: { workspaceId: ws.id } })).toBe(3);
});

it("AUD-04: requiere activación verificada y acredita ambos premios una sola vez", async () => {
  const a = await space("referrer@audit.invalid", true), b = await space("referred@audit.invalid");
  await attachReferral(db, b.u.id, await ensureReferralCode(db, a.u.id));
  expect((await rewardReferral(db, b.u.id)).rewarded).toBe(false);
  await db.user.update({ where: { id: b.u.id }, data: { emailVerified: new Date() } });
  expect((await rewardReferral(db, b.u.id)).rewarded).toBe(false);
  await db.workspace.update({ where: { id: b.ws.id }, data: { onboardedAt: new Date() } });
  const ac = await account(b.ws.id);
  await recordMovement(db, b.ws.id, { kind: "INCOME", description: "Activación", amount: 100, accountId: ac.id, status: "PAID", effectiveDate: day });
  const results = await Promise.all([rewardReferral(db, b.u.id), rewardReferral(db, b.u.id)]);
  expect(results.filter((x) => x.rewarded)).toHaveLength(1);
  const sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: a.ws.id } });
  expect(sub.plan).toBe("PRO");
  expect(sub.trialEndsAt!.getTime() - Date.now()).toBeGreaterThan(29 * 864e5);
  expect(sub.trialEndsAt!.getTime() - Date.now()).toBeLessThanOrEqual(30 * 864e5);
});

it("un premio con Pro pago se guarda sin cambiar el cobro y se aplica tras finalizarlo", async () => {
  const { ws } = await space("paid@audit.invalid");
  const end = new Date(Date.now() + 10 * 864e5);
  await db.subscription.update({ where: { workspaceId: ws.id }, data: { plan: "PRO", provider: "mercadopago", providerRef: "fixture", status: "ACTIVE", currentPeriodEnd: end } });
  await db.workspace.update({ where: { id: ws.id }, data: { referralCreditDays: 30 } });
  expect(await db.$transaction((tx) => applyReferralCredit(tx, ws.id))).toBe(false);
  expect((await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } })).currentPeriodEnd).toEqual(end);
  await db.subscription.update({ where: { workspaceId: ws.id }, data: { status: "CANCELED", currentPeriodEnd: day } });
  expect(await db.$transaction((tx) => applyReferralCredit(tx, ws.id))).toBe(true);
  expect((await db.workspace.findUniqueOrThrow({ where: { id: ws.id } })).referralCreditDays).toBe(0);
});

it("AUD-05: las alertas separan ARS y USD sin conversión ficticia", async () => {
  const { ws } = await space("currencies@audit.invalid");
  for (const currency of ["ARS", "USD"]) {
    const a = await account(ws.id, currency);
    await recordMovement(db, ws.id, { kind: "EXPENSE", description: currency, amount: 100, accountId: a.id, status: "PENDING", dueDate: day });
  }
  const list = await insights(db, ws.id, "ARS", new Date("2026-11-15T00:00:00Z"));
  const title = list.find((x) => x.kind === "late" && x.title.includes("pagos atrasados"))!.title;
  expect(title).toContain("ARS"); expect(title).toContain("USD"); expect(title).not.toContain("200");
});

it("AUD-06: el contacto rápido tiene registro y acuse durable; el honeypot no devuelve éxito", async () => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ area: "arrepentimiento", name: "Fixture", email: "contact@audit.invalid", subject: "Pedido de devolución", body: "Quiero solicitar la devolución", website: "", t: String(Date.now()) })) fd.set(k, v);
  const result = await contactAction(null, fd);
  expect(result?.code).toMatch(/^C-[A-HJ-NP-Z2-9]{6}$/);
  const message = await db.contactMessage.findUniqueOrThrow({ where: { code: result!.code! } });
  expect(await db.emailOutbox.count({ where: { dedupeKey: `contact/${message.id}/received` } })).toBe(1);
  fd.set("website", "robot");
  expect((await contactAction(null, fd))?.code).toBeUndefined();
});

it("el límite de consultas también se cumple ante peticiones simultáneas", async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => createContactMessage(db, { area: "soporte", name: "Fixture", email: "limits@audit.invalid", subject: "Consulta", body: "Consulta de prueba", ip: "192.0.2.99", userId: null })));
  expect(results.filter((x) => "message" in x)).toHaveLength(5);
  expect(await db.contactMessage.count({ where: { ip: "192.0.2.99" } })).toBe(5);
});

it("las altas concurrentes respetan los cupos de Gratis y vinculan el aporte al objetivo correcto", async () => {
  const { ws } = await space("quota@audit.invalid");
  for (let i = 0; i < 4; i++) await account(ws.id);
  const acc = await Promise.allSettled([account(ws.id), account(ws.id)]);
  expect(acc.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  const input = { target: 1000, currency: "ARS", targetDate: null, monthly: null, saved: 50, today: day };
  const goals = await Promise.allSettled(Array.from({ length: 4 }, (_, i) => createGoal(db, ws.id, { ...input, name: `Goal ${i}` })));
  expect(goals.filter((x) => x.status === "fulfilled")).toHaveLength(3);
  for (const result of goals) if (result.status === "fulfilled") expect(await db.goalContribution.count({ where: { goalId: result.value.id } })).toBe(1);
});

it("los reintentos concurrentes no duplican pendientes ni transferencias", async () => {
  const { ws } = await space("idem@audit.invalid"), a = await account(ws.id), b = await account(ws.id);
  const pending = { kind: "EXPENSE" as const, description: "Pendiente", amount: 100, accountId: a.id, status: "PENDING" as const, dueDate: day, idempotencyKey: "pending-once" };
  const results = await Promise.all([recordMovement(db, ws.id, pending), recordMovement(db, ws.id, pending)]);
  expect(results[0].obligationId).toBe(results[1].obligationId);
  expect(await db.obligation.count({ where: { workspaceId: ws.id } })).toBe(1);
  const transfer = { fromAccountId: a.id, toAccountId: b.id, amount: 50, date: day, idempotencyKey: "transfer-once" };
  const moved = await Promise.all([recordTransfer(db, ws.id, transfer), recordTransfer(db, ws.id, transfer)]);
  expect(moved[0].transferGroupId).toBe(moved[1].transferGroupId);
  expect(await db.transaction.count({ where: { workspaceId: ws.id, type: "TRANSFER" } })).toBe(2);
});

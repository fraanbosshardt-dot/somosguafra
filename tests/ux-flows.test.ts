import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { freeTrialAvailable, startFreeTrial } from "@/server/plans";
import { publicPlan } from "@/server/public-plan";
import { planSelectionHref } from "@/lib/plan-navigation";
import { reviewNextStep } from "@/lib/review-next-step";
import type { PrismaClient } from "@/generated/prisma/client";

const state = vi.hoisted(() => ({ db: undefined as PrismaClient | undefined, context: null as unknown }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ getDb: () => state.db }));
vi.mock("@/lib/auth/session", () => ({ requireWorkspace: async () => state.context }));
vi.mock("@/components/page", () => ({ PageHead: ({ title, guide }: { title: string; guide?: boolean }) => createElement("header", { "data-guide": String(guide) }, title) }));
import { ProGate } from "@/components/pro";
import MonthReview from "@/app/app/revision/page";
import Movements from "@/app/app/movimientos/page";

let t: Awaited<ReturnType<typeof startTestDb>>, seq = 0;
beforeAll(async () => { t = await startTestDb(); state.db = t.db; }, 60000);
afterAll(async () => { await t?.stop(); });
async function setup() {
  const user = await t.db.user.create({ data: { name: "Prueba UX", email: `ux-${seq++}@audit.invalid`, passwordHash: "fixture" } });
  const ws = await createWorkspaceForUser(t.db, user.id);
  const workspace = await t.db.workspace.findUniqueOrThrow({ where: { id: ws.id }, include: { subscription: true } });
  state.context = { workspace, membership: { role: "OWNER" } };
  return workspace;
}

it.each(["monthly", "yearly"] as const)("conserva la elección %s con solicitud existente sin crear otra", async cycle => {
  const ws = await setup(), now = new Date();
  const view = publicPlan(ws.subscription, true, now, { agreement: { status: "pending", cycle: "monthly", providerRef: "fixture", checkoutUrl: "https://example.invalid/fixture" } });
  const count = await t.db.billingAgreement.count();
  expect(new URL(planSelectionHref(view.canChoosePlan, cycle), "https://example.invalid").searchParams.get("ciclo")).toBe(cycle === "yearly" ? "anual" : "mensual");
  expect(await t.db.billingAgreement.count()).toBe(count);
  expect(planSelectionHref(false, cycle)).toBe("/app/configuracion?tab=plan");
});

it("la oferta del gate coincide con la elegibilidad real del trial y no abre una guía bloqueada", async () => {
  const ws = await setup();
  expect(await freeTrialAvailable(t.db, ws.id)).toBe(true);
  const available = renderToStaticMarkup(await ProGate({ title: "Costos", crumb: "Planificar", text: "Función Pro" }));
  expect(available).toContain("Probar gratis 14 días");
  expect(available).toContain('data-guide="false"');
  await t.db.billingAgreement.create({ data: { workspaceId: ws.id, cycle: "monthly", amount: 7499, currency: "ARS", status: "pending", providerRef: "fixture-trial-pending" } });
  expect(await freeTrialAvailable(t.db, ws.id)).toBe(false);
  expect(await startFreeTrial(t.db, ws.id)).toBe(false);
  const pending = renderToStaticMarkup(await ProGate({ title: "Costos", crumb: "Planificar", text: "Función Pro" }));
  expect(pending).not.toContain("Probar gratis 14 días");
  expect(pending).toContain("Ver mi plan");
  expect((await t.db.subscription.findUniqueOrThrow({ where: { workspaceId: ws.id } })).plan).toBe("FREE");
});

it("no ofrece trial a un lector, cuenta suspendida, prueba usada o contrato existente", async () => {
  const ws = await setup();
  state.context = { workspace: ws, membership: { role: "VIEWER" } };
  expect(renderToStaticMarkup(await ProGate({ title: "Costos", crumb: "Planificar", text: "Pro" }))).not.toContain("Probar gratis 14 días");
  await t.db.workspace.update({ where: { id: ws.id }, data: { billingDisabledAt: new Date() } });
  expect(await freeTrialAvailable(t.db, ws.id)).toBe(false);
  await t.db.workspace.update({ where: { id: ws.id }, data: { billingDisabledAt: null } });
  await t.db.subscription.update({ where: { workspaceId: ws.id }, data: { trialEndsAt: new Date("2026-01-01") } });
  expect(await freeTrialAvailable(t.db, ws.id)).toBe(false);
  await t.db.subscription.update({ where: { workspaceId: ws.id }, data: { trialEndsAt: null, provider: "mercadopago" } });
  expect(await freeTrialAvailable(t.db, ws.id)).toBe(false);
});

it("el siguiente paso conduce a la tarea pendiente respetando su prioridad", () => {
  const base = { accountCount: 1, overdue: 2, uncategorized: 3, month: "2026-11" };
  expect(reviewNextStep({ ...base, accountCount: 0 }).href).toBe("/app/cuentas?nueva=1");
  expect(reviewNextStep({ ...base, uncheckedId: "account" }).href).toBe("/app/cuentas/account");
  expect(reviewNextStep(base).href).toBe("/app/proximos#atrasados");
  expect(reviewNextStep({ ...base, overdue: 0 }).href).toContain("categoria=sin-categoria");
  expect(reviewNextStep({ ...base, overdue: 0, uncategorized: 0 }).href).toBe("/app/recurrentes");
});

it("la revisión excluye recurrentes terminadas y pausadas y no manda al resumen para crear una cuenta", async () => {
  const ws = await setup();
  const base = { workspaceId: ws.id, description: "Demostración", direction: "PAYABLE" as const, amount: 100, currency: "ARS", frequency: "MONTHLY" as const, startDate: new Date("2026-01-01") };
  await t.db.recurringRule.createMany({ data: [base, { ...base, endDate: new Date("2026-01-02") }, { ...base, pausedAt: new Date() }] });
  const markup = renderToStaticMarkup(await MonthReview());
  expect(markup).toContain("0 ingresos y 1 gasto que se repiten");
  expect(markup).toContain('href="/app/cuentas?nueva=1"');
  expect(markup).toContain("Agregar mi primera cuenta");
});

it("el filtro sin categoría respeta el mes económico y no convierte transferencias en gastos", async () => {
  const ws = await setup();
  const account = await t.db.account.create({ data: { workspaceId: ws.id, name: "Cuenta UX", type: "SAVINGS", currency: "ARS", initialBalance: 0, initialDate: new Date("2026-01-01") } });
  const category = await t.db.category.findFirstOrThrow({ where: { workspaceId: ws.id, kind: "EXPENSE" } });
  const base = { workspaceId: ws.id, accountId: account.id, type: "EXPENSE" as const, direction: "OUT" as const, amount: 100, currency: "ARS", effectiveDate: new Date("2026-12-01"), economicPeriod: "2026-11" };
  await t.db.transaction.createMany({ data: [
    { ...base, description: "Compra sin clasificar" },
    { ...base, description: "Compra clasificada", categoryId: category.id },
    { ...base, description: "Transferencia de prueba", type: "TRANSFER" },
  ] });
  const html = renderToStaticMarkup(await Movements({ searchParams: Promise.resolve({ mes: "2026-11", categoria: "sin-categoria" }) }));
  expect(html).toContain("Compra sin clasificar");
  expect(html).not.toContain("Compra clasificada");
  expect(html).not.toContain("Transferencia de prueba");
  const transfers = renderToStaticMarkup(await Movements({ searchParams: Promise.resolve({ mes: "2026-11", categoria: "sin-categoria", tipo: "TRANSFER" }) }));
  expect(transfers).not.toContain("Compra sin clasificar");
});

import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { startTestDb } from "./helpers/testdb";
import { arsConverter, overview, retention } from "@/server/admin-metrics";
import { adminBillingReport } from "@/server/admin-billing-report";
import { financeReport } from "@/server/company-finance";
import { supportPage } from "@/server/support-listing";
import { paymentLabel, subscriptionLabel } from "@/lib/payment-labels";
import { pageNumber } from "@/lib/pagination";

let t: Awaited<ReturnType<typeof startTestDb>>;
const now = new Date("2026-11-15T12:00:00Z"), day = 864e5;
beforeAll(async () => { t = await startTestDb(); });
afterEach(async () => { await t.db.paymentEvent.deleteMany(); await t.db.invoice.deleteMany(); await t.db.billingAgreement.deleteMany(); await t.db.workspace.deleteMany(); await t.db.user.deleteMany(); await t.db.appSetting.deleteMany(); });
afterAll(async () => { await t?.stop(); });

it("keeps MRR from the current contract when a newer incomplete checkout exists", async () => {
  const w = await t.db.workspace.create({ data: { name: "Fixture", subscription: { create: { provider: "mercadopago", providerRef: "current-contract", plan: "PRO", status: "ACTIVE", billingCycle: "monthly", currentPeriodEnd: new Date(now.getTime() + day) } } } });
  await t.db.invoice.create({ data: { workspaceId: w.id, provider: "mercadopago", providerRef: "paid-current", amount: 5000, currency: "ARS", status: "approved", paidAt: new Date(now.getTime() - day), periodStart: new Date(now.getTime() - day), periodEnd: new Date(now.getTime() + day) } });
  await t.db.billingAgreement.createMany({ data: [
    { workspaceId: w.id, providerRef: "current-contract", status: "authorized", amount: 5000, cycle: "monthly", createdAt: new Date(now.getTime() - day) },
    { workspaceId: w.id, providerRef: "incomplete-new", status: "pending", amount: 60000, cycle: "yearly", createdAt: now },
  ] });
  expect(await overview(t.db, { monthly: 9999, yearly: 99999 }, now)).toMatchObject({ paid: 1, mrr: 5000, mrrUnknown: 0, pending: 1 });
});

it("preserves archived revenue and churn cohort without counting a deleted account as paying", async () => {
  const w = await t.db.workspace.create({ data: { name: "Deleted fixture", archivedAt: now } });
  const invoice = await t.db.invoice.create({ data: { workspaceId: w.id, provider: "mercadopago", providerRef: "archived-history", amount: 1000, currency: "ARS", status: "approved", paidAt: new Date(now.getTime() - 40 * day), periodStart: new Date(now.getTime() - 40 * day), periodEnd: new Date(now.getTime() + day) } });
  await t.db.paymentEvent.create({ data: { invoiceId: invoice.id, key: "archive-gross", kind: "gross", amount: 1000, currency: "ARS", occurredAt: invoice.paidAt! } });
  expect(await overview(t.db, { monthly: 0, yearly: 0 }, now)).toMatchObject({ paid: 0, users: 0, startingPaid: 1, lostPaid: 1, churn: 100, conversion: 0 });
  const finance = await financeReport(t.db, now);
  expect(finance.months.reduce((n, m) => n + m.gross, 0)).toBe(1000);
});

it("counts subscriptions beyond the old 200-row boundary and paginates both histories", async () => {
  const ids = Array.from({ length: 201 }, (_, i) => `billing-fixture-${String(i).padStart(3, "0")}`);
  await t.db.workspace.createMany({ data: ids.map(id => ({ id, name: "Fixture" })) });
  await t.db.subscription.createMany({ data: ids.map(workspaceId => ({ workspaceId, provider: "mercadopago", status: "ACTIVE" as const, nextPaymentAt: new Date(now.getTime() + day) })) });
  await t.db.invoice.createMany({ data: ids.map((workspaceId, i) => ({ workspaceId, provider: "mercadopago", providerRef: `fixture-payment-${i}`, status: i === 200 ? "rejected" : "pending", amount: 1000, currency: "ARS", createdAt: now })) });
  const first = await adminBillingReport(t.db, 1, 1, now), last = await adminBillingReport(t.db, 5, 5, now);
  expect(first).toMatchObject({ active: 201, renewing: 201, rejected: 1, subTotal: 201, invoiceTotal: 201 });
  expect(first.subs).toHaveLength(50); expect(first.invoices).toHaveLength(50);
  expect(last.subs).toHaveLength(1); expect(last.invoices).toHaveLength(1);
  expect(new Set([...first.invoices, ...last.invoices].map(i => i.id)).size).toBe(51);
  expect((await financeReport(t.db, now, 5)).invoices).toHaveLength(1);
});

it("paginates support by priority before slicing instead of hiding urgent cases", async () => {
  const u = await t.db.user.create({ data: { email: "support@audit.invalid", name: "Fixture", passwordHash: "" } });
  await t.db.supportTicket.createMany({ data: Array.from({ length: 26 }, (_, i) => ({ userId: u.id, subject: `normal-${i}`, body: "Fixture", priority: "NORMAL", createdAt: new Date(now.getTime() - day) })) });
  const urgent = await t.db.supportTicket.create({ data: { userId: u.id, subject: "Urgent", body: "Fixture", priority: "HIGH", createdAt: now } });
  await t.db.supportTicket.create({ data: { userId: u.id, subject: "Low", body: "Fixture", priority: "LOW", createdAt: new Date(now.getTime() - 2 * day) } });
  const first = await supportPage(t.db, ["OPEN"], 1), second = await supportPage(t.db, ["OPEN"], 2);
  expect(first[0].id).toBe(urgent.id);
  expect(first).toHaveLength(25); expect(second).toHaveLength(3);
  expect(second.at(-1)?.priority).toBe("LOW");
  expect(new Set([...first, ...second].map(i => i.id)).size).toBe(28);
});

it("reads each required exchange rate once per report and keeps missing rates unknown", async () => {
  const findFirst = vi.fn(async ({ where }: { where: { quote: string } }) => where.quote === "ARS" ? { sell: 1000 } : where.quote === "EUR" ? { sell: 0.8 } : null);
  const convert = await arsConverter({ exchangeRate: { findFirst } } as unknown as PrismaClient, ["ARS", "EUR", "EUR", "USD", "CAD"]);
  expect(findFirst).toHaveBeenCalledTimes(3); // USD is the numeraire and needs no query.
  expect(convert(100, "EUR")).toBe(125000); expect(convert(100, "USD")).toBe(100000);
  expect(convert(100, "CAD")).toBeNull(); expect(convert(100, "ARS")).toBe(100);
});

it("does not describe pending payments as rejected and rejects unsafe page offsets", () => {
  expect(paymentLabel("pending")).toBe("Pendiente"); expect(paymentLabel("charged_back")).toBe("Contracargo");
  expect(paymentLabel("unknown-provider-state")).toBe("En verificación"); expect(subscriptionLabel("TRIALING")).toBe("Período gratuito");
  for (const input of ["-1", "NaN", "Infinity", "2.5", undefined]) expect(pageNumber(input)).toBe(1);
  expect(pageNumber("2")).toBe(2); expect(pageNumber("99999999")).toBe(1000000);
});

it("retention counts exact eligible cohort days after activity is deduplicated", async () => {
  await t.db.appSetting.create({ data: { key: "analyticsStartedAt", value: "2026-10-01T00:00:00Z" } });
  const u = await t.db.user.create({ data: { email: "retention@audit.invalid", name: "Fixture", passwordHash: "", createdAt: new Date("2026-11-01T12:00:00Z") } });
  await t.db.workspace.create({ data: { name: "Fixture", members: { create: { userId: u.id, role: "OWNER" } } } });
  await t.db.productActivity.createMany({ data: [{ userId: u.id, day: new Date("2026-11-08T00:00:00Z") }, { userId: u.id, day: new Date("2026-11-09T00:00:00Z") }] });
  expect((await retention(t.db, now))[0]).toMatchObject({ days: 7, eligible: 1, returned: 1, rate: 100 });
});

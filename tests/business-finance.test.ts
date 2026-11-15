import { afterAll, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { overview, revenueByMonth } from "@/server/admin-metrics";
import { paymentFinancialFields, recordPaymentEvents } from "@/server/payment-finance";
import { financeReport } from "@/server/company-finance";
import { queueAccessNotices, validAccessNotice } from "@/server/access-notices";
import { recordProductActivity } from "@/server/product-activity";
let t: Awaited<ReturnType<typeof startTestDb>>;
const now = new Date("2026-11-15T12:00:00Z"), day = 864e5;
let seq = 0;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); });
async function space() { const u = await t.db.user.create({ data: { email: `biz${++seq}@audit.invalid`, name: "Fixture", passwordHash: "", emailVerified: now } }); return createWorkspaceForUser(t.db, u.id); }
it("concurrent activity tracking never rejects duplicate days and uses the Argentina calendar", async () => {
  await Promise.all(Array.from({ length: 12 }, () => recordProductActivity(t.db, "fixture-tracking", new Date("2026-11-15T01:00Z"))));
  const rows = await t.db.productActivity.findMany({ where: { userId: "fixture-tracking" } });
  expect(rows).toHaveLength(1);
  expect(rows[0].day.toISOString()).toBe("2026-11-14T00:00:00.000Z");
});
it("abandoned attempts are not churn and a trial with ACTIVE status is still a trial", async () => {
  const w = await space();
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { plan: "PRO", status: "ACTIVE", provider: "manual", trialEndsAt: new Date(now.getTime() + day) } });
  const canceled = await space();
  await t.db.subscription.update({ where: { workspaceId: canceled.id }, data: { provider: "mercadopago", status: "CANCELED", canceledAt: now } });
  const o = await overview(t.db, { monthly: 99999, yearly: 999999 }, now);
  expect(o).toMatchObject({ paid: 0, churn: null, startingPaid: 0, trials: 1 });
});
it("paid coverage survives cancellation and MRR uses the agreed price, not the catalog", async () => {
  const w = await space(); const start = new Date(now.getTime() - 40 * day), end = new Date(now.getTime() + day);
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { provider: "mercadopago", providerRef: "biz-contract", plan: "PRO", status: "CANCELED", currentPeriodEnd: end, canceledAt: now } });
  await t.db.invoice.create({ data: { workspaceId: w.id, provider: "mercadopago", providerRef: "biz-invoice", status: "approved", amount: 5000, currency: "ARS", paidAt: start, periodStart: start, periodEnd: end } });
  let o = await overview(t.db, { monthly: 99999, yearly: 999999 }, now);
  expect(o).toMatchObject({ paid: 1, startingPaid: 1, lostPaid: 0, churn: 0, renewalOff: 1, mrr: 0 });
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { status: "ACTIVE" } });
  await t.db.billingAgreement.create({ data: { workspaceId: w.id, providerRef: "biz-contract", cycle: "yearly", status: "authorized", amount: 60000 } });
  o = await overview(t.db, { monthly: 99999, yearly: 999999 }, now);
  expect(o.mrr).toBe(5000);
  await t.db.workspace.update({ where: { id: w.id }, data: { excludeFromMetrics: true } });
  expect((await overview(t.db, { monthly: 99999, yearly: 999999 }, now)).paid).toBe(0);
});
it("approved gross stays in its month and a later refund is recorded once in its own month", async () => {
  const w = await space(); const paidAt = new Date("2026-10-12T12:00Z");
  let i = await t.db.invoice.create({ data: { workspaceId: w.id, provider: "mercadopago", providerRef: "refund-history", status: "approved", amount: 7499, currency: "ARS", paidAt, netAmount: "7176.54", releaseStatus: "released" } });
  await t.db.$transaction(tx => recordPaymentEvents(tx, i, now));
  i = await t.db.invoice.update({ where: { id: i.id }, data: { status: "refunded", refundedAmount: 7499, providerUpdatedAt: now } });
  await t.db.$transaction(tx => recordPaymentEvents(tx, i, now));
  await t.db.$transaction(tx => recordPaymentEvents(tx, i, now));
  expect(await t.db.paymentEvent.count({ where: { invoiceId: i.id } })).toBe(2);
  const r = await revenueByMonth(t.db, 6, now);
  expect(r.find(m => m.key === "2026-10")?.n).toBe(7499);
  expect(r.find(m => m.key === "2026-11")?.n).toBe(-7499);
  const report = await financeReport(t.db, now);
  expect(report.months.find(m => m.key === "2026-10")?.gross).toBe(7499);
  expect(report.months.find(m => m.key === "2026-11")?.reversed).toBe(7499);
});
it("missing provider net is unknown, and reported net is never reduced twice", () => {
  const p = { id: "fixture", status: "approved", transaction_amount: 7499, currency_id: "ARS" };
  expect(paymentFinancialFields(p).netAmount).toBeUndefined();
  const fields = paymentFinancialFields({ ...p, transaction_details: { net_received_amount: 7176.54 }, fee_details: [{ amount: 322.46, type: "mercadopago_fee" }], money_release_date: "2026-12-03T12:00Z" });
  expect(fields).toMatchObject({ netAmount: "7176.54", feeAmount: "322.46", releaseAt: new Date("2026-12-03T12:00Z") });
});
it("a provider-confirmed chargeback recovery is a new event and preserves the original history", async () => {
  const w = await space();
  let invoice = await t.db.invoice.create({ data: { workspaceId: w.id, provider: "mercadopago", providerRef: "chargeback-recovery", status: "approved", amount: 1000, currency: "ARS", paidAt: now } });
  await t.db.$transaction(tx => recordPaymentEvents(tx, invoice, now));
  invoice = await t.db.invoice.update({ where: { id: invoice.id }, data: { status: "charged_back", providerUpdatedAt: new Date(now.getTime() + 1000) } });
  await t.db.$transaction(tx => recordPaymentEvents(tx, invoice, now));
  invoice = await t.db.invoice.update({ where: { id: invoice.id }, data: { status: "approved", providerUpdatedAt: new Date(now.getTime() + 2000) } });
  await t.db.$transaction(tx => recordPaymentEvents(tx, invoice, now));
  await t.db.$transaction(tx => recordPaymentEvents(tx, invoice, now));
  const events = await t.db.paymentEvent.findMany({ where: { invoiceId: invoice.id }, orderBy: { occurredAt: "asc" } });
  expect(events.map(e => e.kind)).toEqual(["gross", "chargeback", "recovery"]);
  expect(events.map(e => Number(e.amount))).toEqual([1000, 1000, 1000]);
});
it("a service expiry notice is deduplicated and suppressed after conversion", async () => {
  const w = await space();
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { plan: "PRO", status: "TRIALING", trialEndsAt: new Date(now.getTime() + 3600e3) } });
  await queueAccessNotices(t.db, now); await queueAccessNotices(t.db, now);
  const rows = await t.db.emailOutbox.findMany({ where: { workspaceId: w.id } });
  expect(rows).toHaveLength(1); expect(await validAccessNotice(t.db, rows[0].dedupeKey, now)).toBe(true);
  await t.db.billingAgreement.create({ data: { workspaceId: w.id, providerRef: "converted-notice", cycle: "monthly", status: "authorized", amount: 7499 } });
  expect(await validAccessNotice(t.db, rows[0].dedupeKey, now)).toBe(false);
});

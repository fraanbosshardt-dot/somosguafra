import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { runBillingMaintenance } from "@/server/billing-maintenance";
import { operationsSnapshot } from "@/server/operations";
import { cronAuthorized } from "@/lib/cron-auth";
let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); });
afterEach(() => { delete process.env.CRON_SECRET; });
it("una ejecución simultánea respeta el arrendamiento y una vencida se recupera", async () => {
  await t.db.jobLease.create({ data: { key: "billing-maintenance", token: "other", expiresAt: new Date(Date.now() + 60_000) } });
  expect((await runBillingMaintenance(t.db)).skipped).toBe(true);
  await t.db.jobLease.update({ where: { key: "billing-maintenance" }, data: { expiresAt: new Date(Date.now() - 1) } });
  expect((await runBillingMaintenance(t.db)).skipped).toBe(false);
  expect(await t.db.jobLease.count()).toBe(0);
  expect((await operationsSnapshot(t.db)).ok).toBe(true);
});
it("solo acepta la clave configurada y rechaza cabeceras de longitudes inválidas", () => {
  const request = (auth: string) => new Request("https://example.invalid/", { headers: { authorization: auth } });
  expect(cronAuthorized(request("Bearer abc"))).toBe(false);
  process.env.CRON_SECRET = "abc";
  expect(cronAuthorized(request("Bearer abc"))).toBe(true);
  expect(cronAuthorized(request("Bearer xyz"))).toBe(false);
  expect(cronAuthorized(request("Bearer ábc"))).toBe(false);
});
it("detecta un pago sin acceso aunque aparezca después de las primeras mil facturas", async () => {
  const now = new Date(), end = new Date(now.getTime() + 864e5);
  const ids = Array.from({ length: 1001 }, (_, i) => `operations-fixture-${String(i).padStart(4, "0")}`);
  await t.db.workspace.createMany({ data: ids.map(id => ({ id, name: "Fixture" })) });
  await t.db.subscription.createMany({ data: ids.map((workspaceId, i) => ({ workspaceId, plan: i === 1000 ? "FREE" : "PRO", status: "ACTIVE", provider: "manual" })) });
  await t.db.invoice.createMany({ data: ids.map((workspaceId, i) => ({ id: `operations-invoice-${i}`, workspaceId, provider: "fixture", providerRef: `operations-provider-${i}`, amount: 1, currency: "ARS", status: "approved", periodEnd: end })) });
  expect((await operationsSnapshot(t.db, now)).paidWithoutAccess).toBe(1);
});

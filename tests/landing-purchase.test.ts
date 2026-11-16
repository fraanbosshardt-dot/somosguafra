import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { startTestDb } from "./helpers/testdb";
import { createWorkspaceForUser } from "@/server/workspace";
import { landingPurchase, PLAN_PAGE } from "@/server/landing-purchase";
import { readPurchaseIntent, signPurchaseIntent } from "@/server/purchase-intent";
const remote = vi.hoisted(() => ({ checkout: vi.fn(async (..._args: unknown[]) => "https://www.mercadopago.com.ar/checkout-fixture") }));
vi.mock("@/server/billing", () => ({ startCheckout: remote.checkout }));
let t: Awaited<ReturnType<typeof startTestDb>>, seq = 0;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t?.stop(); vi.unstubAllEnvs(); });
beforeEach(() => { remote.checkout.mockClear(); vi.stubEnv("AUTH_SECRET", "synthetic-purchase-key-minimum-32-characters"); });
async function account() {
  const u = await t.db.user.create({ data: { email: `landing${++seq}@audit.invalid`, name: "Fixture", passwordHash: "", emailVerified: new Date() } });
  return { u, w: await createWorkspaceForUser(t.db, u.id) };
}
const intent = (cycle: "monthly" | "yearly" = "yearly") => ({ cycle, amount: cycle === "yearly" ? 74990 : 7499, expires: Date.now() + 10000 });
const run = (id: string, cycle: "monthly" | "yearly" = "yearly") => landingPurchase(t.db, id, intent(cycle), "https://example.invalid");
it("signed intent preserves the selected annual quote and rejects tampering, expiry and wrong secret", () => {
  const signed = signPurchaseIntent("yearly", 74990);
  expect(readPurchaseIntent(signed)).toMatchObject({ cycle: "yearly", amount: 74990 });
  expect(readPurchaseIntent(signed + ".extra")).toBeNull();
  expect(readPurchaseIntent(signed, Date.now() + 1800001)).toBeNull();
  vi.stubEnv("AUTH_SECRET", "another-synthetic-key-minimum-32-characters");
  expect(readPurchaseIntent(signed)).toBeNull();
});
it.each(["monthly", "yearly"] as const)("a verified free owner goes directly to the single checkout using the %s quote", async cycle => {
  const { u, w } = await account();
  expect(await run(u.id, cycle)).toContain("mercadopago");
  expect(remote.checkout).toHaveBeenCalledTimes(1);
  expect(remote.checkout.mock.calls[0]).toEqual([t.db, w.id, u.email, cycle, `https://example.invalid/pagos/volver?espacio=${w.id}`, undefined, null, undefined, intent(cycle).amount]);
});
it("a trial without a contract can buy either cycle while preserving its final date", async () => {
  const { u, w } = await account(); const end = new Date(Date.now() + 864e5);
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { plan: "PRO", status: "TRIALING", trialEndsAt: end } });
  await run(u.id);
  expect(remote.checkout.mock.calls[0][6]).toEqual(end);
});
it.each(["creating", "uncertain", "pending", "authorized", "paused"])("a %s agreement opens Mi plan without creating or replacing any checkout", async status => {
  const { u, w } = await account();
  await t.db.billingAgreement.create({ data: { workspaceId: w.id, cycle: "monthly", amount: 7499, status, providerRef: `${w.id}-remote`, checkoutUrl: "https://www.mercadopago.com.ar/original" } });
  expect(await run(u.id, "yearly")).toBe(PLAN_PAGE);
  expect(remote.checkout).not.toHaveBeenCalled();
});
it("a pending payment remains in Mi plan even without a local active agreement", async () => {
  const { u, w } = await account();
  await t.db.invoice.create({ data: { workspaceId: w.id, provider: "mercadopago", providerRef: `${w.id}-invoice`, status: "in_process", amount: 7499, currency: "ARS" } });
  expect(await run(u.id)).toBe(PLAN_PAGE); expect(remote.checkout).not.toHaveBeenCalled();
});
it("a canceled but covered account returns to the app; after expiry it can contract again", async () => {
  const { u, w } = await account();
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { plan: "PRO", status: "CANCELED", provider: "mercadopago", providerRef: "previous", currentPeriodEnd: new Date(Date.now() + 864e5) } });
  expect(await run(u.id)).toBe("/app"); expect(remote.checkout).not.toHaveBeenCalled();
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { currentPeriodEnd: new Date(Date.now() - 1) } });
  expect(await run(u.id)).toContain("mercadopago");
});
it("an active subscription with a rejected renewal cannot create a new subscription", async () => {
  const { u, w } = await account();
  await t.db.subscription.update({ where: { workspaceId: w.id }, data: { plan: "PRO", status: "PAST_DUE", provider: "mercadopago", providerRef: "current" } });
  expect(await run(u.id)).toBe(PLAN_PAGE); expect(remote.checkout).not.toHaveBeenCalled();
});
it("archived workspaces and non-owners cannot start a checkout", async () => {
  const { u, w } = await account();
  await t.db.membership.updateMany({ where: { userId: u.id }, data: { role: "VIEWER" } });
  expect(await run(u.id)).toBe(PLAN_PAGE);
  await t.db.membership.updateMany({ where: { userId: u.id }, data: { role: "OWNER" } });
  await t.db.workspace.update({ where: { id: w.id }, data: { archivedAt: new Date() } });
  expect(await run(u.id)).toBe(PLAN_PAGE); expect(remote.checkout).not.toHaveBeenCalled();
});

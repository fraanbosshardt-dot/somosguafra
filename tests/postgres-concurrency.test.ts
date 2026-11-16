import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { assertLocalRestore } from "@/lib/backup";
import { reserveSecurityAttempt } from "@/server/security-limits";
import { createWorkspaceForUser } from "@/server/workspace";
import { startCheckout } from "@/server/billing";
// Optional locally, mandatory in CI (isolated PostgreSQL service). Never accept a remote database.
const url = process.env.TEST_DATABASE_URL;
let clients: PrismaClient[] = [];
const scope = `ci-${randomUUID()}`;
beforeAll(async () => {
  if (!url) return;
  assertLocalRestore(url);
  if (!new URL(url).pathname.endsWith("_test")) throw Error("La base de pruebas debe terminar en _test.");
  clients = [1, 2].map(() => new PrismaClient({ adapter: new PrismaPg({ connectionString: url, max: 3 }) }));
  if (await clients[0].user.count() || await clients[0].workspace.count()) throw Error("Las pruebas necesitan una base local nueva y sin usuarios. No se modificó ningún dato.");
});
afterAll(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await Promise.all(clients.map(c => c.$disconnect())); });
it.skipIf(!url)("independent PostgreSQL pools enforce the shared quota during concurrent requests", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) => reserveSecurityAttempt(clients[i % 2], scope, [{ key: "same-user", limit: 5, windowMs: 60_000 }])));
  expect(results.filter(Boolean)).toHaveLength(5);
});
it.skipIf(!url)("independent pools create only one remote checkout reservation", async () => {
  const [db, other] = clients;
  const u = await db.user.create({ data: { email: `${scope}@audit.invalid`, name: "Fixture", passwordHash: "" } });
  const w = await createWorkspaceForUser(db, u.id);
  await db.appSetting.upsert({ where: { key: "plans" }, create: { key: "plans", value: { pricesArs: { monthly: 7499, yearly: 74990 } } }, update: { value: { pricesArs: { monthly: 7499, yearly: 74990 } } } });
  vi.stubEnv("MP_ACCESS_TOKEN", "mock-only"); vi.stubEnv("MP_WEBHOOK_SECRET", "mock-only");
  let posts = 0; let contract: Record<string, unknown> | null = null;
  vi.stubGlobal("fetch", vi.fn(async (input: string, options?: RequestInit) => {
    const path = new URL(input).pathname;
    if (path === "/preapproval" && options?.method === "POST") {
      posts++; await new Promise(r => setTimeout(r, 50));
      contract = { ...JSON.parse(String(options.body)), id: `${scope}-contract`, init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${scope}` };
      return Response.json(contract);
    }
    if (path === `/preapproval/${scope}-contract` && contract) return Response.json(contract);
    throw Error("Real network is forbidden in this test");
  }));
  const results = await Promise.allSettled([db, other].map(c => startCheckout(c, w.id, u.email, "monthly", "https://example.invalid/return")));
  expect(results.some(r => r.status === "fulfilled")).toBe(true);
  expect(posts).toBe(1);
  expect(await db.billingAgreement.count({ where: { workspaceId: w.id } })).toBe(1);
});

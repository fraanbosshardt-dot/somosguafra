import { randomUUID } from "node:crypto";
import type { Db } from "./ledger";
import { reconcileBilling } from "./billing";
import { drainEmailOutbox } from "./billing-mail";

export async function runBillingMaintenance(db: Db) {
  const key = "billing-maintenance", token = randomUUID(), now = new Date();
  const expires = new Date(now.getTime() + 180_000);
  const acquired = await db.$queryRaw<{ key: string }[]>`INSERT INTO "JobLease" ("key", "token", "expiresAt") VALUES (${key}, ${token}, ${expires}) ON CONFLICT ("key") DO UPDATE SET "token" = EXCLUDED."token", "expiresAt" = EXCLUDED."expiresAt" WHERE "JobLease"."expiresAt" <= ${now} RETURNING "key"`;
  if (!acquired.length) return { ok: true, skipped: true, billing: 0, delivered: 0, errors: 0 };
  try {
    const billing = await reconcileBilling(db, 40, 60_000);
    const { queueAccessNotices } = await import("./access-notices");
    await queueAccessNotices(db);
    const delivered = await drainEmailOutbox(db, 100, 30_000);
    const errors = await db.auditLog.count({ where: { action: "billing.reconcile_failed", createdAt: { gte: now } } });
    await db.auditLog.create({ data: { action: errors ? "cron.cobros_partial" : "cron.cobros", meta: { billing, delivered, errors, durationMs: Date.now() - now.getTime() } } });
    return { ok: errors === 0, skipped: false, billing, delivered, errors };
  } catch (e) {
    await db.auditLog.create({ data: { action: "cron.cobros_failed", meta: { error: String(e).slice(0, 300) } } }).catch(() => {});
    throw e;
  } finally {
    await db.jobLease.deleteMany({ where: { key, token } });
  }
}

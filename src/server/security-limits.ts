import { createHash } from "node:crypto";
import type { Db } from "./ledger";

type Bucket = { key: string; limit: number; windowMs: number };
// Reserva antes de hacer trabajo costoso o enviar un correo. Todos los procesos
// comparten bloqueos PostgreSQL y el mismo registro; no depende de memoria local.
export async function reserveSecurityAttempt(db: Db, scope: string, buckets: Bucket[], now = new Date()) {
  const entries = buckets.map(b => ({ ...b, hash: createHash("sha256").update(`${scope}:${b.key}`).digest("hex") })).sort((a, b) => a.hash.localeCompare(b.hash));
  return db.$transaction(async tx => {
    for (const b of entries) await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtext(${`security:${b.hash}`}))`;
    for (const b of entries) {
      const used = await tx.auditLog.count({ where: { action: `security.rate.${scope}`, entityId: b.hash, createdAt: { gt: new Date(now.getTime() - b.windowMs) } } });
      if (used >= b.limit) return false;
    }
    await tx.auditLog.createMany({ data: entries.map(b => ({ action: `security.rate.${scope}`, entityId: b.hash, createdAt: now })) });
    return true;
  });
}

export const quarterHour = 15 * 60_000;
export function authBuckets(identity: string, ip: string | null, limit: number, ipLimit: number, windowMs = quarterHour) {
  return [{ key: `identity:${identity}`, limit, windowMs }, ...(ip ? [{ key: `ip:${ip}`, limit: ipLimit, windowMs }] : [])];
}

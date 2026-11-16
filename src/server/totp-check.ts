import { createHash } from "node:crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { decryptSecret } from "@/lib/crypto";
import type { Db } from "./ledger";

// Un código válido solo sirve una vez aunque lleguen varias solicitudes o sesiones.
// Nunca se guarda el código ni el secreto descifrado en la auditoría.
export async function consumeTotp(db: Db, userId: string, code: string, now = Date.now()) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { totpSecretEnc: true, deletedAt: true, suspendedAt: true } });
    if (!user?.totpSecretEnc || user.deletedAt || user.suspendedAt) return false;
    const secret = decryptSecret(user.totpSecretEnc);
    const counters = [-1, 0, 1].map(w => Math.floor(now / 30_000) + w).filter(counter => verifyTotp(secret, code, counter * 30_000, 0));
    if (!counters.length) return false;
    const keys = counters.map(c => createHash("sha256").update(`${userId}:${secret}:${c}`).digest("hex"));
    if (await tx.auditLog.count({ where: { action: "auth.totp_consumed", entityId: { in: keys } } })) return false;
    await tx.auditLog.createMany({ data: keys.map(entityId => ({ action: "auth.totp_consumed", userId, entityId, createdAt: new Date(now) })) });
    return true;
  });
}

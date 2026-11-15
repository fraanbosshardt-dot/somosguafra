import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";

const digest = (userId: string, code: string) => createHash("sha256").update(`${userId}:${code.toLowerCase().replace(/[\s-]/g, "")}`).digest("hex");

// Solo se muestran una vez. La base conserva hashes, nunca los códigos utilizables.
export async function replaceRecoveryCodes(db: PrismaClient, userId: string) {
  const codes = Array.from({ length: 8 }, () => randomBytes(10).toString("hex").match(/.{5}/g)!.join("-"));
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.totpEnabledAt || user.deletedAt || user.suspendedAt) throw new Error("Activá la verificación en dos pasos primero.");
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.recoveryCode.createMany({ data: codes.map((code) => ({ userId, tokenHash: digest(userId, code) })) });
    await tx.auditLog.create({ data: { userId, action: "auth.recovery_codes_replaced" } });
  });
  return codes;
}

export async function consumeRecoveryCode(db: PrismaClient, userId: string, code: string) {
  if (!/^[a-f0-9]{20}$/.test(code.toLowerCase().replace(/[\s-]/g, ""))) return false;
  const result = await db.recoveryCode.updateMany({ where: { userId, tokenHash: digest(userId, code), usedAt: null }, data: { usedAt: new Date() } });
  return result.count === 1;
}

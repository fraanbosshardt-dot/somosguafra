"use server";
import { revalidatePath } from "next/cache";
import { requireUser, audit } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/crypto";
import { verifyTotp } from "@/lib/auth/totp";
import { getDb } from "@/lib/db";
import { replaceRecoveryCodes } from "@/server/recovery-codes";

export type RecoveryState = { error?: string; codes?: string[] } | null;
export async function generateRecoveryCodesAction(_: RecoveryState, fd: FormData): Promise<RecoveryState> {
  const { user } = await requireUser();
  if (!user.totpEnabledAt || !user.totpSecretEnc) return { error: "Activá primero la verificación en dos pasos." };
  const db = getDb();
  if (await db.auditLog.count({ where: { userId: user.id, action: "auth.2fa_failed", createdAt: { gt: new Date(Date.now() - 900_000) } } }) >= 5) return { error: "Demasiados intentos. Probá en 15 minutos." };
  if (!verifyTotp(decryptSecret(user.totpSecretEnc), String(fd.get("code") ?? ""))) {
    await audit("auth.2fa_failed", { userId: user.id });
    return { error: "Escribí el código actual de tu app de autenticación." };
  }
  const codes = await replaceRecoveryCodes(db, user.id);
  revalidatePath("/app/configuracion");
  return { codes };
}

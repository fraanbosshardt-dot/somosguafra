"use server";
import { revalidatePath } from "next/cache";
import { requireUser, audit } from "@/lib/auth/session";
import { consumeTotp } from "@/server/totp-check";
import { getDb } from "@/lib/db";
import { replaceRecoveryCodes } from "@/server/recovery-codes";
import { quarterHour, reserveSecurityAttempt } from "@/server/security-limits";

export type RecoveryState = { error?: string; codes?: string[] } | null;
export async function generateRecoveryCodesAction(_: RecoveryState, fd: FormData): Promise<RecoveryState> {
  const { user, session } = await requireUser();
  if (!user.totpEnabledAt || !user.totpSecretEnc) return { error: "Activá primero la verificación en dos pasos." };
  const db = getDb();
  if (Date.now() - session.createdAt.getTime() > quarterHour) return { error: "Por seguridad, cerrá sesión e ingresá de nuevo antes de generar códigos de recuperación." };
  if (!(await reserveSecurityAttempt(db, "twofactor", [{ key: user.id, limit: 5, windowMs: quarterHour }]))) return { error: "Demasiados intentos. Probá en 15 minutos." };
  if (!(await consumeTotp(db, user.id, String(fd.get("code") ?? "")))) {
    await audit("auth.2fa_failed", { userId: user.id });
    return { error: "Escribí un código nuevo y válido de tu app de autenticación." };
  }
  const codes = await replaceRecoveryCodes(db, user.id);
  revalidatePath("/app/configuracion");
  return { codes };
}

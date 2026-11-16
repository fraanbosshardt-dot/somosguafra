"use server";
import { reportError } from "@/lib/diagnostics";
import { TERMS_VERSION } from "@/lib/brand";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { audit, createSession, destroySession, getSession, landingPath, markTwoFactorVerified } from "@/lib/auth/session";
import { consumeTotp } from "@/server/totp-check";
import { createUserWithWorkspace, ensureUserWorkspace } from "@/server/workspace";
import { authBuckets, quarterHour, reserveSecurityAttempt } from "@/server/security-limits";

export type FormState = { error?: string; ok?: string } | null;

const email = z.string().trim().toLowerCase().email("Revisá el correo: falta algo, como la @.").max(200);

// Si llegó con el link de alguien (?ref=), se anota quién lo invitó. Nunca frena el registro.
async function linkReferral(userId: string) {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    const { attachReferral, REF_COOKIE } = await import("@/server/referrals");
    const code = jar.get(REF_COOKIE)?.value;
    if (code) { await attachReferral(getDb(), userId, code); jar.delete(REF_COOKIE); }
  } catch (e) { reportError("referido", e); }
}

export async function signupAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z
    .object({ name: z.string().trim().min(1, "Decinos cómo te llamamos.").max(80), email, password: z.string(), terms: z.literal("on", { error: "Para seguir, aceptá los términos y la política de privacidad." }) })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const problem = passwordProblem(parsed.data.password);
  if (problem) return { error: problem };
  const db = getDb();
  const { headers } = await import("next/headers");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim();
  if (!(await reserveSecurityAttempt(db, "signup", authBuckets(parsed.data.email, ip ?? null, 3, 10, 3600_000)))) return { error: "Se crearon muchas cuentas desde esta conexión. Probá de nuevo en una hora." };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: "Ya hay una cuenta con ese correo. Iniciá sesión." };
  let created;
  try { created = await createUserWithWorkspace(db, { email: parsed.data.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password), termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, termsChannel: "email" }); }
  catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Ya hay una cuenta con ese correo. Iniciá sesión." };
    throw e;
  }
  const { user, workspace: ws } = created;
  await audit("auth.signup", { userId: user.id, workspaceId: ws.id, meta: { via: "email" } });
  await linkReferral(user.id);
  const { applyProGrant } = await import("@/server/grants");
  await applyProGrant(db, user.email, ws.id);
  await createSession(user.id, { twoFactorVerified: true, remember: true });
  try { const { sendVerifyEmail } = await import("@/server/account-mail"); await sendVerifyEmail(user, true); } catch (e) { reportError("confirmar correo", e); }
  redirect(await landingPath("/bienvenida"));
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = z.object({ email, password: z.string().min(1, "Escribí tu contraseña.").max(200, "La contraseña es demasiado larga.") }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = getDb();
  const { headers } = await import("next/headers");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  if (!(await reserveSecurityAttempt(db, "login", authBuckets(parsed.data.email, ip, 8, 30)))) return { error: "Demasiados intentos. Probá de nuevo en 15 minutos." };
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  const ok = user && !user.deletedAt && !user.suspendedAt && (await verifyPassword(parsed.data.password, user.passwordHash));
  if (user && !user.deletedAt && !user.passwordHash && user.googleSub) return { error: "Esta cuenta entra con Google. Tocá «Continuar con Google»." };
  if (!user || !ok) {
    await audit("auth.login_failed", { entity: "email", entityId: parsed.data.email });
    return { error: "El correo o la contraseña no coinciden." };
  }
  await ensureUserWorkspace(db, user.id);
  try { const { notifyNewDevice } = await import("@/server/account-mail"); await notifyNewDevice(db, user, h.get("user-agent"), ip); } catch (e) { reportError("aviso de ingreso", e); }
  await createSession(user.id, { twoFactorVerified: !user.totpEnabledAt, remember: fd.get("remember") === "on" });
  await audit("auth.login", { userId: user.id });
  redirect(user.totpEnabledAt ? "/verificar" : await landingPath("/app"));
}

export async function verifyLoginCodeAction(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s) redirect("/ingresar");
  if (!s.user.totpSecretEnc || !s.user.totpEnabledAt) redirect("/app");
  const code = String(fd.get("code") ?? "").replace(/\D/g, "");
  const db = getDb();
  if (!(await reserveSecurityAttempt(db, "twofactor", [{ key: s.userId, limit: 5, windowMs: quarterHour }]))) {
    await destroySession();
    return { error: "Demasiados códigos incorrectos. Ingresá de nuevo en 15 minutos." };
  }
  const recovery = String(fd.get("recoveryCode") ?? "").trim();
  const { consumeRecoveryCode } = await import("@/server/recovery-codes");
  const valid = recovery ? await consumeRecoveryCode(db, s.userId, recovery) : await consumeTotp(db, s.userId, code);
  if (!valid) {
    await audit("auth.2fa_failed", { userId: s.userId });
    return { error: "El código no es correcto, ya se usó o venció. Esperá el próximo código de tu app e intentá de nuevo." };
  }
  await markTwoFactorVerified(s.id);
  await audit(recovery ? "auth.recovery_code_used" : "auth.2fa_ok", { userId: s.userId });
  if (recovery) {
    try { const { sendSecurityNotice } = await import("@/server/account-mail"); await sendSecurityNotice(s.user, "recovery_used"); } catch (e) { reportError("[recovery notice]", e); }
  }
  redirect(await landingPath("/app"));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

// ---------- Recuperar contraseña ----------
// Siempre responde lo mismo, exista o no la cuenta, para no revelar qué correos están registrados.
export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = getDb();
  const ok: FormState = { ok: "Si hay una cuenta con ese correo, te mandamos un enlace para elegir una contraseña nueva. Vence en 1 hora." };
  const { headers } = await import("next/headers");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  if (!(await reserveSecurityAttempt(db, "reset", [...authBuckets(parsed.data, ip, 3, 20), { key: "global", limit: 1000, windowMs: quarterHour }]))) return ok;
  await audit("auth.reset_requested", { entity: "email", entityId: parsed.data });
  const user = await db.user.findUnique({ where: { email: parsed.data } });
  if (!user || user.deletedAt || user.suspendedAt) return ok;
  const { randomBytes, createHash } = await import("node:crypto");
  const token = randomBytes(32).toString("base64url");
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
  const { sendEmail, appUrl } = await import("@/lib/email");
  await sendEmail({
    purpose: "password",
    to: user.email,
    subject: "Elegí una contraseña nueva para Somos Guafra",
    text: `Hola ${user.name.split(" ")[0]}:\n\nPara elegir una contraseña nueva, entrá a este enlace (vence en 1 hora):\n${appUrl()}/recuperar/${token}\n\nSi no lo pediste vos, ignorá este correo: tu contraseña no cambia.\n\nSomos Guafra`,
  });
  return ok;
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const { createHash } = await import("node:crypto");
  const db = getDb();
  const r = await db.passwordReset.findUnique({ where: { tokenHash: createHash("sha256").update(token).digest("hex") } });
  if (!r || r.usedAt || r.expiresAt < new Date()) return { error: "El enlace venció o ya se usó. Pedí uno nuevo." };
  const hashed = await hashPassword(password);
  const { consumePasswordReset } = await import("@/server/password-reset");
  const changed = await consumePasswordReset(db, r.id, r.userId, hashed);
  if (!changed) return { error: "El enlace venció o ya se usó. Pedí uno nuevo." };
  await audit("auth.password_reset", { userId: r.userId });
  try {
    const { sendPasswordChanged } = await import("@/server/account-mail");
    const u = await db.user.findUnique({ where: { id: r.userId } });
    if (u) await sendPasswordChanged(u);
  } catch (e) { reportError("aviso de contraseña", e); }
  redirect("/ingresar?nueva=1");
}

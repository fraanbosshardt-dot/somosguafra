// Referidos: cada persona tiene un link para invitar. Cuando alguien se registra con ese link y termina la
// bienvenida, los dos reciben 1 mes de Pro. Hay un tope de premios por persona para evitar abusos.
import type { PrismaClient } from "@/generated/prisma/client";
import { applyReferralCredit } from "./referral-credit";
import { lockWorkspace } from "./workspace-lock";

export const REFERRAL_DAYS = 30;
export const REFERRAL_MAX_REWARDS = 12;
export const REF_COOKIE = "somosguafra_ref";

const ABC = "abcdefghjkmnpqrstuvwxyz23456789";
export function newReferralCode(rand: () => number = Math.random) {
  let c = "";
  for (let i = 0; i < 8; i++) c += ABC[Math.floor(rand() * ABC.length)];
  return c;
}
export const isReferralCode = (c: unknown): c is string => typeof c === "string" && /^[a-z2-9]{8}$/.test(c);

// El código propio se crea la primera vez que se pide.
export async function ensureReferralCode(db: PrismaClient, userId: string) {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
  if (u.referralCode) return u.referralCode;
  for (let i = 0; i < 5; i++) {
    const code = newReferralCode();
    try {
      await db.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch (e) {
      if (!String(e).includes("Unique")) throw e;
    }
  }
  throw new Error("No se pudo crear el código de invitación");
}

// Al crear la cuenta: se anota quién invitó (si el código existe y no es la misma persona).
export async function attachReferral(db: PrismaClient, newUserId: string, code: string | undefined | null) {
  if (!isReferralCode(code)) return false;
  const ref = await db.user.findUnique({ where: { referralCode: code }, select: { id: true, deletedAt: true } });
  if (!ref || ref.deletedAt || ref.id === newUserId) return false;
  await db.user.updateMany({ where: { id: newUserId, referredById: null }, data: { referredById: ref.id } });
  return true;
}

const workspaceOf = async (db: PrismaClient, userId: string) =>
  (await db.membership.findFirst({ where: { userId, role: "OWNER" }, orderBy: { createdAt: "asc" }, select: { workspaceId: true } }))?.workspaceId ?? null;

// Se habilita al confirmar el correo, terminar la bienvenida y registrar el primer movimiento.
// Cupo y ambos premios se confirman juntos; un fallo permite reintentar sin perder días.
export async function rewardReferral(db: PrismaClient, userId: string) {
  const candidate = await db.user.findUnique({ where: { id: userId }, select: { referredById: true, referralRewardedAt: true } });
  if (!candidate?.referredById || candidate.referralRewardedAt) return { rewarded: false as const };
  const [mine, theirs] = await Promise.all([workspaceOf(db, userId), workspaceOf(db, candidate.referredById)]);
  if (!mine || !theirs || mine === theirs) return { rewarded: false as const };
  return db.$transaction(async (tx) => {
    for (const id of [mine, theirs].sort()) await lockWorkspace(tx, id);
    const u = await tx.user.findUnique({ where: { id: userId } });
    const referrer = await tx.user.findUnique({ where: { id: candidate.referredById! } });
    if (!u || u.deletedAt || u.suspendedAt || !u.emailVerified || u.referralRewardedAt || u.referredById !== referrer?.id || referrer.deletedAt || referrer.suspendedAt) return { rewarded: false as const };
    const active = await tx.workspace.findFirst({ where: { id: mine, onboardedAt: { not: null }, billingDisabledAt: null, accounts: { some: {} }, transactions: { some: { type: { in: ["INCOME", "EXPENSE"] } } } } });
    if (!active) return { rewarded: false as const };
    const given = await tx.user.count({ where: { referredById: referrer.id, referralRewardedAt: { not: null } } });
    const referrerGets = given < REFERRAL_MAX_REWARDS;
    // Primero reservar todos los bloqueos, después modificar. Conserva el orden global aun con referidos cruzados.
    await tx.workspace.update({ where: { id: mine }, data: { referralCreditDays: { increment: REFERRAL_DAYS } } });
    if (referrerGets) await tx.workspace.update({ where: { id: theirs }, data: { referralCreditDays: { increment: REFERRAL_DAYS } } });
    await applyReferralCredit(tx, mine);
    if (referrerGets) await applyReferralCredit(tx, theirs);
    await tx.user.update({ where: { id: userId }, data: { referralRewardedAt: new Date() } });
    await tx.auditLog.create({ data: { action: "referral.rewarded", userId, workspaceId: mine, meta: { referrerId: referrer.id, referrerGets, days: REFERRAL_DAYS } } });
    return { rewarded: true as const, referrerId: referrer.id, referrerGets };
  });
}

export async function referralStats(db: PrismaClient, userId: string) {
  const [invited, rewarded, own] = await Promise.all([
    db.user.count({ where: { referredById: userId } }),
    db.user.count({ where: { referredById: userId, referralRewardedAt: { not: null } } }),
    db.membership.findFirst({ where: { userId, role: "OWNER" }, include: { workspace: { select: { referralCreditDays: true } } } }),
  ]);
  return { invited, rewarded, creditDays: own?.workspace.referralCreditDays ?? 0, left: Math.max(0, REFERRAL_MAX_REWARDS - rewarded) };
}

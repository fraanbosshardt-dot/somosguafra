import { TERMS_VERSION } from "@/lib/brand";
// Encuentra o crea la cuenta para un ingreso con Google.
import type { PrismaClient } from "@/generated/prisma/client";
import type { GoogleProfile } from "@/lib/auth/google";
import { createUserWithWorkspace, ensureUserWorkspace } from "@/server/workspace";

export type GoogleResult =
  | { ok: true; userId: string; created: boolean; linked: boolean; passwordCleared: boolean; workspaceId?: string }
  | { ok: false; why: "otra" | "bloqueada" };

export async function findOrCreateGoogleUser(db: PrismaClient, g: GoogleProfile): Promise<GoogleResult> {
  const bySub = await db.user.findUnique({ where: { googleSub: g.sub } });
  if (bySub) {
    if (bySub.deletedAt || bySub.suspendedAt) return { ok: false, why: "bloqueada" };
    await ensureUserWorkspace(db, bySub.id);
    return { ok: true, userId: bySub.id, created: false, linked: false, passwordCleared: false };
  }
  const byEmail = await db.user.findUnique({ where: { email: g.email } });
  if (byEmail) {
    if (byEmail.deletedAt || byEmail.suspendedAt) return { ok: false, why: "bloqueada" };
    if (byEmail.googleSub) return { ok: false, why: "otra" };
    // Si el correo nunca se confirmó, la contraseña la pudo haber puesto otra persona con ese correo.
    // Google confirma que el correo es de quien entra: se borra esa contraseña y se cierran las sesiones abiertas.
    const unverified = !byEmail.emailVerified;
    await db.$transaction([
      db.user.update({ where: { id: byEmail.id }, data: { googleSub: g.sub, emailVerified: byEmail.emailVerified ?? new Date(), ...(unverified ? { passwordHash: "" } : {}) } }),
      ...(unverified ? [db.session.deleteMany({ where: { userId: byEmail.id } })] : []),
    ]);
    await ensureUserWorkspace(db, byEmail.id);
    return { ok: true, userId: byEmail.id, created: false, linked: true, passwordCleared: unverified && byEmail.passwordHash !== "" };
  }
  try {
    const { user, workspace } = await createUserWithWorkspace(db, { email: g.email, name: g.name, passwordHash: "", googleSub: g.sub, emailVerified: new Date(), termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION, termsChannel: "google" });
    return { ok: true, userId: user.id, created: true, linked: false, passwordCleared: false, workspaceId: workspace.id };
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
    // Otra pestaña completó el mismo alta mientras se verificaba Google.
    const concurrent = await db.user.findFirst({ where: { OR: [{ googleSub: g.sub }, { email: g.email }] } });
    if (!concurrent) throw e;
    if (concurrent.deletedAt || concurrent.suspendedAt) return { ok: false, why: "bloqueada" };
    if (concurrent.googleSub !== g.sub) return { ok: false, why: "otra" };
    await ensureUserWorkspace(db, concurrent.id);
    return { ok: true, userId: concurrent.id, created: false, linked: false, passwordCleared: false };
  }
}

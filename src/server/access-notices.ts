import type { Db } from "./ledger";
import { effectivePlan } from "./plans";

export async function queueAccessNotices(db: Db, now = new Date()) {
  const candidates = await db.subscription.findMany({ where: { trialEndsAt: { gte: new Date(now.getTime() - 864e5), lte: new Date(now.getTime() + 864e5) }, workspace: { excludeFromMetrics: false, billingDisabledAt: null } }, include: { workspace: { select: { timezone: true } } } });
  let queued = 0;
  for (const sub of candidates) {
    const event = sub.trialEndsAt! > now ? "ending" : "ended";
    if (await db.billingAgreement.count({ where: { workspaceId: sub.workspaceId, status: { in: ["authorized", "paused", "creating", "uncertain"] } } })) continue;
    if (event === "ended" && effectivePlan(sub, now) === "PRO") continue;
    const owner = await db.membership.findFirst({ where: { workspaceId: sub.workspaceId, role: "OWNER", user: { deletedAt: null, suspendedAt: null, emailVerified: { not: null } } }, include: { user: true } });
    if (!owner) continue;
    const key = `access/${sub.workspaceId}/${event}/${sub.trialEndsAt!.getTime()}`;
    const end = new Intl.DateTimeFormat("es-AR", { timeZone: sub.workspace.timezone, dateStyle: "long" }).format(sub.trialEndsAt!);
    const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
    await db.emailOutbox.upsert({ where: { dedupeKey: key }, update: {}, create: { dedupeKey: key, workspaceId: sub.workspaceId, to: owner.user.email, purpose: "billing", subject: event === "ending" ? "Tu período gratuito termina pronto · somosguafra" : "Terminó tu período gratuito · somosguafra", text: `Hola ${owner.user.name.split(" ")[0]}:\n\n${event === "ending" ? `Tu período gratuito termina el ${end}. Si no hay cobertura paga vigente, tu cuenta pasa a Gratis.` : "Tu período gratuito terminó y tu cuenta continúa con el plan Gratis."}\nTus datos se conservan. Este aviso no genera un cobro ni cancela un contrato.\n\nPodés consultar el estado actualizado en ${base}/app/configuracion?tab=plan\n\nsomosguafra` } }); queued++;
  }
  return queued;
}
export async function validAccessNotice(db: Db, key: string, now = new Date(), recipient?: string) {
  const [, workspaceId, event, time] = key.split("/");
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { workspace: { select: { excludeFromMetrics: true, billingDisabledAt: true } } } });
  if (!sub || sub.workspace.excludeFromMetrics || sub.workspace.billingDisabledAt || sub.trialEndsAt?.getTime() !== Number(time)) return false;
  if (await db.billingAgreement.count({ where: { workspaceId, status: { in: ["authorized", "paused", "creating", "uncertain"] } } })) return false;
  if (!await db.membership.count({ where: { workspaceId, role: "OWNER", user: { ...(recipient ? { email: recipient } : {}), deletedAt: null, suspendedAt: null, emailVerified: { not: null } } } })) return false;
  return event === "ending" ? sub.trialEndsAt! > now && sub.trialEndsAt!.getTime() - now.getTime() <= 864e5 : event === "ended" && effectivePlan(sub, now) === "FREE" && now.getTime() - sub.trialEndsAt!.getTime() <= 864e5;
}

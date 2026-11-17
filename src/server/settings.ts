// Ajustes de la plataforma guardados en la base (se cambian desde el panel, sin tocar código).
import type { PrismaClient } from "@/generated/prisma/client";

export type SystemSettings = { maintenance: boolean; maintenanceMsg: string; pdfLimit: number };
export type Announcement = { text: string; tone: "info" | "warn"; audience: "all" | "free" | "pro"; until: string | null; link: string | null } | null;

const SYSTEM_DEFAULT = (): SystemSettings => ({
  maintenance: false,
  maintenanceMsg: "Estamos haciendo mejoras. Volvé en un rato: tus datos están a salvo.",
  pdfLimit: Number(process.env.PDF_MONTHLY_LIMIT || 5),
});

async function read<T>(db: PrismaClient, key: string): Promise<T | null> {
  const s = await db.appSetting.findUnique({ where: { key } });
  return (s?.value ?? null) as T | null;
}
export async function writeSetting(db: PrismaClient, key: string, value: object | null) {
  const v = (value ?? {}) as object;
  await db.appSetting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}

export async function systemSettings(db: PrismaClient): Promise<SystemSettings> {
  return { ...SYSTEM_DEFAULT(), ...((await read<Partial<SystemSettings>>(db, "system")) ?? {}) };
}

export async function pdfMonthlyLimit(db: PrismaClient) {
  return (await systemSettings(db)).pdfLimit;
}

export async function announcement(db: PrismaClient): Promise<Announcement> {
  const a = await read<NonNullable<Announcement>>(db, "announcement");
  if (!a?.text) return null;
  return a;
}

// El aviso se muestra si está vigente y corresponde al plan de quien mira.
export function announcementFor(a: Announcement, plan: "FREE" | "PRO", now = new Date()) {
  if (!a?.text) return null;
  if (a.until && new Date(`${a.until}T23:59:59Z`) < now) return null;
  if (a.audience === "free" && plan !== "FREE") return null;
  if (a.audience === "pro" && plan !== "PRO") return null;
  return a;
}

export async function savedReplies(db: PrismaClient): Promise<import("@/lib/support-replies").SavedSupportReply[]> {
  const { DEFAULT_SUPPORT_REPLIES, REPLY_AREAS } = await import("@/lib/support-replies");
  const v = await read<{ version?:number; items?: import("@/lib/support-replies").SavedSupportReply[] }>(db, "savedReplies");
  const custom = Array.isArray(v?.items) ? v.items.filter(r=>typeof r?.title==="string" && typeof r?.text==="string").map(r=>({...r,area:r.area && Object.hasOwn(REPLY_AREAS,r.area) ? r.area : "general"})) : [];
  return v?.version===2 ? custom : [...new Map([...DEFAULT_SUPPORT_REPLIES,...custom].map(r=>[r.title,r])).values()];
}

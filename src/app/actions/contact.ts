"use server";
// Las consultas llegan al panel interno. La persona recibe su número de trámite por correo.
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { drainEmailOutbox } from "@/server/billing-mail";
import { createContactMessage, validateContact } from "@/server/contact";

export type ContactState = { error?: string; code?: string; area?: string } | null;
const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function contactAction(_: ContactState, fd: FormData): Promise<ContactState> {
  // Un envío rápido puede ser legítimo (autocompletado). Nunca dar una constancia sin guardarlo.
  if (s(fd, "website")) return { error: "No pudimos recibir la consulta. Revisá el formulario y volvé a intentarlo." };

  const input = { area: s(fd, "area"), name: s(fd, "name"), email: s(fd, "email"), subject: s(fd, "subject"), body: s(fd, "body") };
  const err = validateContact(input);
  if (err) return { error: err };

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
  const session = await getSession().catch(() => null);
  const db = getDb();
  const r = await createContactMessage(db, { ...input, ip, userId: session?.user?.id ?? null });
  if ("error" in r) return { error: r.error };
  const m = r.message;

  await drainEmailOutbox(db).catch((e) => console.error("[contact receipt queued]", e));
  return { code: m.code, area: m.area };
}

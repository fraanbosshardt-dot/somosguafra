import { createHash } from "node:crypto";
import type { Db } from "./ledger";

// Respuesta y correo se confirman juntos. El mismo texto no vuelve a enviarse por un reintento.
export async function replyToContact(db: Db, id: string, input: string, baseUrl: string) {
  const reply = input.trim().normalize("NFC").slice(0, 5000);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id = ${id} FOR UPDATE`;
    const m = await tx.contactMessage.update({ where: { id }, data: { reply, status: "ANSWERED" } });
    const dedupeKey = `contact/${id}/reply/${createHash("sha256").update(reply).digest("hex")}`;
    await tx.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, purpose: "support", to: m.email, subject: `Re: ${m.subject} (${m.code})`, text: `Hola ${m.name.split(" ")[0]}:\n\n${reply}\n\nTu consulta (${m.code}): "${m.subject}"\nSi necesitás algo más, escribinos desde ${baseUrl}/contacto indicando este número.` } });
    return m;
  });
}

export async function replyToTicket(db: Db, id: string, input: string, baseUrl: string) {
  const reply = input.trim().normalize("NFC").slice(0, 4000);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id = ${id} FOR UPDATE`;
    const t = await tx.supportTicket.update({ where: { id }, data: { reply, status: "ANSWERED" }, include: { user: true } });
    const dedupeKey = `support/${id}/reply/${createHash("sha256").update(reply).digest("hex")}`;
    await tx.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, purpose: "support", to: t.user.email, subject: `Re: ${t.subject} · Somos Guafra`, text: `Hola ${t.user.name.split(" ")[0]}:\n\n${reply}\n\nPodés ver esta respuesta y volver a escribirnos desde ${baseUrl}/app/ayuda.` } });
    return t;
  });
}

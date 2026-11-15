import type { Db } from "./ledger";
import { caseLinks, replyKey } from "./support-thread";

// Respuesta y correo se confirman juntos. El mismo texto no vuelve a enviarse por un reintento.
export async function replyToContact(db: Db, id: string, input: string, baseUrl: string) {
  const reply = input.trim().normalize("NFC").slice(0, 5000);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id = ${id} FOR UPDATE`;
    const previous = await tx.contactMessage.findUniqueOrThrow({ where: { id } });
    if (previous.reply && !await tx.supportMessage.count({ where: { contactId: id, role: "staff", internal: false } })) await tx.supportMessage.upsert({ where: { dedupeKey: `legacy/contact/${id}` }, update: {}, create: { dedupeKey: `legacy/contact/${id}`, contactId: id, role: "staff", body: previous.reply, createdAt: previous.updatedAt } });
    const m = await tx.contactMessage.update({ where: { id }, data: { reply, status: "ANSWERED" } });
    const last = await tx.supportMessage.findFirst({ where: { contactId: id, role: "customer" }, orderBy: { createdAt: "desc" } });
    const dedupeKey = replyKey("contact", id, reply, last?.id ?? "initial");
    await tx.supportMessage.upsert({ where: { dedupeKey }, update: {}, create: { contactId: id, role: "staff", body: reply, dedupeKey } });
    const links = caseLinks("contact", id, m.email, baseUrl);
    await tx.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, purpose: "support", to: m.email, replyTo: links.replyTo, subject: `Re: ${m.subject} (${m.code})`, text: `Hola ${m.name.split(" ")[0]}:\n\n${reply}\n\nTu consulta (${m.code}): "${m.subject}"\nPodés continuar la conversación desde este enlace privado: ${links.url}` } });
    return m;
  });
}

export async function replyToTicket(db: Db, id: string, input: string, baseUrl: string) {
  const reply = input.trim().normalize("NFC").slice(0, 4000);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id = ${id} FOR UPDATE`;
    const previous = await tx.supportTicket.findUniqueOrThrow({ where: { id } });
    if (previous.reply && !await tx.supportMessage.count({ where: { ticketId: id, role: "staff", internal: false } })) await tx.supportMessage.upsert({ where: { dedupeKey: `legacy/ticket/${id}` }, update: {}, create: { dedupeKey: `legacy/ticket/${id}`, ticketId: id, role: "staff", body: previous.reply, createdAt: previous.updatedAt } });
    const t = await tx.supportTicket.update({ where: { id }, data: { reply, status: "ANSWERED" }, include: { user: true } });
    const last = await tx.supportMessage.findFirst({ where: { ticketId: id, role: "customer" }, orderBy: { createdAt: "desc" } });
    const dedupeKey = replyKey("ticket", id, reply, last?.id ?? "initial");
    await tx.supportMessage.upsert({ where: { dedupeKey }, update: {}, create: { ticketId: id, role: "staff", body: reply, dedupeKey } });
    const links = caseLinks("ticket", id, t.user.email, baseUrl);
    await tx.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, purpose: "support", to: t.user.email, replyTo: links.replyTo, subject: `Re: ${t.subject} · Somos Guafra`, text: `Hola ${t.user.name.split(" ")[0]}:\n\n${reply}\n\nPodés ver esta respuesta y volver a escribirnos desde ${baseUrl}/app/ayuda o desde este enlace privado: ${links.url}` } });
    return t;
  });
}

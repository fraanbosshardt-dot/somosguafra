import type { Db } from "./ledger";
import { caseLinks, replyKey } from "./support-thread";
import { assertSupportEditor, clearSupportNotices, releaseSupportEditor, type SupportEditor } from "./support-operations";

// Respuesta y correo se confirman juntos. El mismo texto no vuelve a enviarse por un reintento.
export async function replyToContact(db: Db, id: string, input: string, baseUrl: string, author?: string, editor?: SupportEditor) {
  const reply = input.trim().normalize("NFC").slice(0, 5000);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id = ${id} FOR UPDATE`;
    const previous = await tx.contactMessage.findUniqueOrThrow({ where: { id } });
    if(editor) await assertSupportEditor(tx,"contact",id,previous.updatedAt,editor);
    if (previous.reply && !await tx.supportMessage.count({ where: { contactId: id, role: "staff", internal: false } })) await tx.supportMessage.upsert({ where: { dedupeKey: `legacy/contact/${id}` }, update: {}, create: { dedupeKey: `legacy/contact/${id}`, contactId: id, role: "staff", body: previous.reply, createdAt: previous.updatedAt } });
    const m = await tx.contactMessage.update({ where: { id }, data: { reply, status: "ANSWERED" } });
    const last = await tx.supportMessage.findFirst({ where: { contactId: id, role: "customer" }, orderBy: { createdAt: "desc" } });
    const dedupeKey = replyKey("contact", id, reply, last?.id ?? "initial");
    await tx.supportMessage.upsert({ where: { dedupeKey }, update: {}, create: { contactId: id, role: "staff", body: reply, author, dedupeKey } });
    const links = caseLinks("contact", id, m.email, baseUrl,7);
    const chat=await tx.chatSession.findUnique({where:{contactId:id},select:{id:true,userId:true}});
    if(chat)await tx.chatSession.update({where:{id:chat.id},data:{updatedAt:new Date()}});
    const chatUrl=chat?.userId?`${baseUrl}/soporte/abrir?caso=${encodeURIComponent(m.code)}`:links.url;
    await tx.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, purpose: "support", to: m.email, replyTo: links.replyTo, subject: chat?`Tu caso ${m.code} tiene una respuesta · somosguafra`:`Re: ${m.subject} (${m.code})`, text: chat?`Hola ${m.name.split(" ")[0]}:\n\nEl equipo respondió tu caso ${m.code}. Abrí la conversación para leer la respuesta y continuar: ${chatUrl}\n\nEste aviso no confirma cambios en pagos ni en tu cuenta.`:`Hola ${m.name.split(" ")[0]}:\n\n${reply}\n\nTu consulta (${m.code}): "${m.subject}"\nPodés continuar la conversación desde este enlace privado: ${links.url}` } });
    await clearSupportNotices(tx,"contact",id);
    await releaseSupportEditor(tx,"contact",id);
    return m;
  });
}

export async function replyToTicket(db: Db, id: string, input: string, baseUrl: string, author?: string, editor?: SupportEditor) {
  const reply = input.trim().normalize("NFC").slice(0, 4000);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id = ${id} FOR UPDATE`;
    const previous = await tx.supportTicket.findUniqueOrThrow({ where: { id } });
    if(editor) await assertSupportEditor(tx,"ticket",id,previous.updatedAt,editor);
    if (previous.reply && !await tx.supportMessage.count({ where: { ticketId: id, role: "staff", internal: false } })) await tx.supportMessage.upsert({ where: { dedupeKey: `legacy/ticket/${id}` }, update: {}, create: { dedupeKey: `legacy/ticket/${id}`, ticketId: id, role: "staff", body: previous.reply, createdAt: previous.updatedAt } });
    const t = await tx.supportTicket.update({ where: { id }, data: { reply, status: "ANSWERED" }, include: { user: true } });
    const last = await tx.supportMessage.findFirst({ where: { ticketId: id, role: "customer" }, orderBy: { createdAt: "desc" } });
    const dedupeKey = replyKey("ticket", id, reply, last?.id ?? "initial");
    await tx.supportMessage.upsert({ where: { dedupeKey }, update: {}, create: { ticketId: id, role: "staff", body: reply, author, dedupeKey } });
    const links = caseLinks("ticket", id, t.user.email, baseUrl);
    await tx.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, purpose: "support", to: t.user.email, replyTo: links.replyTo, subject: `Re: ${t.subject} · Somos Guafra`, text: `Hola ${t.user.name.split(" ")[0]}:\n\n${reply}\n\nPodés ver esta respuesta y volver a escribirnos desde ${baseUrl}/app/ayuda o desde este enlace privado: ${links.url}` } });
    await clearSupportNotices(tx,"ticket",id);
    await releaseSupportEditor(tx,"ticket",id);
    return t;
  });
}

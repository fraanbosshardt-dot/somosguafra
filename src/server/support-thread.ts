import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { notifySupportTeam, releaseSupportEditor } from "./support-operations";
export type CaseKind = "ticket" | "contact";
export const parentWhere = (kind: CaseKind, id: string) => kind === "ticket" ? { ticketId: id } : { contactId: id };
const secret = () => process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32 ? process.env.AUTH_SECRET : undefined;
export function caseToken(kind: CaseKind, id: string, email: string, expires = Math.floor(Date.now() / 1000) + 90 * 86400) {
  const key = secret(); if (!key) return null;
  const payload = `${kind === "ticket" ? "t" : "c"}.${id}.${expires.toString(36)}`;
  return `${payload}.${createHmac("sha256", key).update(`support-v1:${payload}:${email.toLowerCase()}`).digest("base64url").slice(0, 22)}`;
}
export async function resolveCaseToken(db: Db, token: string) {
  const [k, id, exp, signature] = token.split(".");
  if (!/^[ct]$/.test(k ?? "") || !/^[a-zA-Z0-9_-]{1,35}$/.test(id ?? "") || !/^[a-z0-9]{1,9}$/.test(exp ?? "") || !/^[a-zA-Z0-9_-]{22}$/.test(signature ?? "") || parseInt(exp, 36) < Date.now() / 1000) return null;
  const kind: CaseKind = k === "t" ? "ticket" : "contact";
  const item = kind === "ticket" ? await db.supportTicket.findUnique({ where: { id }, include: { user: { select: { email: true } } } }) : await db.contactMessage.findUnique({ where: { id } });
  if (!item) return null;
  const email = "user" in item ? item.user.email : item.email;
  const expected = caseToken(kind, id, email, parseInt(exp, 36));
  if (!expected || token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return null;
  return { kind, id, email, item };
}
export function caseLinks(kind: CaseKind, id: string, email: string, baseUrl: string, ttlDays=90) {
  const token = caseToken(kind, id, email,Math.floor(Date.now()/1000)+Math.max(1,Math.min(90,ttlDays))*86400);
  const domain = process.env.SUPPORT_RECEIVING_DOMAIN;
  return { url: token ? `${baseUrl}/consulta/${token}` : `${baseUrl}/contacto`, replyTo: token && domain && /^[a-z0-9.-]+$/i.test(domain) && process.env.SUPPORT_INBOUND_ENABLED === "true" ? `${token}@${domain}` : undefined };
}
export async function customerReply(db: Db, kind: CaseKind, id: string, input: string, nonce: string, providerDedupe?: string) {
  const body = input.trim().normalize("NFC");
  if (body.length < 2 || body.length > 5000 || !/^[a-zA-Z0-9_-]{8,150}$/.test(nonce)) throw new UserError("Revisá el mensaje e intentá nuevamente.");
  return db.$transaction(async tx => {
    if (kind === "ticket") await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id = ${id} FOR UPDATE`;
    else await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id = ${id} FOR UPDATE`;
    const where = parentWhere(kind, id);
    const key = providerDedupe ?? `customer/${kind}/${id}/${nonce}`;
    if (await tx.supportMessage.findUnique({ where: { dedupeKey: key } })) return;
    const recent = await tx.supportMessage.count({ where: { ...where, role: "customer", createdAt: { gte: new Date(Date.now() - 864e5) } } });
    const chat = kind === "contact" ? await tx.chatSession.findUnique({where:{contactId:id},select:{id:true}}) : null;
    if (recent >= (chat ? 100 : 20)) throw new UserError("Recibimos varios mensajes hoy. Esperá nuestra respuesta para continuar.");
    await tx.supportMessage.create({ data: { ...where, role: "customer", body, dedupeKey: key } });
    if (kind === "ticket") await tx.supportTicket.update({ where: { id }, data: { status: "OPEN" } });
    else await tx.contactMessage.update({ where: { id }, data: { status: "OPEN" } });
    if(chat)await tx.chatSession.update({where:{id:chat.id},data:{updatedAt:new Date()}});
    await releaseSupportEditor(tx,kind,id);
    await notifySupportTeam(tx,kind,id,"CUSTOMER");
  });
}
export const replyKey = (kind: CaseKind, id: string, text: string, lastCustomerId: string) => `reply/${kind}/${id}/${createHash("sha256").update(`${lastCustomerId}:${text}`).digest("hex")}`;

import type { Prisma } from "@/generated/prisma/client";
import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { ownerEmails, type AdminRole } from "./admin-team";
import { createHash } from "node:crypto";
import { supportDeadline } from "@/lib/support-time";

type Store = Prisma.TransactionClient;
export type SupportKind = "ticket" | "contact";
export type SupportEditor = { email: string; sessionId: string; role: AdminRole; token: string; revision: string };
export const LEASE_MS = 75_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const parent = (kind: SupportKind, id: string) => kind === "ticket" ? { ticketId: id } : { contactId: id };
const key = (kind: SupportKind, id: string) => `${kind}/${id}`;
export async function lockSupportCase(tx: Store, kind: SupportKind, id: string) {
  if (kind === "ticket") {
    await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id=${id} FOR UPDATE`;
    return tx.supportTicket.findUniqueOrThrow({where:{id}});
  }
  await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id=${id} FOR UPDATE`;
  return tx.contactMessage.findUniqueOrThrow({where:{id}});
}
export async function activeSupportTeam(tx: Pick<Store,"adminMember">) {
  const members = await tx.adminMember.findMany({where:{role:{in:["OWNER","SUPPORT"]}},select:{email:true,role:true}});
  const team = new Map(members.map(m=>[m.email.toLowerCase(),{email:m.email.toLowerCase(),role:m.role}]));
  for (const email of ownerEmails()) team.set(email,{email,role:"OWNER"});
  return [...team.values()].sort((a,b)=>a.email.localeCompare(b.email));
}

// Call inside the transaction which saved the public event. No message body or
// customer identity is copied into employee emails. Repeated events are deduped.
export async function notifySupportTeam(tx: Store, kind: SupportKind, id: string, type: "NEW"|"CUSTOMER"|"ASSIGNED"|"REVIEW"|"OVERDUE", activityAt=new Date()) {
  const c = kind === "ticket" ? await tx.supportTicket.findUniqueOrThrow({where:{id}}) : await tx.contactMessage.findUniqueOrThrow({where:{id}});
  const team = await activeSupportTeam(tx);
  const assignment=type==="ASSIGNED"||type==="REVIEW";
  const recipients = team.filter(m=>c.assignedTo ? m.email === c.assignedTo || (!assignment && c.priority === "HIGH" && m.role === "OWNER") : true);
  // If no owner is configured, the active support team still receives the case.
  const targets = recipients.length ? recipients : team;
  const url = `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/,"")}/admin/soporte/${kind}/${id}`;
  for (const member of targets) {
    const recipient = member.email;
    const suffix = digest(recipient).slice(0,24);
    const eventKey = type === "OVERDUE" ? `due/${key(kind,id)}/${activityAt.toISOString()}/${suffix}` : `inbox/${key(kind,id)}/${suffix}`;
    const existing = await tx.adminSupportNotice.findUnique({where:{eventKey},select:{activityAt:true}});
    if (existing && type === "OVERDUE") continue;
    const data = {recipient,kind,caseId:id,...parent(kind,id),code:c.code,type,priority:c.priority,activityAt,readAt:null};
    await tx.adminSupportNotice.upsert({where:{eventKey},create:{eventKey,...data},update:data});
    const bucket = type === "OVERDUE" ? activityAt.toISOString() : Math.floor(activityAt.getTime()/(15*60_000));
    const dedupeKey = `staff/${assignment ? "assigned" : type === "OVERDUE" ? "due" : "incoming"}/${key(kind,id)}/${suffix}/${bucket}`;
    const title = type === "REVIEW" ? "Solicitud de revisión interna" : type === "ASSIGNED" ? "Te asignaron una consulta" : type === "OVERDUE" ? "Consulta demorada" : type === "CUSTOMER" ? "El cliente volvió a escribir" : "Nueva consulta";
    await tx.emailOutbox.upsert({where:{dedupeKey},update:{},create:{dedupeKey,to:recipient,purpose:"support",subject:`${title} · ${c.code}`,text:`${title}. Caso ${c.code}.\n\nAbrí el panel para revisar el historial y atender la consulta: ${url}\n\nLos datos del cliente y el contenido se consultan únicamente dentro del panel autorizado.`}});
  }
}
export async function clearSupportNotices(tx: Store, kind: SupportKind, id: string) {
  await tx.adminSupportNotice.updateMany({where:{kind,caseId:id,readAt:null},data:{readAt:new Date()}});
}
export async function staffNoticeStillRelevant(db: Db, row:{to:string;dedupeKey:string}) {
  const [,type,kind,id]=row.dedupeKey.split("/");
  if(kind!=="ticket"&&kind!=="contact")return false;
  const member=(await activeSupportTeam(db)).find(m=>m.email===row.to.toLowerCase());
  if(!member)return false;
  const c=kind==="ticket"?await db.supportTicket.findUnique({where:{id}}):await db.contactMessage.findUnique({where:{id}});
  if(!c||!["OPEN","IN_PROGRESS","WAITING_INTERNAL"].includes(c.status))return false;
  if(type==="assigned"&&c.assignedTo!==member.email)return false;
  if(c.assignedTo&&c.assignedTo!==member.email&&!(c.priority==="HIGH"&&member.role==="OWNER"))return false;
  return !!await db.adminSupportNotice.count({where:{recipient:member.email,kind,caseId:id,readAt:null,...(type==="due"?{type:"OVERDUE"}:{})}});
}

export async function supportLease(db: Db, kind: SupportKind, id: string, editor: SupportEditor, action: "claim"|"renew"|"release") {
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(editor.token)) throw new UserError("Volvé a tomar la conversación para responder.");
  return db.$transaction(async tx=>{
    const c = await lockSupportCase(tx,kind,id);
    const lease = await tx.supportReplyLease.findUnique({where:{id:key(kind,id)}});
    const owns = lease?.sessionId === editor.sessionId && lease.tokenHash === digest(editor.token) && lease.ownerEmail === editor.email;
    if (action === "release") {
      if (owns) await tx.supportReplyLease.delete({where:{id:key(kind,id)}});
      return {holding:false};
    }
    if (editor.role !== "OWNER" && c.assignedTo && c.assignedTo !== editor.email) throw new UserError("La consulta está asignada a otra persona. Derivala antes de responder.");
    if (c.updatedAt.toISOString() !== editor.revision) throw new UserError("El caso cambió. Actualizá y leé los mensajes nuevos antes de responder; tu borrador se conserva.");
    if (lease && lease.expiresAt.getTime()>Date.now() && !owns) throw new UserError(`${lease.ownerEmail} está preparando una respuesta. Esperá a que termine.`);
    if (action === "renew" && (!owns || !lease || lease.expiresAt.getTime()<=Date.now())) throw new UserError("La reserva venció. Volvé a tomar la conversación; tu borrador se conserva.");
    const expiresAt = new Date(Date.now()+LEASE_MS);
    const data = {...parent(kind,id),ownerEmail:editor.email,sessionId:editor.sessionId,tokenHash:digest(editor.token),revision:editor.revision,expiresAt};
    await tx.supportReplyLease.upsert({where:{id:key(kind,id)},create:{id:key(kind,id),...data},update:data});
    if(action==="claim")await tx.auditLog.create({data:{action:"admin.case_edit_claimed",entity:kind,entityId:id,meta:{admin:editor.email}}});
    return {holding:true,expiresAt:expiresAt.toISOString()};
  });
}
export async function assertSupportEditor(tx: Store, kind: SupportKind, id: string, revision: Date, editor: SupportEditor) {
  const lease = await tx.supportReplyLease.findUnique({where:{id:key(kind,id)}});
  if (!lease || lease.expiresAt.getTime()<=Date.now() || lease.sessionId!==editor.sessionId || lease.ownerEmail!==editor.email || lease.tokenHash!==digest(editor.token)) throw new UserError("Tomá la conversación para responder. Tu borrador se conserva.");
  if (revision.toISOString()!==editor.revision || lease.revision!==editor.revision) throw new UserError("El caso recibió cambios. Actualizá y revisalos antes de enviar; tu borrador se conserva.");
}
export async function releaseSupportEditor(tx: Store, kind: SupportKind, id: string) {
  await tx.supportReplyLease.deleteMany({where:{id:key(kind,id)}});
}
export async function manageSupportCase(db: Db, input: {kind:SupportKind;id:string;revision:string;assignedTo:string|null;note:string;actor:string;review?:boolean}) {
  return db.$transaction(async tx=>{
    const c = await lockSupportCase(tx,input.kind,input.id);
    if(c.updatedAt.toISOString()!==input.revision) throw new UserError("El caso cambió. Actualizá la conversación antes de modificar su gestión.");
    if(input.assignedTo && !(await activeSupportTeam(tx)).some(m=>m.email===input.assignedTo)) throw new UserError("Elegí una persona con acceso activo de atención.");
    if(input.kind==="ticket") await tx.supportTicket.update({where:{id:input.id},data:{assignedTo:input.assignedTo,...(input.review?{status:"WAITING_INTERNAL"}:{})}});
    else await tx.contactMessage.update({where:{id:input.id},data:{assignedTo:input.assignedTo,...(input.review?{status:"WAITING_INTERNAL"}:{})}});
    if(input.note.trim()) await tx.supportMessage.create({data:{...parent(input.kind,input.id),role:"staff",internal:true,author:input.actor,body:input.note.trim().slice(0,3000),dedupeKey:`note/${crypto.randomUUID()}`}});
    await releaseSupportEditor(tx,input.kind,input.id);
    if(input.assignedTo && (c.assignedTo!==input.assignedTo || input.review)) await notifySupportTeam(tx,input.kind,input.id,input.review?"REVIEW":"ASSIGNED");
  });
}

export async function runSupportOverdueAlerts(db: Db) {
  // Bounded, independent transaction: failures never roll back payment maintenance.
  return db.$transaction(async tx=>{
    await tx.$executeRaw`SET LOCAL statement_timeout = '2000ms'`;
    const rows = await tx.$queryRaw<{kind:SupportKind;id:string;since:Date}[]>`
      WITH pending AS (
        SELECT 'ticket'::text kind,t.id,t."createdAt",t."updatedAt" FROM "SupportTicket" t WHERE t.status IN ('OPEN','IN_PROGRESS','WAITING_INTERNAL')
        UNION ALL SELECT 'contact',c.id,c."createdAt",c."updatedAt" FROM "ContactMessage" c WHERE c.status IN ('OPEN','IN_PROGRESS','WAITING_INTERNAL')
      ), waiting AS (
        SELECT p.kind,p.id,coalesce((SELECT min(m."createdAt") FROM "SupportMessage" m WHERE
         (CASE WHEN p.kind='ticket' THEN m."ticketId" ELSE m."contactId" END)=p.id AND m.role='customer' AND NOT m.internal
         AND m."createdAt">coalesce((SELECT max(s."createdAt") FROM "SupportMessage" s WHERE
          (CASE WHEN p.kind='ticket' THEN s."ticketId" ELSE s."contactId" END)=p.id AND s.role='staff' AND NOT s.internal),'epoch'::timestamp)),CASE WHEN EXISTS
          (SELECT 1 FROM "SupportMessage" s WHERE (CASE WHEN p.kind='ticket' THEN s."ticketId" ELSE s."contactId" END)=p.id AND s.role='staff' AND NOT s.internal)
          THEN p."updatedAt" ELSE p."createdAt" END) since
        FROM pending p
      ) SELECT * FROM waiting w WHERE since < NOW()-interval '8 hours' AND NOT EXISTS
       (SELECT 1 FROM "AdminSupportNotice" n WHERE n.kind=w.kind AND n."caseId"=w.id AND n.type='OVERDUE' AND n."activityAt"=w.since)
      ORDER BY since LIMIT 10`;
    let overdue=0;
    for(const row of rows) if(supportDeadline(row.since).getTime()<=Date.now()) {await notifySupportTeam(tx,row.kind,row.id,"OVERDUE",row.since);overdue++;}
    await tx.supportReplyLease.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-864e5)}}});
    await tx.adminSupportNotice.deleteMany({where:{readAt:{not:null},updatedAt:{lt:new Date(Date.now()-30*864e5)}}});
    return overdue;
  },{timeout:7000});
}

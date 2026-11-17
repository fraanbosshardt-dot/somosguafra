import { Prisma } from "@/generated/prisma/client";
import type { Db } from "./ledger";
import { CASE_OPEN, CASE_STATUS } from "@/lib/chat-help";
import { BOT_CHAT_IDLE_MS } from "@/lib/chat-session";
export async function unifiedInbox(
  db: Db,
  input: {
    scope?: "chat" | "site";
    status?: string;
    query?: string;
    channel?: string;
    page: number;
    assigned?: string;
    area?: string;
  },
) {
  const q = (input.query ?? "").trim().slice(0, 120),
    state = input.status ?? "open";
  const statuses =
    state === "all"
      ? Object.keys(CASE_STATUS)
      : state === "open"
        ? CASE_OPEN
        : Object.hasOwn(CASE_STATUS, state)
          ? [state]
          : CASE_OPEN;
  const filter = Prisma.sql`WHERE ((kind<>'bot' AND status IN (${Prisma.join(statuses)})) OR (${input.channel === "bot"} AND kind='bot')) AND (${!input.scope} OR (${input.scope === 'site'} AND source='site') OR (${input.scope === 'chat'} AND source<>'site')) AND (${!q} OR strpos(lower(code||' '||subject||' '||name||' '||email),lower(${q}))>0) AND (${!input.channel || input.channel === "all"} OR kind=${input.channel ?? ""}) AND (${!input.assigned} OR assigned=${input.assigned ?? ""}) AND (${!input.area} OR area=${input.area ?? ""})`;
  const union = Prisma.sql`WITH cases AS (SELECT t.id,'ticket'::text kind,t.code,t.subject,u.name,u.email,t.status,t.priority,'soporte'::text area,t."assignedTo" assigned,t."updatedAt" at,'ticket'::text source FROM "SupportTicket" t JOIN "User" u ON u.id=t."userId" UNION ALL SELECT c.id,'contact',c.code,c.subject,c.name,c.email,c.status,c.priority,c.area,c."assignedTo",c."updatedAt",CASE WHEN EXISTS (SELECT 1 FROM "ChatSession" b WHERE b."contactId"=c.id) THEN 'chat' ELSE 'site' END FROM "ContactMessage" c UNION ALL SELECT b.id,'bot',b.code,'Conversación automática',coalesce(u.name,'Visitante'),coalesce(u.email,''),CASE WHEN b."botResolved" THEN 'RESOLVED' WHEN b."updatedAt" <= ${new Date(Date.now() - BOT_CHAT_IDLE_MS)} THEN 'CLOSED' ELSE 'BOT' END,'LOW','soporte',NULL,b."updatedAt",'bot' FROM "ChatSession" b LEFT JOIN "User" u ON u.id=b."userId" WHERE b."contactId" IS NULL)`;
  const [rows, count] = await Promise.all([
    db.$queryRaw<
      {
        id: string;
        kind: "ticket" | "contact" | "bot";
        source: "chat" | "site" | "ticket" | "bot";
        code: string;
        subject: string;
        name: string;
        email: string;
        status: string;
        priority: string;
        assigned: string | null;
        at: Date;
      }[]
    >(
      Prisma.sql`${union} SELECT * FROM cases ${filter} ORDER BY CASE priority WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END,at ASC,id ASC LIMIT 25 OFFSET ${(input.page - 1) * 25}`,
    ),
    db.$queryRaw<{ n: bigint }[]>(
      Prisma.sql`${union} SELECT count(*) n FROM cases ${filter}`,
    ),
  ]);
  return { rows, total: Number(count[0]?.n ?? 0) };
}

export async function pendingSupportCounts(db: Db) {
  const status = { in: [...CASE_OPEN] };
  const [site, chats, tickets] = await Promise.all([
    db.contactMessage.count({where:{status,chatSession:{is:null}}}),
    db.contactMessage.count({where:{status,chatSession:{isNot:null}}}),
    db.supportTicket.count({where:{status}}),
  ]);
  return {site, conversations:chats+tickets};
}

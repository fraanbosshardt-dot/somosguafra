import { Prisma } from "@/generated/prisma/client";
import type { Db } from "./ledger";
import type { ChatActor, ChatSelection } from "./guafra-chat";
import { botChatStatus } from "@/lib/chat-session";

export async function chatCasePage(db: Db, actor: ChatActor, input: { page?: number; q?: string } = {}) {
  const uid = actor.user?.id ?? "", visitor = actor.visitorHash ?? "missing";
  const q = (input.q ?? "").trim().slice(0, 120);
  const union = Prisma.sql`WITH cases AS (
    SELECT s.id, 'chat'::text kind, s.code, coalesce(c.subject,
      (SELECT left(m.body,120) FROM "SupportMessage" m WHERE m."chatId"=s.id AND m.role='customer' AND m.internal=false ORDER BY m."createdAt",m.id LIMIT 1), 'Conversación con Guafra') subject,
      c.status, s."botResolved" resolved, s."updatedAt" at,
      CASE WHEN s."contactId" IS NULL THEN 'Con Guafra' ELSE 'Con el equipo' END channel
    FROM "ChatSession" s LEFT JOIN "ContactMessage" c ON c.id=s."contactId"
    WHERE (s."userId"=${uid} OR (${uid}='' AND s."userId" IS NULL AND s."visitorHash"=${visitor}))
    UNION ALL SELECT t.id,'ticket',t.code,t.subject,t.status,false,t."updatedAt",'Ayuda'
    FROM "SupportTicket" t WHERE ${uid}<>'' AND t."userId"=${uid}
    UNION ALL SELECT c.id,'contact',c.code,c.subject,c.status,false,c."updatedAt",'Formulario'
    FROM "ContactMessage" c WHERE ${uid}<>'' AND c."userId"=${uid} AND NOT EXISTS(SELECT 1 FROM "ChatSession" s WHERE s."contactId"=c.id)
  )`;
  const filter = Prisma.sql`WHERE (${q}='' OR strpos(lower(code||' '||subject),lower(${q}))>0)`;
  const counts = await db.$queryRaw<{ n: bigint }[]>(Prisma.sql`${union} SELECT count(*) n FROM cases ${filter}`);
  const total = Number(counts[0]?.n ?? 0), pages = Math.max(1, Math.ceil(total / 15));
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(input.page) ? input.page! : 1));
  const rows = await db.$queryRaw<(ChatSelection & { code: string; subject: string; status: string | null; resolved: boolean; at: Date; channel: string })[]>(Prisma.sql`${union} SELECT * FROM cases ${filter} ORDER BY at DESC,kind ASC,id DESC LIMIT 15 OFFSET ${(page - 1) * 15}`);
  return { cases: rows.map((r) => ({ ...r, status: r.status ?? botChatStatus(r.resolved, r.at), at: r.at.toISOString() })), page, pages, total };
}

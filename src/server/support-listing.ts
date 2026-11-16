import { Prisma, type PrismaClient } from "@/generated/prisma/client";

// Ordenar antes de paginar: las urgentes no pueden quedar ocultas detrás de una página vieja.
export async function supportPage(db: PrismaClient, statuses: string[], page: number, size = 25) {
  if (!statuses.length) return [];
  const ids = await db.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "SupportTicket" WHERE "status" IN (${Prisma.join(statuses)}) ORDER BY CASE "priority" WHEN 'HIGH' THEN 0 WHEN 'LOW' THEN 2 ELSE 1 END, "createdAt" ASC, "id" ASC LIMIT ${size} OFFSET ${(page - 1) * size}`);
  const tickets = await db.supportTicket.findMany({ where: { id: { in: ids.map(i => i.id) } }, include: { messages: { orderBy: { createdAt: "asc" } }, user: { select: { id: true, name: true, email: true } } } });
  const position = new Map(ids.map((item, i) => [item.id, i]));
  return tickets.sort((a, b) => position.get(a.id)! - position.get(b.id)!);
}

import type { Db } from "./ledger";
import { UserError } from "./ledger";
import { CASE_STATUS } from "@/lib/chat-help";
export async function updateSupportCase(
  db: Db,
  input: {
    kind: string;
    id: string;
    status: string;
    priority: string;
    revision: string;
  },
) {
  if (
    !["contact", "ticket"].includes(input.kind) ||
    !Object.hasOwn(CASE_STATUS, input.status) ||
    !["LOW", "NORMAL", "HIGH"].includes(input.priority) ||
    !Number.isFinite(Date.parse(input.revision))
  )
    throw new UserError("Revisá el estado y la prioridad.");
  return db.$transaction(async (tx) => {
    if (input.kind === "contact")
      await tx.$queryRaw`SELECT id FROM "ContactMessage" WHERE id=${input.id} FOR UPDATE`;
    else
      await tx.$queryRaw`SELECT id FROM "SupportTicket" WHERE id=${input.id} FOR UPDATE`;
    const before =
      input.kind === "contact"
        ? await tx.contactMessage.findUniqueOrThrow({ where: { id: input.id } })
        : await tx.supportTicket.findUniqueOrThrow({ where: { id: input.id } });
    if (before.updatedAt.toISOString() !== input.revision)
      throw new UserError(
        "El caso cambió mientras lo revisabas. Actualizá la conversación antes de cambiar su estado.",
      );
    if (input.kind === "contact") {
      await tx.contactMessage.update({
        where: { id: input.id },
        data: { status: input.status, priority: input.priority },
      });
      await tx.chatSession.updateMany({
        where: { contactId: input.id },
        data: { updatedAt: new Date() },
      });
    } else
      await tx.supportTicket.update({
        where: { id: input.id },
        data: { status: input.status, priority: input.priority },
      });
  });
}

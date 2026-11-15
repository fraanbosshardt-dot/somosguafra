import type { Prisma } from "@/generated/prisma/client";

// El mismo bloqueo se usa para conciliaciones, escrituras del libro y cupos.
// Siempre se toma antes de bloquear una obligación u otro registro del espacio.
export async function lockWorkspace(tx: Pick<Prisma.TransactionClient, "$queryRaw">, workspaceId: string) {
  await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
}

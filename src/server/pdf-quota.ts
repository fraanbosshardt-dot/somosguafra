import { randomUUID } from "node:crypto";
import type { Db } from "./ledger";
import { UserError } from "./ledger";

type Kind = "card" | "debt";
const action = (kind: Kind) => `${kind}.pdf_read`;
// A reservation is short-lived; failed parses release it, completed reads retain the existing audit format.
export async function reservePdfRead(db: Db, workspaceId: string, userId: string, kind: Kind, limit: number, now = new Date()) {
  const month = now.toISOString().slice(0, 7), prefix = `pdf/${workspaceId}/${kind}/${month}/`;
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${workspaceId} FOR UPDATE`;
    const [used, reserved] = await Promise.all([
      tx.auditLog.count({ where: { workspaceId, action: action(kind), createdAt: { gte: new Date(`${month}-01T00:00:00Z`) } } }),
      tx.jobLease.count({ where: { key: { startsWith: prefix }, expiresAt: { gt: now } } }),
    ]);
    if (used + reserved >= limit) throw new UserError("Alcanzaste el límite de lecturas o hay archivos procesándose. Esperá a que terminen o cargalo a mano.");
    const token = randomUUID(), key = prefix + token;
    await tx.jobLease.create({ data: { key, token, expiresAt: new Date(now.getTime() + 120_000) } });
    return { key, token, workspaceId, userId, kind, left: limit - used - reserved - 1 };
  });
}
export type PdfReservation = Awaited<ReturnType<typeof reservePdfRead>>;
export async function completePdfRead(db: Db, r: PdfReservation, found: string[]) {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${r.workspaceId} FOR UPDATE`;
    const removed = await tx.jobLease.deleteMany({ where: { key: r.key, token: r.token, expiresAt: { gt: new Date() } } });
    if (!removed.count) throw new UserError("La lectura venció. Volvé a cargar el archivo.");
    await tx.auditLog.create({ data: { workspaceId: r.workspaceId, userId: r.userId, action: action(r.kind), meta: { found } } });
  });
}
export async function releasePdfRead(db: Db, r: PdfReservation) {
  await db.jobLease.deleteMany({ where: { key: r.key, token: r.token } });
}

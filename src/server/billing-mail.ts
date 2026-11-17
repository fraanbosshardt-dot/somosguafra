import { reportError } from "@/lib/diagnostics";
import type { Db } from "./ledger";
import type { Prisma } from "@/generated/prisma/client";
import type { EmailPurpose } from "@/lib/email-template";
import { randomUUID } from "node:crypto";

type MailDb = Pick<Prisma.TransactionClient, "emailOutbox" | "membership">;
// Resend conserva idempotency keys 24 h. Dejar margen y exigir revisión si
// desconocemos la entrega más allá de esta ventana, en vez de enviar otra copia.
const AUTOMATIC_RETRY_WINDOW_MS = 20 * 3600_000;
const QUARANTINED_UNTIL = new Date("9999-01-01T00:00:00.000Z");

async function billingNoticeStillRelevant(db: Db, row: { workspaceId: string | null; to: string; dedupeKey: string }) {
  if (!row.workspaceId || !await db.membership.count({ where: { workspaceId: row.workspaceId, role: "OWNER", user: { email: row.to, deletedAt: null, suspendedAt: null } } })) return false;
  const event = row.dedupeKey.split("/").slice(2).join("/");
  const subscription = event.match(/^subscription-(.+)-(authorized|paused|cancelled)$/);
  if (subscription) {
    const agreement = await db.billingAgreement.findUnique({ where: { providerRef: subscription[1] } });
    if (subscription[2] === "cancelled" && await db.billingAgreement.count({ where: { workspaceId: row.workspaceId, status: { notIn: ["cancelled", "superseded"] } } })) return false;
    return agreement?.workspaceId === row.workspaceId && agreement.status === subscription[2];
  }
  const payment = event.match(/^payment-(.+)-(approved|rejected|refunded|cancelled|charged_back)$/);
  if (payment) {
    const invoice = await db.invoice.findUnique({ where: { providerRef: payment[1] } });
    return invoice?.workspaceId === row.workspaceId && invoice.status === payment[2];
  }
  const partial = event.match(/^payment-(.+)-partial-(\d+)$/);
  if (partial) {
    const invoice = await db.invoice.findUnique({ where: { providerRef: partial[1] } });
    return invoice?.workspaceId === row.workspaceId && invoice.status === "approved" && Math.round(Number(invoice.refundedAmount) * 100) === Number(partial[2]);
  }
  return true;
}

// La cola se escribe junto al cambio de negocio. Un fallo del correo no deshace una baja.
export async function queueBillingNotice(db: MailDb, ws: string, event: string, subject: string, body: string) {
  const owner = await db.membership.findFirst({ where: { workspaceId: ws, role: "OWNER", user: { deletedAt: null, suspendedAt: null } }, include: { user: true } });
  if (!owner) return;
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const dedupeKey = `billing/${ws}/${event}`;
  await db.emailOutbox.upsert({ where: { dedupeKey }, update: {}, create: { dedupeKey, workspaceId: ws, purpose: "billing", to: owner.user.email, subject,
    text: `Hola ${owner.user.name.split(" ")[0]}:\n\n${body}\n\nRevisá tu plan en ${base}/app/configuracion?tab=plan\n\nEste aviso informa el estado de tu suscripción.\n\nsomosguafra` } });
}

export async function drainEmailOutbox(db: Db, limit = 20, timeBudgetMs = 20_000) {
  const deadline = Date.now() + timeBudgetMs;
  if (!process.env.RESEND_API_KEY) return 0;
  const rows = await db.emailOutbox.findMany({ where: { sentAt: null, deliveryState: { in: ["queued", "sending"] }, nextAttemptAt: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: limit });
  let delivered = 0;
  const { sendEmail } = await import("@/lib/email");
  for (const row of rows) {
    if (Date.now() >= deadline) break;
    const now = new Date(), token = randomUUID();
    const attemptedAt = row.firstAttemptAt ?? (row.attempts > 0 ? row.createdAt : now);
    const lease = await db.emailOutbox.updateMany({ where: { id: row.id, sentAt: null, deliveryState: { in: ["queued", "sending"] }, nextAttemptAt: { lte: now } }, data: { deliveryState: "sending", deliveryToken: token, firstAttemptAt: attemptedAt, nextAttemptAt: new Date(now.getTime() + 60_000), attempts: { increment: 1 } } });
    if (!lease.count) continue;
    const claim = { id: row.id, deliveryState: "sending", deliveryToken: token };
    if (now.getTime() - attemptedAt.getTime() >= AUTOMATIC_RETRY_WINDOW_MS) {
      await db.emailOutbox.updateMany({ where: claim, data: { deliveryState: "uncertain", deliveryToken: null, nextAttemptAt: QUARANTINED_UNTIL, lastError: "delivery-uncertain-manual-review" } });
      continue;
    }
    let relevant = true;
    if (row.dedupeKey.startsWith("access/")) {
      const { validAccessNotice } = await import("./access-notices");
      relevant = await validAccessNotice(db, row.dedupeKey, new Date(), row.to);
    } else if (row.dedupeKey.startsWith("staff/")) {
      const { staffNoticeStillRelevant } = await import("./support-operations");
      relevant = await staffNoticeStillRelevant(db,row);
    } else if (row.dedupeKey.startsWith("billing/")) {
      relevant = await billingNoticeStillRelevant(db, row);
    }
    if (!relevant) { await db.emailOutbox.updateMany({ where: claim, data: { deliveryState: "suppressed", deliveryToken: null, nextAttemptAt: QUARANTINED_UNTIL, lastError: "suppressed-state-or-recipient-changed" } }); continue; }
    if (!await db.emailOutbox.count({ where: { ...claim, nextAttemptAt: { gt: new Date() } } })) continue;
    const result = await sendEmail({ purpose: row.purpose as EmailPurpose, to: row.to, subject: row.subject, text: row.text, idempotencyKey: row.dedupeKey, replyTo: row.replyTo ?? undefined });
    if (result.sent) {
      await db.emailOutbox.updateMany({ where: claim, data: { deliveryState: "sent", deliveryToken: null, sentAt: new Date(), providerId: result.id ?? null, lastError: null } });
      delivered++;
    } else {
      await db.emailOutbox.updateMany({ where: claim, data: { deliveryState: "queued", deliveryToken: null, lastError: result.reason, nextAttemptAt: new Date(Date.now() + Math.min(3600_000, 60_000 * 2 ** Math.min(row.attempts, 6))) } });
    }
  }
  return delivered;
}

export async function sendBillingNotice(db: Db, ws: string, event: string, subject: string, body: string) {
  await queueBillingNotice(db, ws, event, subject, body);
  await drainEmailOutbox(db).catch((e) => reportError("[email outbox]", e));
}

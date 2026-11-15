import type { Db } from "./ledger";
import { effectivePlan } from "./plans";

export async function operationsSnapshot(db: Db, now = new Date()) {
  const [lastRun, oldestEmail, staleAgreements, pendingReview, coveredInvoices, openSupport, openContacts] = await Promise.all([
    db.auditLog.findFirst({ where: { action: { in: ["cron.cobros", "cron.cobros_partial", "cron.cobros_failed"] } }, orderBy: { createdAt: "desc" } }),
    db.emailOutbox.findFirst({ where: { sentAt: null }, orderBy: { createdAt: "asc" }, select: { createdAt: true, lastError: true } }),
    db.billingAgreement.count({ where: { status: { in: ["pending", "authorized", "paused"] }, updatedAt: { lt: new Date(now.getTime() - 2 * 36e5) } } }),
    db.billingAgreement.count({ where: { status: { in: ["creating", "uncertain"] }, updatedAt: { lt: new Date(now.getTime() - 30 * 60_000) } } }),
    db.invoice.findMany({ where: { status: "approved", periodEnd: { gt: now } }, select: { workspaceId: true, workspace: { select: { subscription: true } } }, take: 1000 }),
    db.supportTicket.count({ where: { status: "OPEN", createdAt: { lt: new Date(now.getTime() - 3 * 864e5) } } }),
    db.contactMessage.count({ where: { status: "OPEN", createdAt: { lt: new Date(now.getTime() - 4 * 864e5) } } }),
  ]);
  const billingEnabled = !!process.env.MP_ACCESS_TOKEN;
  const ageMinutes = lastRun ? Math.max(0, Math.floor((now.getTime() - lastRun.createdAt.getTime()) / 60_000)) : null;
  const emailAgeMinutes = oldestEmail ? Math.max(0, Math.floor((now.getTime() - oldestEmail.createdAt.getTime()) / 60_000)) : 0;
  const paidWithoutAccess = new Set(coveredInvoices.filter((i) => effectivePlan(i.workspace.subscription, now) !== "PRO").map((i) => i.workspaceId)).size;
  const issues = [
    ...(billingEnabled && (ageMinutes === null || ageMinutes > 45) ? ["La recuperación de cobros lleva más de 45 minutos sin confirmar ejecución."] : []),
    ...(lastRun && lastRun.action !== "cron.cobros" ? ["La última recuperación tuvo errores; revisá la actividad."] : []),
    ...(emailAgeMinutes > 60 ? ["Hay correos pendientes hace más de una hora."] : []),
    ...(staleAgreements ? [`${staleAgreements} acuerdos llevan más de dos horas sin sincronizar.`] : []),
    ...(pendingReview ? [`${pendingReview} altas necesitan revisión desde hace más de 30 minutos.`] : []),
    ...(paidWithoutAccess ? [`${paidWithoutAccess} espacios tienen un pago vigente sin acceso Pro efectivo.`] : []),
  ];
  return { ok: issues.length === 0, checkedAt: now.toISOString(), ageMinutes, emailAgeMinutes, staleAgreements, pendingReview, paidWithoutAccess, openSupport, openContacts, issues };
}

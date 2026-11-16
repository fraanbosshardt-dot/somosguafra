import type { Db } from "./ledger";

export async function operationsSnapshot(db: Db, now = new Date()) {
  const [lastRun, oldestEmail, staleAgreements, pendingReview, uncovered, openSupport, openContacts, uncertainEmails, cancellationIntents, duplicates] = await Promise.all([
    db.auditLog.findFirst({ where: { action: { in: ["cron.cobros", "cron.cobros_partial", "cron.cobros_failed"] } }, orderBy: { createdAt: "desc" } }),
    db.emailOutbox.findFirst({ where: { sentAt: null, deliveryState: { in: ["queued", "sending"] } }, orderBy: { createdAt: "asc" }, select: { createdAt: true, lastError: true } }),
    db.billingAgreement.count({ where: { status: { in: ["pending", "authorized", "paused"] }, OR: [{ lastReconciledAt: { lt: new Date(now.getTime() - 2 * 36e5) } }, { lastReconciledAt: null, createdAt: { lt: new Date(now.getTime() - 2 * 36e5) } }] } }),
    db.billingAgreement.count({ where: { status: { in: ["creating", "uncertain"] }, updatedAt: { lt: new Date(now.getTime() - 30 * 60_000) } } }),
    // Contar en DB todos los espacios; un take:1000 ocultaba incidentes posteriores.
    // La expresión refleja effectivePlan, incluido TRIALING y concesión manual.
    db.$queryRaw<{ count: number }[]>`SELECT COUNT(DISTINCT i."workspaceId")::int AS count FROM "Invoice" i
      JOIN "Workspace" w ON w.id = i."workspaceId"
      LEFT JOIN "Subscription" s ON s."workspaceId" = w.id
      WHERE w."archivedAt" IS NULL AND i.status = 'approved' AND i."periodEnd" > ${now}
      AND NOT COALESCE(CASE WHEN s.status = 'TRIALING' THEN s."trialEndsAt" > ${now}
        WHEN s.plan = 'PRO' THEN s."trialEndsAt" > ${now}
          OR (s.status = 'ACTIVE' AND s.provider IS DISTINCT FROM 'mercadopago' AND s."trialEndsAt" IS NULL AND s."currentPeriodEnd" IS NULL)
          OR s."currentPeriodEnd" > ${now}
        ELSE false END, false)`,
    db.supportTicket.count({ where: { status: "OPEN", createdAt: { lt: new Date(now.getTime() - 3 * 864e5) } } }),
    db.contactMessage.count({ where: { status: "OPEN", createdAt: { lt: new Date(now.getTime() - 4 * 864e5) } } }),
    db.emailOutbox.count({ where: { deliveryState: "uncertain", sentAt: null } }),
    db.billingAgreement.count({ where: { cancelRequestedAt: { lt: new Date(now.getTime() - 5 * 60_000) } } }),
    db.$queryRaw<{ count: number }[]>`SELECT COUNT(*)::int AS count FROM (SELECT "workspaceId" FROM "BillingAgreement" WHERE status IN ('authorized', 'paused') GROUP BY "workspaceId" HAVING COUNT(*) > 1) conflicts`,
  ]);
  const billingEnabled = !!process.env.MP_ACCESS_TOKEN;
  const ageMinutes = lastRun ? Math.max(0, Math.floor((now.getTime() - lastRun.createdAt.getTime()) / 60_000)) : null;
  const emailAgeMinutes = oldestEmail ? Math.max(0, Math.floor((now.getTime() - oldestEmail.createdAt.getTime()) / 60_000)) : 0;
  const paidWithoutAccess = uncovered[0]?.count ?? 0;
  const duplicateContracts = duplicates[0]?.count ?? 0;
  const issues = [
    ...(billingEnabled && (ageMinutes === null || ageMinutes > 45) ? ["La recuperación de cobros lleva más de 45 minutos sin confirmar ejecución."] : []),
    ...(lastRun && lastRun.action !== "cron.cobros" ? ["La última recuperación tuvo errores; revisá la actividad."] : []),
    ...(emailAgeMinutes > 60 ? ["Hay correos pendientes hace más de una hora."] : []),
    ...(staleAgreements ? [`${staleAgreements} acuerdos llevan más de dos horas sin sincronizar.`] : []),
    ...(pendingReview ? [`${pendingReview} altas necesitan revisión desde hace más de 30 minutos.`] : []),
    ...(paidWithoutAccess ? [`${paidWithoutAccess} espacios tienen un pago vigente sin acceso Pro efectivo.`] : []),
    ...(uncertainEmails ? [`${uncertainEmails} correos tienen entrega incierta; requieren revisión antes de reenviar.`] : []),
    ...(cancellationIntents ? [`${cancellationIntents} cancelaciones llevan más de cinco minutos sin confirmación.`] : []),
    ...(duplicateContracts ? [`${duplicateContracts} espacios tienen varios contratos autorizados o pausados; revisar con el proveedor.`] : []),
  ];
  return { ok: issues.length === 0, checkedAt: now.toISOString(), ageMinutes, emailAgeMinutes, staleAgreements, pendingReview, paidWithoutAccess, uncertainEmails, cancellationIntents, duplicateContracts, openSupport, openContacts, issues };
}

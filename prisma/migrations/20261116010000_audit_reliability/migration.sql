ALTER TABLE "Workspace" ADD COLUMN "archivedAt" TIMESTAMP(3);
-- Defense in depth: even an older application or accidental raw delete cannot cascade away the business ledger.
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_workspaceId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingAgreement" DROP CONSTRAINT "BillingAgreement_workspaceId_fkey";
ALTER TABLE "BillingAgreement" ADD CONSTRAINT "BillingAgreement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentEvent" DROP CONSTRAINT "PaymentEvent_invoiceId_fkey";
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingAgreement" ADD COLUMN "reconcileOffset" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastReconciledAt" TIMESTAMP(3),
  ADD COLUMN "cancelRequestedAt" TIMESTAMP(3),
  ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "EmailOutbox" ADD COLUMN "firstAttemptAt" TIMESTAMP(3),
  ADD COLUMN "deliveryState" TEXT NOT NULL DEFAULT 'queued',
  ADD COLUMN "deliveryToken" TEXT;
UPDATE "EmailOutbox" SET "deliveryState" = 'sent' WHERE "sentAt" IS NOT NULL;
-- Older versions marked suppressed messages with sentAt even though they were not delivered.
UPDATE "EmailOutbox" SET "deliveryState" = 'suppressed', "sentAt" = NULL, "nextAttemptAt" = TIMESTAMP '9999-01-01'
  WHERE "lastError" LIKE 'suppressed-%';
-- Existing attempts have no proven remote outcome: do not replay outside the provider window.
UPDATE "EmailOutbox" SET "firstAttemptAt" = "createdAt" WHERE "attempts" > 0;
-- Keep old deployments from replaying these rows during rollout/rollback: they also respect nextAttemptAt.
UPDATE "EmailOutbox" SET "deliveryState" = 'uncertain', "nextAttemptAt" = TIMESTAMP '9999-01-01',
  "lastError" = 'delivery-uncertain-manual-review'
  WHERE "sentAt" IS NULL AND "deliveryState" = 'queued' AND "attempts" > 0
  AND "firstAttemptAt" < CURRENT_TIMESTAMP - INTERVAL '20 hours';
CREATE INDEX "BillingAgreement_lastReconciledAt_idx" ON "BillingAgreement"("lastReconciledAt");
CREATE INDEX "EmailOutbox_deliveryState_nextAttemptAt_idx" ON "EmailOutbox"("deliveryState", "nextAttemptAt");

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "excludeFromMetrics" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "assignedTo" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "feeAmount" DECIMAL(18,2),
ADD COLUMN     "feeDetails" JSONB,
ADD COLUMN     "financialSyncedAt" TIMESTAMP(3),
ADD COLUMN     "netAmount" DECIMAL(18,2),
ADD COLUMN     "releaseAt" TIMESTAMP(3),
ADD COLUMN     "releaseStatus" TEXT;

-- AlterTable
ALTER TABLE "EmailOutbox" ADD COLUMN     "replyTo" TEXT;

-- AlterTable
ALTER TABLE "CompanyCost" ADD COLUMN     "endedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ContactMessage" ADD COLUMN     "assignedTo" TEXT,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT,
    "contactId" TEXT,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author" TEXT,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "estimatedDate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyExpense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportMessage_dedupeKey_key" ON "SupportMessage"("dedupeKey");

-- CreateIndex
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_contactId_createdAt_idx" ON "SupportMessage"("contactId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_key_key" ON "PaymentEvent"("key");

-- CreateIndex
CREATE INDEX "PaymentEvent_occurredAt_idx" ON "PaymentEvent"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductActivity_userId_day_key" ON "ProductActivity"("userId", "day");

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_exactly_one_parent" CHECK (("ticketId" IS NOT NULL)::int + ("contactId" IS NOT NULL)::int = 1);
INSERT INTO "AppSetting" ("key","value","updatedAt") VALUES ('analyticsStartedAt', to_jsonb(CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
INSERT INTO "PaymentEvent" ("id","invoiceId","key","kind","amount","currency","occurredAt","estimatedDate","createdAt") SELECT 'gross-' || "id", "id", 'payment/' || "id" || '/gross', 'gross', "amount", "currency", "paidAt", false, CURRENT_TIMESTAMP FROM "Invoice" WHERE "paidAt" IS NOT NULL AND "status" IN ('approved','refunded','charged_back') ON CONFLICT DO NOTHING;
INSERT INTO "PaymentEvent" ("id","invoiceId","key","kind","amount","currency","occurredAt","estimatedDate","createdAt") SELECT 'reverse-' || "id", "id", 'payment/' || "id" || '/reversed/' || to_char(CASE WHEN "status" IN ('refunded','charged_back') THEN "amount" ELSE "refundedAmount" END, 'FM9999999999999990.00'), CASE WHEN "status" = 'charged_back' THEN 'chargeback' ELSE 'refund' END, CASE WHEN "status" IN ('refunded','charged_back') THEN "amount" ELSE "refundedAmount" END, "currency", COALESCE("providerUpdatedAt",CURRENT_TIMESTAMP), true, CURRENT_TIMESTAMP FROM "Invoice" WHERE "paidAt" IS NOT NULL AND ("refundedAmount" > 0 OR "status" IN ('refunded','charged_back')) ON CONFLICT DO NOTHING;

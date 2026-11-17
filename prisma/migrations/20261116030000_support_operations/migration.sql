CREATE TABLE "SupportReplyLease" (
 "id" TEXT PRIMARY KEY, "ticketId" TEXT UNIQUE REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "contactId" TEXT UNIQUE REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "ownerEmail" TEXT NOT NULL, "sessionId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL,
 "revision" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "SupportReplyLease_parent" CHECK (num_nonnulls("ticketId","contactId")=1)
);
CREATE INDEX "SupportReplyLease_expiresAt_idx" ON "SupportReplyLease"("expiresAt");
CREATE TABLE "AdminSupportNotice" (
 "id" TEXT PRIMARY KEY, "eventKey" TEXT NOT NULL UNIQUE, "recipient" TEXT NOT NULL,
 "kind" TEXT NOT NULL, "caseId" TEXT NOT NULL,
 "ticketId" TEXT REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "contactId" TEXT REFERENCES "ContactMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "code" TEXT NOT NULL, "type" TEXT NOT NULL, "priority" TEXT NOT NULL DEFAULT 'NORMAL',
 "activityAt" TIMESTAMP(3) NOT NULL, "readAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AdminSupportNotice_parent" CHECK (
  ("kind"='ticket' AND "ticketId"="caseId" AND "ticketId" IS NOT NULL AND "contactId" IS NULL) OR
  ("kind"='contact' AND "contactId"="caseId" AND "contactId" IS NOT NULL AND "ticketId" IS NULL)
 )
);
CREATE INDEX "AdminSupportNotice_recipient_readAt_updatedAt_idx" ON "AdminSupportNotice"("recipient","readAt","updatedAt");
CREATE INDEX "AdminSupportNotice_kind_caseId_type_activityAt_idx" ON "AdminSupportNotice"("kind","caseId","type","activityAt");

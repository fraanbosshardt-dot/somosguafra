BEGIN;
ALTER TABLE "SupportTicket" ADD COLUMN "code" TEXT;
UPDATE "SupportTicket" SET "code" = 'SG-T-' || upper(id);
ALTER TABLE "SupportTicket" ALTER COLUMN "code" SET NOT NULL;
-- Preserve old application writes while deploying or rolling back the additive migration.
ALTER TABLE "SupportTicket" ALTER COLUMN "code" SET DEFAULT ('SG-T-' || upper(replace(gen_random_uuid()::text, '-', '')));
CREATE UNIQUE INDEX "SupportTicket_code_key" ON "SupportTicket"("code");
CREATE TABLE "ChatSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "visitorHash" TEXT,
  "userId" TEXT REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "contactId" TEXT REFERENCES "ContactMessage"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "source" TEXT NOT NULL DEFAULT 'site',
  "botResolved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatSession_actor_check" CHECK ("userId" IS NOT NULL OR "visitorHash" IS NOT NULL)
);
CREATE UNIQUE INDEX "ChatSession_code_key" ON "ChatSession"("code");
CREATE UNIQUE INDEX "ChatSession_contactId_key" ON "ChatSession"("contactId");
CREATE INDEX "ChatSession_visitorHash_updatedAt_idx" ON "ChatSession"("visitorHash","updatedAt");
CREATE INDEX "ChatSession_userId_updatedAt_idx" ON "ChatSession"("userId","updatedAt");
CREATE INDEX "ChatSession_contactId_updatedAt_idx" ON "ChatSession"("contactId","updatedAt");
ALTER TABLE "SupportMessage" ADD COLUMN "chatId" TEXT REFERENCES "ChatSession"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD COLUMN "botTopic" TEXT;
CREATE INDEX "SupportMessage_chatId_createdAt_idx" ON "SupportMessage"("chatId","createdAt");
ALTER TABLE "SupportMessage" DROP CONSTRAINT "SupportMessage_exactly_one_parent";
-- A chat is an access envelope. On handoff its messages also belong to its contact case.
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_exactly_one_parent" CHECK (
 ("ticketId" IS NOT NULL AND "contactId" IS NULL AND "chatId" IS NULL)
 OR ("ticketId" IS NULL AND ("contactId" IS NOT NULL OR "chatId" IS NOT NULL))
);
COMMIT;

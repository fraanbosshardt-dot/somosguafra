ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3), ADD COLUMN "termsVersion" TEXT, ADD COLUMN "termsChannel" TEXT;
ALTER TABLE "Workspace" ADD COLUMN "referralCreditDays" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "RecoveryCode" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "usedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "RecoveryCode_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "RecoveryCode_tokenHash_key" ON "RecoveryCode"("tokenHash");
CREATE INDEX "RecoveryCode_userId_idx" ON "RecoveryCode"("userId");
ALTER TABLE "RecoveryCode" ADD CONSTRAINT "RecoveryCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "JobLease" ("key" TEXT NOT NULL, "token" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "JobLease_pkey" PRIMARY KEY ("key"));
ALTER TABLE "Obligation" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "Obligation_workspaceId_idempotencyKey_key" ON "Obligation"("workspaceId", "idempotencyKey");

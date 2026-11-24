-- Solo agrega preferencias opcionales; no suscribe a usuarios existentes.
CREATE TABLE "CommunicationPreference" (
  "userId" TEXT NOT NULL,
  "tips" BOOLEAN NOT NULL DEFAULT false,
  "news" BOOLEAN NOT NULL DEFAULT false,
  "offers" BOOLEAN NOT NULL DEFAULT false,
  "consentVersion" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "CommunicationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

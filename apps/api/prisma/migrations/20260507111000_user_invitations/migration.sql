-- Invitaciones de usuario (onboarding por link seguro).
CREATE TABLE "UserInvitation" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "roleIdsJson" TEXT,
  "nameHint" TEXT,
  "fullNameHint" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "createdByUserId" TEXT NOT NULL,
  "acceptedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserInvitation_tokenHash_key" ON "UserInvitation"("tokenHash");
CREATE INDEX "UserInvitation_companyId_createdAt_idx" ON "UserInvitation"("companyId", "createdAt");
CREATE INDEX "UserInvitation_email_createdAt_idx" ON "UserInvitation"("email", "createdAt");
CREATE INDEX "UserInvitation_active_expiresAt_idx" ON "UserInvitation"("active", "expiresAt");

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserInvitation"
  ADD CONSTRAINT "UserInvitation_acceptedByUserId_fkey"
  FOREIGN KEY ("acceptedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;


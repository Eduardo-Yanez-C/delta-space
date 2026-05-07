-- Auditoría de acciones (admin y mutaciones críticas).
-- Nota: esta migración debe tolerar ejecuciones parciales en despliegues fallidos (Railway).
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "entityCompanyId" TEXT,
  "beforeJson" TEXT,
  "afterJson" TEXT,
  "metaJson" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_companyId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_userId_fkey'
  ) THEN
    ALTER TABLE "AuditLog"
      ADD CONSTRAINT "AuditLog_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;


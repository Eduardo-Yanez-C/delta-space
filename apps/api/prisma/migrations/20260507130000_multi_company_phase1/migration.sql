-- Multi-empresa (Fase 1): Company + companyId en User/Client/Quote/FvStudy.
-- Estrategia:
-- 1) Crear Company.
-- 2) Insertar empresa Default (slug: default).
-- 3) Agregar columnas companyId (nullable) y backfill con Default / join por Client.
-- 4) Hacer NOT NULL + FKs + índices.

-- 1) Company
CREATE TABLE "Company" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- 2) Default company (si ya existe por re-ejecución manual, no duplicar).
INSERT INTO "Company" ("id", "name", "slug", "active", "createdAt", "updatedAt")
SELECT 'company_default', 'Empresa Default', 'default', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Company" WHERE "slug" = 'default');

-- 3) Columnas + backfill
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
UPDATE "User" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;

ALTER TABLE "Client" ADD COLUMN "companyId" TEXT;
UPDATE "Client" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;

ALTER TABLE "FvStudy" ADD COLUMN "companyId" TEXT;
UPDATE "FvStudy" s
SET "companyId" = c."companyId"
FROM "Client" c
WHERE s."clientId" = c."id" AND s."companyId" IS NULL;
UPDATE "FvStudy" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;

ALTER TABLE "Quote" ADD COLUMN "companyId" TEXT;
UPDATE "Quote" q
SET "companyId" = c."companyId"
FROM "Client" c
WHERE q."clientId" = c."id" AND q."companyId" IS NULL;
UPDATE "Quote" SET "companyId" = 'company_default' WHERE "companyId" IS NULL;

-- 4) NOT NULL + FKs + índices
ALTER TABLE "User" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "FvStudy" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Quote" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "User"
ADD CONSTRAINT "User_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FvStudy"
ADD CONSTRAINT "FvStudy_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote"
ADD CONSTRAINT "Quote_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");
CREATE INDEX "FvStudy_companyId_idx" ON "FvStudy"("companyId");
CREATE INDEX "Quote_companyId_idx" ON "Quote"("companyId");

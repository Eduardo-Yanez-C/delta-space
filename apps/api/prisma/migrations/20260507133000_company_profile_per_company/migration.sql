-- CompanyProfile por empresa (tenant).
-- Antes: singleton con PK id='singleton'.

-- 1) Crear tabla nueva con PK companyId.
CREATE TABLE "CompanyProfile_new" (
  "companyId" TEXT NOT NULL,
  "logoRelativePath" TEXT,
  "logoMimeType" TEXT,
  "commercialName" TEXT,
  "legalName" TEXT,
  "taxId" TEXT,
  "businessActivity" TEXT,
  "address" TEXT,
  "commune" TEXT,
  "region" TEXT,
  "country" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "website" TEXT,
  "instagramUrl" TEXT,
  "facebookUrl" TEXT,
  "bankName" TEXT,
  "accountType" TEXT,
  "accountNumber" TEXT,
  "accountHolderName" TEXT,
  "accountHolderTaxId" TEXT,
  "transferReceiptEmail" TEXT,
  "generalNotes" TEXT,
  "quoteNote" TEXT,
  "paymentTerms" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyProfile_new_pkey" PRIMARY KEY ("companyId")
);

ALTER TABLE "CompanyProfile_new"
  ADD CONSTRAINT "CompanyProfile_new_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2) Migrar datos existentes del singleton a company_default (si existe).
INSERT INTO "CompanyProfile_new" (
  "companyId",
  "logoRelativePath",
  "logoMimeType",
  "commercialName",
  "legalName",
  "taxId",
  "businessActivity",
  "address",
  "commune",
  "region",
  "country",
  "phone",
  "email",
  "website",
  "instagramUrl",
  "facebookUrl",
  "bankName",
  "accountType",
  "accountNumber",
  "accountHolderName",
  "accountHolderTaxId",
  "transferReceiptEmail",
  "generalNotes",
  "quoteNote",
  "paymentTerms",
  "createdAt",
  "updatedAt"
)
SELECT
  'company_default',
  cp."logoRelativePath",
  cp."logoMimeType",
  cp."commercialName",
  cp."legalName",
  cp."taxId",
  cp."businessActivity",
  cp."address",
  cp."commune",
  cp."region",
  cp."country",
  cp."phone",
  cp."email",
  cp."website",
  cp."instagramUrl",
  cp."facebookUrl",
  cp."bankName",
  cp."accountType",
  cp."accountNumber",
  cp."accountHolderName",
  cp."accountHolderTaxId",
  cp."transferReceiptEmail",
  cp."generalNotes",
  cp."quoteNote",
  cp."paymentTerms",
  cp."createdAt",
  cp."updatedAt"
FROM "CompanyProfile" cp
WHERE cp."id" = 'singleton'
ON CONFLICT ("companyId") DO NOTHING;

-- 3) Reemplazar tabla.
DROP TABLE "CompanyProfile";
ALTER TABLE "CompanyProfile_new" RENAME TO "CompanyProfile";


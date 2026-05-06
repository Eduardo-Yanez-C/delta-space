-- Campos alineados a Software de Mejora (resumen de proyecto / suite).
ALTER TABLE "Project" ADD COLUMN "location" TEXT;
ALTER TABLE "Project" ADD COLUMN "startDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Project" ADD COLUMN "endDate" DATETIME;
ALTER TABLE "Project" ADD COLUMN "progress" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Project" ADD COLUMN "description" TEXT;

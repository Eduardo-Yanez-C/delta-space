-- AlterTable
ALTER TABLE "FvStudy" ADD COLUMN "utilityGridAvailable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "FvStudy" ADD COLUMN "gridExportEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Backfill: estudios off-grid históricos → aislado (sin red / sin inyección)
UPDATE "FvStudy" SET "utilityGridAvailable" = 0, "gridExportEnabled" = 0 WHERE "systemType" = 'OFF_GRID';

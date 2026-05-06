-- Estados de transporte terrestre por proyecto (JSON, misma forma que taskStatusConfig).
ALTER TABLE "Project" ADD COLUMN "logisticsTransportStatusConfig" TEXT;

-- Archivo suave por miembro: ocultar conversación en listado sin borrar historial.
ALTER TABLE "ConversationMember" ADD COLUMN "archivedAt" DATETIME;

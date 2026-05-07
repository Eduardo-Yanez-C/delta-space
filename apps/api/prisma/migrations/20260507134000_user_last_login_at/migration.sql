-- Último login exitoso del usuario (para dashboard admin).
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);


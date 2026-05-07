-- Licencia de acceso por usuario: tras esta fecha no puede iniciar sesión ni usar JWT.
ALTER TABLE "User" ADD COLUMN "accessExpiresAt" TIMESTAMP(3);

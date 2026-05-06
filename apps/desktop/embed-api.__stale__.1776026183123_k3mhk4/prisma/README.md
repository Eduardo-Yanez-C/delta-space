# Prisma — API y empaquetado escritorio

## Dónde vive el esquema hoy

- **Layout A (documentado históricamente):** `prisma/desktop/` con `schema.prisma` (SQLite) y `prisma/desktop/migrations/`. El servidor usaría otro esquema (p. ej. PostgreSQL) en `prisma/schema.prisma` en la raíz de `prisma/`.
- **Layout B (estado actual del repo):** un solo `prisma/schema.prisma` con `provider = "sqlite"` y migraciones en `prisma/migrations/`. La carpeta `prisma/desktop/` **no existe**; el script `apps/desktop/scripts/prepare-embedded-backend.js` detecta esto y copia **`prisma/` completo** hacia `embed-api/prisma/`.

Si en el futuro volvéis a separar PostgreSQL (servidor) y SQLite (portable), recread `prisma/desktop/` con el esquema SQLite y sus migraciones; el preparador del build usará esa carpeta automáticamente cuando exista.

## Qué debe contener `prisma/desktop` (cuando se use)

- `schema.prisma` — mismo modelo de dominio que la API, `datasource` SQLite y `DATABASE_URL` por env.
- `migrations/` — solo migraciones aplicables a SQLite (no mezclar con migraciones de otro motor).
- `migration_lock.toml` — suele ir junto al árbol de migraciones según genera Prisma.

No hace falta duplicar `seed.ts` ahí: el empaquetado copia `prisma/seed.ts` desde la raíz del API.

## Comandos útiles

Con layout A, desde `apps/api`:

```powershell
$env:DATABASE_URL="file:./dev-desktop.sqlite"
npx prisma migrate deploy --schema=prisma/desktop/schema.prisma
```

Con layout B (schema en raíz):

```powershell
$env:DATABASE_URL="file:./dev.sqlite"
npx prisma migrate deploy
```

**Generar cliente para el `.exe`:** solo dentro de `apps/desktop/embed-api` tras `prepare-embedded-backend` (no ejecutar un segundo `prisma generate` con otro schema en `apps/api` si eso sobrescribiría el cliente que usa el servidor).

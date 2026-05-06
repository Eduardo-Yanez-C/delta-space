# Prisma — API (PostgreSQL) y escritorio portable (SQLite)

## Estado actual del monorepo

| Área | Ubicación | Motor | Migraciones |
|------|-----------|-------|-------------|
| **API** (local, CI, nube) | `prisma/schema.prisma` | **PostgreSQL** | `prisma/migrations/` (`migration_lock.toml` = postgresql) |
| **Desktop / .exe portable** | `prisma/desktop/schema.prisma` | **SQLite** | `prisma/desktop/migrations/` (`prisma/desktop/migration_lock.toml` = sqlite) |

El script `apps/desktop/scripts/prepare-embedded-backend.js` copia **`prisma/desktop/`** al `embed-api` cuando esa carpeta existe; así el bundle genera el cliente Prisma **SQLite** sin mezclar el historial Postgres del servidor.

`prisma/seed.ts` y otros seeds en `prisma/` se copian desde la raíz del API al embed según el preparador; no hace falta duplicarlos dentro de `desktop/`.

## Comandos útiles

### API con PostgreSQL (recomendado también en local)

```powershell
cd apps/api
docker compose -f docker-compose.postgres.yml up -d
# .env: DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/delta_space_dev?schema=public
npx prisma migrate deploy
npm run build
npm run start:prod
```

### Validar solo el schema SQLite del escritorio

```powershell
cd apps/api
$env:DATABASE_URL="file:./_tmp.sqlite"
npx prisma validate --schema=prisma/desktop/schema.prisma
```

### Migración de datos SQLite → Postgres (una vez)

Ver **`docs/deploy/MIGRACION_SQLITE_POSTGRES.md`**.

## Reglas

- **No** aplicar migraciones de `prisma/desktop/migrations/` contra PostgreSQL.
- **No** aplicar migraciones de `prisma/migrations/` (Postgres) contra el archivo SQLite del portable.
- Producción: solo `prisma migrate deploy` con `DATABASE_URL` de Supabase; evitar `db push` en entornos compartidos.

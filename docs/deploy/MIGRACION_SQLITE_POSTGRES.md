# Migración controlada: SQLite → PostgreSQL (Supabase / local)

Este documento cierra el plan de migración del **API en nube y desarrollo con `apps/api/prisma/schema.prisma`**, manteniendo **SQLite solo para el escritorio portable** en `apps/api/prisma/desktop/`.

---

## 1. Estrategia elegida (y por qué)

**Opción B (recomendada): PostgreSQL también en desarrollo local**, vía Docker (`apps/api/docker-compose.postgres.yml`) o una base dev en Supabase.

Motivos:

- Mismo motor y mismas migraciones que producción → menos sorpresas en `migrate deploy`.
- Los tipos (`BOOLEAN`, `TIMESTAMP`, comillas en identificadores) coinciden con Supabase.
- SQLite queda **acotado al embed** (`prisma/desktop/`), con su propio historial de migraciones, sin mezclar SQL de motores.

**Opción A** (Postgres solo en prod y SQLite en local con el schema raíz en Postgres) es **incoherente** con un solo `schema.prisma` en Postgres: el cliente Prisma y `DATABASE_URL` del API local deben apuntar a Postgres para que `start:dev` / `build:local` funcionen con `migrate deploy`.

---

## 2. Cambios en `schema.prisma` (raíz API)

- `datasource db`: `provider = "postgresql"` y `url = env("DATABASE_URL")`.
- El modelo de dominio sigue siendo el mismo; no se reutilizan archivos SQL de migraciones SQLite en Postgres.

Copia **solo escritorio**: `prisma/desktop/schema.prisma` (SQLite) + `prisma/desktop/migrations/` + `prisma/desktop/migration_lock.toml`.

---

## 3. Cómo se generó la estructura PostgreSQL

1. Baseline único compatible con Postgres: carpeta `apps/api/prisma/migrations/20260206120000_postgresql_baseline/` generada con:

   ```bash
   cd apps/api
   npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script -o prisma/migrations/20260206120000_postgresql_baseline/migration.sql
   ```

2. `prisma/migrations/migration_lock.toml` con `provider = "postgresql"`.

3. Aplicación en la base vacía:

   ```bash
   DATABASE_URL="postgresql://..." npx prisma migrate deploy
   ```

No se aplican las carpetas antiguas de SQLite a Postgres; el historial SQLite permanece en `prisma/desktop/migrations/` por trazabilidad.

---

## 4. Cómo migrar los datos (sin perder filas)

Orden seguro:

1. **Respaldo SQLite** (obligatorio antes de tocar nada):

   ```powershell
   cd apps/api
   powershell -File prisma/scripts/backup-sqlite.ps1
   ```

   Opcional: `$env:SOURCE_DATABASE_URL = "file:./dev.sqlite"`.

2. Postgres **vacío** con esquema ya aplicado (`migrate deploy`).

3. Script Node que copia tabla por tabla (omite `_prisma_migrations` del SQLite; en Postgres se conserva el historial aplicado por Prisma):

   ```powershell
   $env:SOURCE_DATABASE_URL = "file:./dev.sqlite"
   $env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/delta_space_dev?schema=public"
   npm run migrate:data:sqlite-to-pg --workspace=api
   ```

4. Ajuste de secuencias para tablas con `Int @id @default(autoincrement())`: el script llama a `setval` en `Role`, `ProductCategory`, `Brand`, `ProductModel`.

**Alternativa industrial:** [pgloader](https://pgloader.io/) desde WSL/Linux si preferís una herramienta madura; el esquema origen/destino debe coincidir con el baseline.

---

## 5. Scripts añadidos o relevantes

| Ruta / comando | Uso |
|----------------|-----|
| `prisma/scripts/backup-sqlite.ps1` | Copia el `.sqlite` a `prisma/backups/sqlite-backup-*.sqlite`. |
| `npm run migrate:data:sqlite-to-pg --workspace=api` | Copia datos SQLite → Postgres vacío. |
| `npm run migrate:verify-counts --workspace=api` | Compara conteos por tabla (misma `SOURCE_DATABASE_URL` + `DATABASE_URL`). |
| `docker-compose.postgres.yml` | Postgres 16 local (`delta_space_dev`). |
| `npm run prisma:deploy` | `migrate deploy` (prod / staging / local PG). |
| `npm run build:local` / `start:dev` | `migrate deploy` + `generate` + `tsc` (requieren `DATABASE_URL` Postgres). |

Escritorio portable: sigue usando `prisma/desktop/` y su propio `DATABASE_URL` en el flujo de empaquetado (ver `docs/DESKTOP_BACKEND_EMBEDDED.md`).

---

## 6. Validación de integridad

1. Conteos:

   ```powershell
   $env:SOURCE_DATABASE_URL = "file:./dev.sqlite"
   $env:DATABASE_URL = "postgresql://..."
   npm run migrate:verify-counts --workspace=api
   ```

2. API: `GET /api/health` (incluye ping a DB si está cableado).

3. Manual: login, CRUD de cotizaciones, clientes, proyectos, catálogo, conversaciones según lo que uséis en producción.

---

## 7. Configuración final de `DATABASE_URL`

- **Local Docker:** `postgresql://postgres:postgres@127.0.0.1:5432/delta_space_dev?schema=public`
- **Supabase:** cadena del panel (**Session mode** suele ser la adecuada para Prisma**; seguid la doc actual de Supabase + Prisma para pooler y `?sslmode=require` si aplica).

`apps/api/.env` no debe committearse; actualizar a partir de `.env.example`.

---

## 8. Dev vs producción

| Entorno | Base | Schema Prisma | Migraciones |
|---------|------|---------------|-------------|
| API local / CI / nube | PostgreSQL | `prisma/schema.prisma` | `prisma/migrations/` (Postgres) |
| `.exe` portable | SQLite | `prisma/desktop/schema.prisma` | `prisma/desktop/migrations/` |

---

## 9. Archivos tocados en esta migración (referencia)

- `apps/api/prisma/schema.prisma` — provider Postgres.
- `apps/api/prisma/migrations/20260206120000_postgresql_baseline/` — baseline SQL.
- `apps/api/prisma/migrations/migration_lock.toml` — `postgresql`.
- `apps/api/prisma/desktop/*` — SQLite + historial movido.
- `apps/api/package.json` — scripts `build:local`, `start:dev`, migración de datos, deps `pg` / `better-sqlite3`.
- `apps/api/docker-compose.postgres.yml`, `prisma/scripts/*`, `apps/api/.gitignore`.
- `.github/workflows/ci.yml` — Postgres de servicio + `DATABASE_URL` + `migrate deploy`.
- Documentación: este archivo, `DEPLOY.md`, `prisma/README.md`, `.env.example`.

---

## 10. Riesgos detectados

- **`DATABASE_URL` en `.env` antigua con `file:`:** `prisma validate` falla (P1012). Solución: usar Postgres en `.env` para el API o exportar `DATABASE_URL` en la shell antes del comando.
- **Destino no vacío:** el script de datos aborta si hay filas (salvo `ALLOW_NONEMPTY_TARGET=1`).
- **Volúmenes de datos muy grandes:** el script inserta fila a fila; puede ser lento; valorar pgloader o lotes.
- **Diferencias futuras entre `desktop/schema` y raíz:** si se añaden modelos solo a uno de los dos, el portable y el servidor divergen.

---

## 11. Qué podría romperse

- CI o scripts que asumen SQLite en la raíz del API.
- Cualquier `DATABASE_URL=file:` dejado en el mismo `.env` que usa el API Nest para arrancar en modo “servidor”.
- `postinstall` (`prisma generate`) si `DATABASE_URL` no es válido como URL — el **formato** lo valida el datasource; usar URL Postgres aunque la DB no exista en ese momento puede bastar para `generate` (no conecta). Si falla, definid una URL dummy `postgresql://localhost/dummy` solo para generate en entornos especiales.

---

## 12. Cómo revertir si algo falla

1. **Código:** `git checkout` / revert del merge a la rama anterior.
2. **Datos SQLite:** restaurar el archivo desde `prisma/backups/sqlite-backup-*.sqlite` (copiar de vuelta a `dev.sqlite` o la ruta que uséis).
3. **PostgreSQL:** no tocar producción hasta validar en copia; en local, `docker compose down -v` borra el volumen (pérdida de datos local aceptable).

---

## Checklist rápido antes de producción

- [ ] Backup SQLite verificado (tamaño > 0, abrir con DB browser opcional).
- [ ] `migrate deploy` OK contra Postgres de staging.
- [ ] `migrate:data:sqlite-to-pg` OK contra staging vacío.
- [ ] `migrate:verify-counts` sin diferencias.
- [ ] Pruebas manuales críticas.
- [ ] `DATABASE_URL` de Supabase en secretos del host (Railway/Render).
- [ ] Release: solo `prisma migrate deploy`, **nunca** `db push` en prod.

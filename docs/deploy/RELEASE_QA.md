# Control de calidad previo a nube (Supabase / Vercel / Railway)

Este paquete evita diagnóstico manual repetido: build con env mínimo, SQL de integridad y E2E con Playwright.

## 1. Auditoría de entorno

### Web (`apps/web`)

- En **`NODE_ENV=production`** (p. ej. `next build`), el script `prebuild` ejecuta `verify-release-env.mjs`.
- Exige **`NEXT_PUBLIC_API_BASE_URL`** (preferido) o **`NEXT_PUBLIC_API_URL`**: URL absoluta del API (ej. `https://api.ejemplo.com/api`).
- Omitir en build desktop u offline: `BUILD_DESKTOP=1` o `SKIP_RELEASE_ENV_CHECK=1`.

### API (`apps/api`)

- `npm run verify:release-env` con **`RELEASE_VERIFY_STRICT=1`** o en **CI** (`CI=true`):
  - `DATABASE_URL` debe ser `postgresql://` o `postgres://`.
  - `JWT_SECRET` ≥ 32 caracteres y no placeholder.
  - `WEB_ORIGIN` o `CORS_ORIGIN` definido (origen del front; puede ser lista CSV).
  - Si `STORAGE_DRIVER=supabase`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.

En GitHub Actions el job de CI ejecuta la verificación de API antes del build.

### Migración `uploads/` → Supabase (antes de `STORAGE_DRIVER=supabase` en un entorno con datos)

Desde `apps/api`, con el bucket creado y variables Supabase en el entorno:

```bash
DRY_RUN=1 npm run migrate:uploads-to-supabase
npm run migrate:uploads-to-supabase
```

El script lee archivos bajo `LOCAL_UPLOADS_DIR` (default `uploads/`) y los sube con la misma clave lógica que en la base (`MessageAttachment`, logo `CompanyProfile`, `ImplantationDesign.screenshotUrl`).

## 2. Auditoría SQL (integridad)

Desde `apps/api` con Postgres migrado:

```bash
npm run integrity:db
```

- Sale con código **1** si alguna consulta LEFT JOIN encuentra filas huérfanas.
- Informe: `apps/api/test-results/integrity-report.json`.

## 3. E2E (Playwright)

Requisitos: API y web en marcha; base de datos con usuario ADMIN_DEV (p. ej. `npx ts-node prisma/recover-login.ts` en `apps/api`).

```bash
cd apps/web
cp .env.e2e.example .env.e2e.local
# Ajustar E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD si aplica
npx playwright install chromium
npm run test:e2e
```

Qué hace el spec `e2e/release-qa.spec.ts`:

- Login vía `auth.setup.ts` (storage state) con `E2E_ADMIN_*`.
- Recorre todas las rutas del menú (`lib/suite-nav-registry.ts`) más conversaciones, usuarios y una ruta de administración técnica.
- Detecta HTTP 404 / heurística de página no encontrada, errores de consola (filtrando ruido conocido), peticiones fallidas y respuestas **5xx** hacia el origen del API.
- Capturas: `test-results/screenshots/*.png`.
- Informe: `test-results/release-qa-report.json` (y adjunto en el reporte HTML de Playwright).

## 4. Reporte final (checklist manual corto)

| Área | Fuente |
|------|--------|
| Módulos OK / rutas rotas / placeholders / consola / 5xx API | `test-results/release-qa-report.json` |
| Relaciones rotas en DB | `test-results/integrity-report.json` |
| Bloqueantes de env antes de cloud | fallo de `next build` (web) o `verify:release-env` (API) |

Si algo falla, corregir datos o rutas antes de desplegar; no sustituye revisión funcional profunda, pero bloquea regresiones obvias de release.

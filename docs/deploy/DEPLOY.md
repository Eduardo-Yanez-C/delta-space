# DELTA SPACE — Despliegue en nube y flujo dev → prod

Este documento resume el estado del monorepo, los cambios orientados a producción (Vercel + Railway/Render + Supabase) y cómo seguir desarrollando en local sin romper producción.

---

## 1. Diagnóstico de preparación para producción

### Listo hoy

| Área | Estado |
|------|--------|
| Monorepo `apps/web` + `apps/api` | OK |
| Next.js build (`npm run build` en web) | OK |
| Nest build **sin** `db push` en script `build` (`prisma generate` + `tsc`) | OK (ajuste reciente) |
| `GET /api/health` con comprobación de base de datos | OK |
| CORS configurable por env (`WEB_ORIGIN` + `CORS_ORIGIN` + loopback en dev) | OK |
| `JWT_SECRET` obligatorio si `NODE_ENV=production` | OK |
| `PORT` desde env | OK (default 4000) |
| Frontend: base API por `NEXT_PUBLIC_API_BASE_URL` o `NEXT_PUBLIC_API_URL` | OK |
| `postinstall` en API → `prisma generate` (Railway/Nixpacks) | OK |
| Scripts `prisma:deploy`, `prisma:validate`, `start:prod` | OK |
| Módulo `ObjectStorageService` (local + Supabase Storage) | Base lista; ver §6 |
| CI GitHub (build API + web) | `.github/workflows/ci.yml` |
| `.env.example` en `apps/api` y `apps/web` | OK |

### Brechas importantes (antes del “go-live” real)

1. **Prisma API = PostgreSQL** (`apps/api/prisma/schema.prisma`); **portable = SQLite** (`prisma/desktop/`).  
   Flujo de datos desde SQLite antiguo: **`docs/deploy/MIGRACION_SQLITE_POSTGRES.md`**. En CI se ejecuta `migrate deploy` contra Postgres de prueba.

2. **Archivos en disco**  
   Hoy logos, adjuntos de chat, capturas, etc. escriben en `uploads/` vía servicios existentes. Existe **`ObjectStorageService`** (`STORAGE_DRIVER=supabase`) para nuevas integraciones; **falta cablear** cada módulo que hoy usa `fs.writeFile` directo (ver `docs/deploy/STORAGE-ROADMAP.md` si existe, o buscar `uploads` en `apps/api/src`).

3. **Socket / conversaciones**  
   `NEXT_PUBLIC_CONVERSATIONS_SOCKET_ORIGIN` debe apuntar al mismo host que el API en producción (wss/https según proveedor).

4. **Desktop portable**  
   Usa `prisma/desktop/` (SQLite) en el embed; el build de API para el `.exe` no debe depender de Postgres. Ver `docs/DESKTOP_BACKEND_EMBEDDED.md` y `apps/api/prisma/README.md`.

---

## 2. Separación de entornos

| Concern | Local (Cursor) | Producción |
|---------|------------------|------------|
| Variables | `apps/api/.env`, `apps/web/.env.local` | Secrets en Railway/Render + Vercel env |
| API URL en front | `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api` | URL pública del API + `/api` |
| CORS | Loopback siempre permitido en dev | `WEB_ORIGIN` = URL(s) de Vercel |
| Base de datos | Postgres local (Docker) o Supabase dev; ver `apps/api/docker-compose.postgres.yml` | Postgres Supabase |
| Build API | `npm run build` (CI); `build:local` / `start:dev` = `migrate deploy` + generate + tsc | `npm run build` + `prisma migrate deploy` en release |
| Archivos | `STORAGE_DRIVER=local` | `STORAGE_DRIVER=supabase` + bucket |

**Regla de oro:** nunca commitear `.env` con secretos. Producción solo por panel del proveedor.

---

## 3. Backend (Railway / Render)

- **Root del servicio:** `apps/api`
- **Install:** `npm install` (desde raíz del repo con workspaces) **o** `npm ci` en CI.
- **Build:** `npm run build` (genera cliente Prisma + compila TS).
- **Start:** `npm run start:prod` (equivale a `node dist/main.js`). Definir `NODE_ENV=production`.
- **Migraciones:** `npm run prisma:deploy --workspace=api` (usa `DATABASE_DIRECT_URL` para conectar a Postgres **directo**). Si `DATABASE_URL` es el **Session pooler** de Supabase, sin `DATABASE_DIRECT_URL` el deploy falla con *max clients reached*; copie la URI **Direct** (host `db.*.supabase.co`, puerto 5432) desde Supabase → Database → Connection string. El historial Postgres vive en `apps/api/prisma/migrations/`; el SQLite del portable en `apps/api/prisma/desktop/migrations/`.

### Variables mínimas (producción)

- `DATABASE_URL`
- `DATABASE_DIRECT_URL` (Postgres **directo** para migraciones; con Supabase pooler en `DATABASE_URL` es obligatoria; en local puede igualar `DATABASE_URL`)
- `JWT_SECRET`
- `NODE_ENV=production`
- `PORT` (opcional; muchos hosts lo inyectan)
- `WEB_ORIGIN` (URL del front en Vercel, coma para varias)
- `STORAGE_DRIVER=supabase` + `SUPABASE_*` cuando se active storage en nube

---

## 4. Frontend (Vercel)

- **Root directory del proyecto en Vercel:** `apps/web`
- **Build command:** `npm run build` (por defecto del workspace)
- **Install:** desde raíz del monorepo suele ser `cd ../.. && npm ci` si Vercel solo clona el subcarpeta — en monorepos lo habitual es conectar el **repo completo** y fijar **Root Directory = `apps/web`**, con **Install Command** `cd $VERCEL_ROOT_DIR/../.. && npm ci` o usar Turborepo; la opción más simple es documentar **“Install en raíz + build solo web”**:  
  `npm ci` en raíz, **Build** `npm run build --workspace=web` (ajustar en UI de Vercel).

Variable crítica:

- `NEXT_PUBLIC_API_BASE_URL=https://tu-api.up.railway.app/api` (ejemplo)

---

## 5. Prisma + Supabase PostgreSQL

**Situación actual:** el API usa **`provider = "postgresql"`** en `apps/api/prisma/schema.prisma` y migraciones en `apps/api/prisma/migrations/`. El portable sigue en **`prisma/desktop/`** (SQLite).

1. Crear proyecto Supabase (o Postgres local con `apps/api/docker-compose.postgres.yml`).
2. `DATABASE_URL` apuntando a esa base; `npx prisma migrate deploy` desde `apps/api`.
3. Copia de datos desde un `.sqlite` antiguo: scripts y checklist en **`docs/deploy/MIGRACION_SQLITE_POSTGRES.md`**.

**Producción:** no usar `db push`; usar solo `migrate deploy` en el paso de release.

---

## 6. Supabase Storage

- Servicio: `ObjectStorageService` (`apps/api/src/infra/object-storage/object-storage.service.ts`).
- Env: `STORAGE_DRIVER=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`.
- Buckets públicos vs firmados: configurar políticas en Supabase; `getPublicUrl` solo aplica si el bucket es público.

**Pendiente:** sustituir escrituras directas en `company-profile`, `conversations`, `implantation-design`, etc., por llamadas a `ObjectStorageService.putObject` (y lecturas acordes).

---

## 7. Variables de entorno (resumen)

Ver archivos:

- `apps/api/.env.example`
- `apps/web/.env.example`

---

## 8. Scripts finales

### API (`apps/api/package.json`)

| Script | Uso |
|--------|-----|
| `npm run build` | Producción/CI: `prisma generate` + `tsc` (**sin** `db push`) |
| `npm run build:local` | Local: `migrate deploy` + `generate` + `tsc` (requiere Postgres en `DATABASE_URL`) |
| `npm run start:prod` | `node dist/main.js` |
| `npm run start:dev` | `migrate deploy` + build + run (Postgres en `DATABASE_URL`) |
| `npm run prisma:deploy` | `prisma migrate deploy` |
| `npm run prisma:generate` | Cliente Prisma |
| `npm run prisma:validate` | Validar schema |
| `postinstall` | `prisma generate` |

### Web (`apps/web/package.json`)

| Script | Uso |
|--------|-----|
| `npm run build` | Build Next (Vercel) |
| `npm run dev` | Desarrollo |

### Raíz

| Script | Uso |
|--------|-----|
| `npm run ci:build` | `prisma:generate` + build api + build web |
| `npm run build:desktop` | Empaqueta API embed con `prisma/desktop` (SQLite); ver script en `apps/desktop` |

---

## 9. Validación local sugerida

```powershell
cd apps/api
npm install
npm run prisma:generate
npm run prisma:validate
npm run build
# Con Postgres local o remoto en DATABASE_URL:
npm run build:local
npm run start:prod
```

Otro terminal:

```powershell
cd apps/web
npm install
npm run build
```

Health:

```http
GET http://localhost:4000/api/health
```

---

## 10. Flujo dev → prod (Cursor + GitHub)

1. Trabajar en rama feature desde `main`/`develop`.
2. Probar local: `npm run dev` en raíz o workspaces por separado.
3. `npm run ci:build` antes de push (opcional pero recomendado).
4. Commit + push a GitHub.
5. **Vercel** despliega `apps/web` (rama conectada).
6. **Railway/Render** despliega `apps/api` en push a la misma rama.
7. **Migraciones:** en el job de release o paso manual controlado, `prisma migrate deploy` contra la DB de producción.
8. **Variables nuevas:** añadir en Vercel + host API + documentar en `.env.example`.
9. **Rollback básico:** redeploy del commit anterior en Vercel/Railway; DB solo rollback con migraciones down o restore de backup (planificar backups en Supabase).

---

## 11. Pasos exactos de deploy (checklist)

### GitHub

1. Crear repositorio (privado recomendado).
2. `git remote add origin …` / push inicial.
3. **No subir:** `.env`, `.env.local`, `*.sqlite`, `node_modules`, `uploads/` con datos sensibles, `apps/desktop/dist/`.
4. Confirmar `.gitignore` cubre lo anterior.

### Supabase

1. Nuevo proyecto → **Database** → copiar `DATABASE_URL` (modo pooler o directo según doc Supabase + Prisma).
2. **Storage** → crear bucket (ej. `delta-space-files`) → políticas lectura/escritura según necesidad.
3. Copiar **Project URL** y **service role** (solo backend).

### Railway o Render (API)

1. New service → Deploy from GitHub → repo `delta-space`.
2. **Root / Root Directory:** `apps/api` (o monorepo con comando custom).
3. **Build:** `npm ci` desde **raíz** si workspaces lo requieren, luego `npm run build --workspace=api`; Nixpacks a veces detecta solo subcarpeta — ajustar según documentación del proveedor para **npm workspaces**.
4. **Start:** `npm run start:prod --workspace=api` o `cd apps/api && npm run start:prod`.
5. Variables de entorno (§7).
6. Tras primer deploy con Postgres listo: ejecutar **`prisma migrate deploy`** (one-off command o release phase).

### Vercel (Web)

1. Import Git → mismo repo.
2. **Root Directory:** `apps/web`.
3. **Install:** si hace falta, desde raíz: `cd ../.. && npm ci`.
4. **Build:** `cd ../.. && npm run build --workspace=web` o equivalente.
5. `NEXT_PUBLIC_API_BASE_URL` = URL pública del API terminada en `/api`.

---

## 12. Qué queda pendiente antes del deploy final

- [ ] **Datos:** si venís de SQLite antiguo, seguir **`docs/deploy/MIGRACION_SQLITE_POSTGRES.md`** (backup + `migrate deploy` + script de copia + verificación de conteos).
- [ ] **Ejecutar `prisma migrate deploy`** contra Postgres de producción con el historial del repo.
- [ ] **Cablear uploads** a `ObjectStorageService` + `STORAGE_DRIVER=supabase` en producción.
- [ ] **Probar CORS** con URL real de Vercel (incl. previews si se usan).
- [ ] **WebSockets** detrás de HTTPS y mismo dominio o CORS/socket origin explícitos.
- [ ] **Backups** automáticos Supabase + plan de restore.
- [ ] **Dominio custom** y TLS en Vercel + API.

---

## Referencias internas

- `apps/api/prisma/README.md` — layouts SQLite desktop vs servidor.
- `docs/deploy/MIGRACION_SQLITE_POSTGRES.md` — backup, datos, validación y reversión.
- `.cursor/rules/delta-space-sam.mdc` — marca y asistente SAM.

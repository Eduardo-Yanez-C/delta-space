# Instalación y desarrollo — Nivel desarrollador

Este documento define la estructura del proyecto, los puntos de arranque de cada app, los comandos de desarrollo y build, y referencias útiles para troubleshooting.

---

## 1. Estructura del proyecto

El proyecto es un **monorepo** (npm workspaces). La **raíz** es la carpeta que contiene el `package.json` con `"name": "pv-quoting-platform"`.

```
<raíz del proyecto>/
├── package.json              # Scripts de monorepo (dev, build, start:local, etc.)
├── scripts/
│   └── start-local.bat       # Arranque API + web en modo producción local (Windows)
├── docs/
│   ├── INSTALACION_USUARIO.md
│   └── INSTALACION_DESARROLLADOR.md
└── apps/
    ├── api/                  # Backend NestJS (API REST)
    │   ├── src/
    │   ├── prisma/
    │   └── package.json
    ├── web/                  # Frontend Next.js (interfaz web)
    │   ├── app/
    │   ├── lib/
    │   └── package.json
    └── desktop/              # App de escritorio (Electron + web empaquetada)
        ├── main.js            # Punto de entrada de Electron
        ├── package.json
        └── dist/              # Salida del build (win-unpacked, etc.)
```

- **Ruta exacta de inicio recomendada para todo el stack (web + API):** la **raíz del proyecto** (donde está el `package.json` raíz).
- **Ruta exacta de la app de escritorio (código):** `apps/desktop/`. El punto de entrada es `apps/desktop/main.js` (Electron). En desarrollo se ejecuta desde la raíz con `npm run dev:desktop` o desde `apps/desktop` con `npm run dev` (requiere API y web ya corriendo).
- **Ruta del script de arranque local (Windows):** `scripts/start-local.bat`. Al ejecutarlo, hace `cd` a la raíz del proyecto y ejecuta `npm run start:local`.

---

## 2. Comandos desde la raíz del proyecto

Todos los comandos siguientes se ejecutan desde la **raíz** (donde está el `package.json` principal), salvo que se indique otra cosa.

| Comando | Descripción |
|--------|-------------|
| `npm run dev` | Inicia **API** (puerto 4000) y **web** (puerto 3000) en modo desarrollo. |
| `npm run dev:web` | Solo frontend web (Next.js) en modo dev. |
| `npm run dev:api` | Solo backend API (NestJS) en modo watch. |
| `npm run dev:desktop` | Inicia API + web y, cuando la web está lista, abre la app de escritorio (Electron). |
| `npm run start:local` | Inicia API y web en modo **producción** (requiere `npm run build` previo). |
| `npm run start:api` | Solo API en modo producción. |
| `npm run start:web` | Solo web en modo producción. |
| `npm run build` | Compila API y luego web. |
| `npm run build:desktop` | Build completo para escritorio (web standalone + Electron). |
| `npm run lint` | Lint en API y web. |
| `npm run prisma:migrate` | Ejecuta migraciones Prisma (desde el workspace api). |
| `npm run prisma:generate` | Regenera el cliente Prisma. |

---

## 3. Comandos para API (`apps/api`)

Desde la raíz puede usar el workspace o entrar a `apps/api` y ejecutar allí:

| Comando | Descripción |
|--------|-------------|
| `npm run start:dev --workspace=api` | API en modo desarrollo con recarga. |
| `npm run start --workspace=api` | API compilada (producción). |
| `npm run build --workspace=api` | Compila el backend NestJS. |
| `npm run prisma:migrate --workspace=api` | Migraciones Prisma (`migrate dev`; la API usa **PostgreSQL** en `DATABASE_URL`). |
| `npm run prisma:generate --workspace=api` | Genera el cliente Prisma. |
| `npm run prisma:seed --workspace=api` | Ejecuta el seed (roles, admin, código de activación demo, etc.). |

Variables de entorno relevantes (en `apps/api/.env`): `DATABASE_URL`, `PORT` (por defecto 4000), `CORS_ORIGIN`, `JWT_SECRET`, etc.

---

## 4. Comandos para Web (`apps/web`)

| Comando | Descripción |
|--------|-------------|
| `npm run dev --workspace=web` | Next.js en modo desarrollo (puerto 3000). |
| `npm run build --workspace=web` | Build de producción de Next.js. |
| `npm run start --workspace=web` | Sirve el build de Next.js (producción). |
| `npm run lint --workspace=web` | Lint del frontend. |

Variable de entorno (opcional): `NEXT_PUBLIC_API_URL` para la URL del API en build. En runtime la URL se puede configurar desde la pantalla `/setup` (configuración local en el navegador).

---

## 5. Arranque local unificado (API + Web)

- **Desarrollo:**  
  Desde la raíz: `npm run dev` (levanta API y web a la vez).

- **Producción local:**  
  1. Una vez: `npm run build`  
  2. Luego: `npm run start:local`  
  O en Windows: ejecutar **`scripts/start-local.bat`** (el script hace `cd` a la raíz y llama a `npm run start:local`).  
  El script es funcional siempre que Node/npm estén en el PATH y se ejecute desde la carpeta del proyecto (o se invoque con la ruta correcta a `scripts/start-local.bat`).

---

## 6. Build de la app de escritorio

Desde la raíz:

```bash
npm run build:desktop
```

Esto:

1. Compila la web con `output: "standalone"` (Next.js).
2. Prepara la carpeta standalone y Node portable en `apps/desktop`.
3. Ejecuta `electron-builder` para generar la aplicación.

Salida típica en Windows: `apps/desktop/dist/win-unpacked/` (carpeta con el ejecutable). El ejecutable tiene el nombre del producto configurado en `apps/desktop/package.json` (ej. “Cotizaciones PFV Avanzada”).

---

## 7. Prisma y base de datos (API)

- **Schema (API / nube):** `apps/api/prisma/schema.prisma` — **PostgreSQL** (`DATABASE_URL` tipo `postgresql://…`).
- **Migraciones Postgres:** `apps/api/prisma/migrations/`
- **Escritorio portable (SQLite):** `apps/api/prisma/desktop/` (solo empaquetado; ver `apps/api/prisma/README.md`).
- **Seed:** `apps/api/prisma/seed.ts` (roles, usuario admin, código de activación demo, etc.)

Postgres local rápido: `apps/api/docker-compose.postgres.yml` y ejemplo de URL en `apps/api/.env.example`.

Comandos útiles (desde raíz con workspace o desde `apps/api`):

```bash
# Aplicar migraciones publicadas (staging/prod/CI)
npm run prisma:deploy --workspace=api

# Crear migración nueva en desarrollo
npm run prisma:migrate --workspace=api

# Regenerar cliente Prisma
npm run prisma:generate --workspace=api

# Ejecutar seed
npm run prisma:seed --workspace=api
```

Migración desde datos antiguos en SQLite: **`docs/deploy/MIGRACION_SQLITE_POSTGRES.md`**.

---

## 8. Rutas importantes (referencia)

| Ruta / recurso | Descripción |
|----------------|-------------|
| **Raíz del proyecto** | Carpeta con `package.json` (name: `pv-quoting-platform`). Punto de arranque recomendado para web y scripts. |
| **apps/desktop** | Código de la app de escritorio; entrada Electron: `main.js`. |
| **apps/desktop/dist/win-unpacked/** | Ejecutable y recursos tras `npm run build:desktop` (Windows). |
| **apps/web** | Frontend Next.js; rutas en `app/`. |
| **apps/api** | Backend NestJS; controladores bajo `src/modules/`. |
| **scripts/start-local.bat** | Script Windows para arrancar API + web en modo producción local. |
| **/setup** | Pantalla de configuración inicial (URL API, código de activación). |
| **/login** | Inicio de sesión. |
| **API base** | Por defecto `http://localhost:4000/api` (health: `GET /api/health`). |

---

## 9. Troubleshooting

- **“Failed to fetch” o la web no conecta al API**  
  - Comprobar que la API esté en marcha (`npm run dev` o `npm run start:api`).  
  - Si se usa configuración guardada en `/setup`, verificar que la URL del API sea correcta (p. ej. `http://localhost:4000/api`).

- **La web arranca pero el API no**  
  - Revisar que en `apps/api` exista `.env` con `DATABASE_URL` (PostgreSQL) y que las migraciones estén aplicadas (`npm run prisma:deploy --workspace=api` o `prisma:migrate` en dev).  
  - Revisar consola/terminal del API por errores de compilación o de Prisma.

- **Escritorio no abre o no carga**  
  - En desarrollo: asegurarse de que API y web estén corriendo (o usar `npm run dev:desktop` desde la raíz).  
  - Empaquetado: verificar que exista `apps/desktop/dist/win-unpacked` y que el build de escritorio se haya completado sin errores.

- **Prisma: “schema not in sync” o errores de migración**  
  - Desde raíz: `npm run prisma:generate --workspace=api` y `npm run prisma:migrate --workspace=api`.  
  - Si se cambió el schema, crear una nueva migración con `npx prisma migrate dev --name <nombre>` dentro de `apps/api`.

- **start-local.bat no hace nada o falla**  
  - Ejecutarlo desde la carpeta del proyecto (o con la ruta completa al `.bat`).  
  - Comprobar que Node.js y npm estén en el PATH.  
  - Asegurarse de haber ejecutado antes `npm run build` para que `start:local` pueda levantar API y web en modo producción.

---

## 10. Resumen de rutas exactas

| Concepto | Ruta exacta |
|----------|-------------|
| **Raíz del proyecto (inicio web + API)** | Carpeta que contiene el `package.json` con `"name": "pv-quoting-platform"` (en un clon típico: la carpeta del repositorio, p. ej. `Sofware de cotrizaciones`). |
| **App de escritorio (código y entrada)** | `apps/desktop/` — entrada: `main.js`. |
| **App de escritorio (ejecutable generado)** | `apps/desktop/dist/win-unpacked/` (y el `.exe` dentro). |
| **Script de arranque local (Windows)** | `scripts/start-local.bat` (relativo a la raíz del proyecto). |

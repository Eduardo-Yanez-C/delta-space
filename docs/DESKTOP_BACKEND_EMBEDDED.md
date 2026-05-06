# Backend embebido en app de escritorio

## Objetivo

La app de escritorio empaquetada puede funcionar **sin depender de Cursor ni de levantar manualmente el backend**. En producción/packaged, Electron arranca un backend NestJS local embebido, aplica migraciones, ejecuta el seed (usuario admin) y espera el health check antes de abrir la ventana.

## Estructura de salida (packaged)

```
dist/win-unpacked/
  Cotizaciones PFV Avanzada.exe
  resources/
    backend/          ← Backend Nest compilado + Prisma + node_modules
      dist/           (main.js y resto de la API)
      prisma/         (schema.prisma + migrations)
      node_modules/   (deps producción + ts-node para seed)
    node/             ← Node portable (ya existía)
    standalone/       ← Next.js standalone (ya existía)
    version.txt
```

## Base de datos

- **Ubicación:** `%APPDATA%\Cotizaciones PFV Avanzada\database.sqlite` (Windows) o equivalente en macOS/Linux (`app.getPath('userData')`).
- **Migraciones:** Se ejecutan al arrancar con `prisma migrate deploy`.
- **Seed:** Se ejecuta al arrancar (`prisma db seed`) para crear roles y usuario admin (email y contraseña por defecto del seed).

## Flujo de arranque (packaged)

1. Electron arranca y comprueba si existe `resources/backend/dist/main.js`.
2. Si existe: crea/usa `userData`, ejecuta migraciones, ejecuta seed, inicia el proceso del backend en el puerto 4000, espera `GET /api/health` OK.
3. Inicia el servidor Next (standalone) en el puerto 31337.
4. Abre la ventana con `http://127.0.0.1:31337?embedded=1`.
5. El frontend detecta `?embedded=1`, persiste `apiBaseUrl: http://127.0.0.1:4000/api` en localStorage y no redirige a /setup.
6. Al cerrar la app, se matan los procesos del backend y de Next.

## Desarrollo

- **Sin cambios:** Sigue siendo necesario levantar API y Web a mano (o `npm run dev` / `npm run dev:desktop`). La app Electron en dev solo carga `http://localhost:3000` y no arranca backend embebido.

## Build

Desde la **raíz del monorepo**:

```bash
npm run build:desktop
```

Orden ejecutado:

1. `npm run build --workspace=api` → genera `apps/api/dist/`
2. Build web con `NEXT_PUBLIC_API_URL=http://127.0.0.1:4000/api` y `BUILD_DESKTOP=1`
3. prepare-standalone, download-node
4. **prepare-embedded-backend** → crea `apps/desktop/embed-api/` (copia dist, prisma, package.json; `npm install`; `prisma generate`)
5. write-version, electron-builder (incluye `embed-api` como `resources/backend`)
6. prepare-transfer-folder → carpeta "Aplicacion de traslado"

## Supuestos y qué validar

- **Supuestos:** API usa SQLite, puerto 4000 libre en el equipo del usuario, Node portable compatible con el backend (misma versión que la usada en desarrollo).
- **Validar:** En un PC sin Node/Cursor, copiar `dist/win-unpacked` o "Aplicacion de traslado", ejecutar el .exe y comprobar login con el usuario del seed.

## Archivos tocados

- `apps/desktop/main.js` — startEmbeddedBackend, runEmbeddedMigrations, runEmbeddedSeed, waitForHealth, killBackend, flujo con `?embedded=1`.
- `apps/desktop/scripts/prepare-embedded-backend.js` — nuevo; prepara `embed-api/`.
- `apps/desktop/package.json` — script `prepare-embedded-backend`, extraResources `embed-api` → `backend`.
- `package.json` (raíz) — `build:desktop` incluye build API, `NEXT_PUBLIC_API_URL`, y `prepare-embedded-backend`.
- `apps/web/components/layout/AuthGuard.tsx` — detección `embedded=1`, persistencia de apiBaseUrl y effectiveConfigured.
- `apps/desktop/.gitignore` — `embed-api/`, `version.txt`.

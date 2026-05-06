# Portable / escritorio — QA funcional y orden de build

## Cómo no depender de `dist` viejo o desalineado

1. **Pipeline oficial (raíz del monorepo):**  
   `npm run build:desktop`  
   Orden: compila API → Web con `BUILD_DESKTOP=1` y API URL fija → `prepare-standalone` → `prepare-embedded-backend` (regenera `apps/desktop/embed-api` desde `apps/api/dist`) → `electron-builder` → **`prepare-transfer-folder`** vuelve a copiar `embed-api` sobre `resources/backend` de la carpeta portable **oficial**.

2. **Carpeta a probar en campo:**  
   `apps/desktop/dist/Cotizaciones-PFV-Portable/` (o la ruta que imprima `prepare-transfer-folder`).  
   No use como referencia una carpeta `electron-out-*` intermedia salvo que sepa que incluye el mismo backend que `embed-api` actual.

3. **Verificación sin abrir el .exe:**  
   Desde la raíz del monorepo:  
   `npm run validate:desktop-portable`  
   Comprueba `exe`, Next `server.js`, Node portable, `backend/dist/main.js`, `env.embedded`, coherencia HMAC `.env` vs `env.embedded`, y reglas de licencia en el código fuente.

4. **Logs:**  
   `%APPDATA%\<app>\logs\backend.log` (o la ruta `userData` que use Electron) — migraciones, seed, salida Nest `[api]`, Next `[next]`.

---

## Checklist manual (después de instalar/copiar la carpeta portable)

| # | Qué validar | Criterio de éxito |
|---|-------------|-------------------|
| 1 | Arranque backend embebido | Primera ejecución: sin error “backend embebido no encontrado”; en `backend.log` aparece arranque Nest y `GET /api/health` responde `ok` (Electron espera health antes de seguir). |
| 2 | `env.embedded` / `.env` | Existe `resources/backend/env.embedded` (obligatorio para Electron; el builder a veces omite `.env`). Nest usa `cwd = resources/backend` y `ConfigModule` con `env.embedded` + `.env`. |
| 3 | Licencia | Sin licencia: pantalla de bloqueo; con archivo válido o “Acceso desarrollador”: entra a la app; HMAC coincide entre Electron (lectura disco) y Nest (`delete LICENSE_HMAC_SECRET` del padre evita pisar el del hijo). |
| 4 | Navegación / login | Login contra `http://127.0.0.1:4000/api`; sesión estable. |
| 5 | Inicio / dashboard | Carga KPIs e indicadores (errores de red solo si servicios externos fallan). |
| 6 | Estudios FV | Listado, detalle, formulario (según permisos). |
| 7 | Diseño de implantación | Abre mapa/diseño si el estudio lo permite (mismas llamadas API). |
| 8 | Cotizaciones | Listado, detalle, edición acotada al rol. |
| 9 | Electron ↔ Nest | URL forzada en shell `?embedded=1` y puerto `31337`: `AuthGuard` fija `apiBaseUrl` a `http://127.0.0.1:4000/api` para no usar localStorage de desarrollo apuntando a Next. |
| 10 | Consistencia de artefactos | Tras cambios en API, siempre `build:desktop` completo; no reutilizar solo `embed-api` de hace días sin `prepare-embedded-backend`. |

---

## Problemas frecuentes (causa → qué hacer)

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| “Internal server error” en módulos | `localStorage` apuntaba a `:31337/api` en lugar del Nest `:4000` | Ya mitigado en `AuthGuard` con `embedded=1` / puerto 31337; borrar site data o reabrir desde acceso directo oficial. |
| Firma de licencia inválida | `LICENSE_HMAC_SECRET` distinto entre Electron y Nest, o variable heredada en Windows pisaba la del hijo | `main.js` elimina `LICENSE_HMAC_SECRET` del env del proceso hijo; unificar `env.embedded` y reempaquetar. |
| Prisma migrate/seed falla | Ruta SQLite con espacios / permisos | Ver `backend.log` (contexto `DATABASE_URL` y ruta absoluta). |
| Diagnóstico HMAC 404 en portable | Normal si no hay `EMBEDDED_PACKAGED_DESKTOP` en el hijo | En empaquetado, Electron define `EMBEDDED_PACKAGED_DESKTOP=1` al spawnear Nest → diag habilitado sin `.env` extra. |

---

## Estado

El flujo en código está **cerrado** para portable siempre que se use **`npm run build:desktop`** y la carpeta **oficial** de traslado. Cualquier fallo en un PC concreto suele ser entorno (permisos, antivirus, datos viejos en `userData`) o build parcial; este documento + `validate:desktop-portable` reducen el riesgo de `dist` desalineado.

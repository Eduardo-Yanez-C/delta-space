# MVP 1 — Desktop instalable serio (alcance cerrado)

**Línea oficial de producto:** instalación por vendedor, **sin Hub/sync** en esta fase, **sin** servidor web LAN como camino principal.

| Incluye | Excluye (explícito) |
|---------|---------------------|
| Electron + Next standalone + **Nest embebido** | Hub de sincronización, multi-dispositivo |
| **SQLite** en perfil de usuario (`userData`) | PostgreSQL en escritorio |
| Licenciamiento fuerte (roadmap por fases; Fase 1 iniciada abajo) | Revocación online completa (Fase posterior) |
| APIs externas solo vía **Nest local** (`127.0.0.1:4000`) | Llamadas a APIs de negocio desde renderer |

**Documentos relacionados:** visión amplia en [arquitectura-escritorio-licenciamiento-central.md](./arquitectura-escritorio-licenciamiento-central.md).

---

## 1. Arquitectura técnica: Nest dentro de Electron

### 1.1 Procesos

| Proceso | Binario | CWD | Puerto |
|---------|---------|-----|--------|
| **Electron (main)** | `Cotizaciones PFV Avanzada.exe` | — | — |
| **Next standalone** | `resources/node/node.exe` + `resources/standalone/apps/web/server.js` | `resources/standalone` | **31337** (`127.0.0.1`) |
| **Nest API** | mismo `node.exe` + `resources/backend/dist/main.js` | `resources/backend` | **4000** (`127.0.0.1` implícito) |

### 1.2 Secuencia de arranque (empaquetado)

1. `app.whenReady` → generar/leer **`installationId`** en `userData/installation/installation.json`.
2. Validar licencia (hoy: HMAC archivo local; objetivo: JWT + servidor — ver fases).
3. `prisma migrate deploy` + `db seed` contra **`userData/database.sqlite`** (spawn sync, env `DATABASE_URL=file:...`).
4. `spawn` Nest con `DATABASE_URL`, `PORT=4000`, `NODE_ENV=production`, `.env` embebido desde `prepare-embedded-backend` (claves integración solo aquí).
5. Esperar `GET http://127.0.0.1:4000/api/health`.
6. Arrancar Next; cargar `http://127.0.0.1:31337?embedded=1`.

### 1.3 Renderer → API

- Con `?embedded=1`, el front usa **`http://127.0.0.1:4000/api`** (ver `AuthGuard.tsx`).
- **CORS:** `main.ts` ya permite orígenes `localhost/127.0.0.1:31337`.

### 1.4 Empaquetado

- `npm run build:desktop` → `prepare-embedded-backend` genera `desktop/embed-api` (dist Nest + `prisma/desktop` + `npm install` + `prisma generate` **SQLite**).
- **electron-builder** incluye `embed-api` en **`extraResources/backend`** (además de standalone + node portable).
- Carpeta **Aplicacion de traslado** sigue validando presencia de `resources/backend/dist/main.js` si existe `embed-api` en build.

---

## 2. Almacenamiento local SQLite (por instalación / usuario)

| Artefacto | Ubicación |
|-----------|-----------|
| Base **SQLite** | `%APPDATA%/<app>/database.sqlite` (vía `app.getPath("userData")`) |
| Migraciones | Aplicadas en cada arranque con CLI Prisma embebida (`migrate deploy`) |
| **installationId** | `userData/installation/installation.json` |
| Estado licencia legacy | `userData/license/runtime-v1.json` |
| Logs | `userData/logs/backend.log` (Next + Nest) |

**Usuario Windows:** `userData` es por usuario de Windows → dos usuarios en el mismo PC = dos bases distintas (comportamiento deseado para MVP).

**Paridad de esquema:** `apps/api/prisma/desktop/schema.prisma` + `migrations/` — ver `apps/api/prisma/desktop/README.md`.

---

## 3. Licenciamiento fuerte (diseño objetivo vs estado)

| Requisito | Estado / notas |
|-----------|----------------|
| **installationId** | **Fase 1:** UUID persistente + IPC `desktop:getInstallationId` + pantalla licencia |
| **Activación** | Hoy: archivo JSON firmado HMAC; **objetivo:** canje con servidor emisor + JWT |
| **JWT firmado (RS256/ES256)** | **Fase 2+:** validar en main o delegar verificación mínima en Nest con clave pública embebida |
| **Binding instalación/equipo** | **Fase 2:** claim `installationId` en JWT debe coincidir con archivo local |
| **Gracia offline** | **Fase 3:** `lastOnlineOkAt` + ventana configurable si no hay red |
| **Revocación online** | **Fase 3:** heartbeat a endpoint emisor; denegación por `jti` / lista |

**Secretos:** clave **privada** de firma de licencias solo en infra del emisor; app solo **pública** para JWT.

---

## 4. APIs externas (Minenergía, NREL, …)

- Variables en **`apps/api/.env.desktop`** (copiadas a `embed-api/.env` en build; **no** incluir en renderer).
- Nest realiza HTTP saliente; el **renderer** no debe usar `fetch` a esos dominios para lógica de negocio (mapas/WhatsApp siguen siendo excepciones de UI ya documentadas).

**Recomendación:** no commitear API keys reales en `.env.desktop`; usar placeholders y secretos locales.

---

## 5. Roadmap de implementación (fases)

### Fase 1 — Base empaquetado + identidad instalación

- [x] Prisma **SQLite** dedicado (`prisma/desktop`) + migración baseline; `prepare-embedded-backend` copia `prisma/desktop` → `embed-api/prisma`.
- [x] **extraResources** `backend` desde `embed-api` en `electron-builder`.
- [x] **`installationId`** estable + log + IPC + UI en `license-blocked.html`.
- [x] **Seed embebido:** `prepare-embedded-backend` copia `prisma/seed.ts` + fuentes mínimas `margin-hierarchy.*` y genera `tsconfig.json` (CommonJS) para que `prisma db seed` funcione con Node moderno en el paquete.
- [ ] **Pendiente operativo:** checklist manual del `.exe` → **[CHECKLIST_ACEPTACION_DESKTOP_EXE_FASE1.md](./CHECKLIST_ACEPTACION_DESKTOP_EXE_FASE1.md)** (criterio de cierre incluido).

### Fase 2 — JWT RS256 + binding

- Emisor mínimo (o CLI interna) que genere JWT con `installationId`, `exp`, `jti`, `aud: desktop`.
- Main process o módulo Nest: verificar firma con `LICENSE_PUBLIC_KEY_PEM` embebida o en `userData` (solo lectura).
- Sustituir o convivir con flujo HMAC actual (migración documentada).

### Fase 3 — Online: gracia y revocación

- Heartbeat HTTPS opcional al arranque y cada N horas.
- Persistir `lastLicenseCheckOkAt`; política de gracia si red cae.
- Tabla/lista revocación en servidor o respuesta `{ revoked: true }`.

### Fase 4 — Endurecimiento producto

- Instalador NSIS/MSI, firma Authenticode, canal auto-update (electron-updater).
- Cifrado opcional de SQLite (SQLCipher) según requisito cliente.
- Auditoría de permisos `userData`.

---

## 6. Línea servidor LAN

El despliegue on-premise en `apps/deploy/servidor-local/` permanece como **opción secundaria** para clientes que lo pidan; **no** compite con el foco de MVP 1 en documentación de producto ni en prioridad de desarrollo.

---

*Última actualización: alineado a implementación de Fase 1 (Prisma desktop + installationId + empaquetado backend).*

# Spike técnico — Licencia on-premise v1 (**implementado**)

**Estado:** implementado en `apps/api` (módulo Nest `on-premise-license`).  
**RFC base (objetivo amplio):** [rfc-licencia-on-premise.md](./rfc-licencia-on-premise.md) — el spike V1 es un subconjunto; el RFC incluye una sección **«Spike V1 — implementación en código»** que resume el comportamiento real frente a la especificación larga.

---

## Política de bloqueo (v1)

- **Sin modo degradado:** si la licencia no está **OK**, la **operación normal del API** queda bloqueada (**403**).
- **Lista blanca explícita:** rutas que **no** exigen licencia OK (login, health, endpoints admin de licencia). El admin puede **recuperar** el sistema (ver `installationId`, subir `license.jwt`) aunque la licencia esté missing / inválida / expirada / mismatch.
- **Roles:** endpoints admin de licencia exigen JWT + **`ADMIN_DEV`** o **`ADMIN`** (`RolesGuard`). No hay permiso `manage:license` en BD en esta fase.
- **Mecanismo:** `OnPremiseLicenseGuard` registrado como **`APP_GUARD`** (no middleware Express genérico).

---

## Prefijo global `/api`

En `main.ts` el backend usa `app.setGlobalPrefix("api")`. Todas las rutas efectivas en este documento incluyen **`/api`** (salvo que un reverse proxy quite el prefijo en documentación externa).

---

## Lista blanca (allowlist) — implementación exacta

El guard normaliza el path: sin querystring; sin barra final (excepto `/`).

Se **omite** el chequeo de licencia (siempre `canActivate: true` respecto a licencia) si el path cumple **alguna** de:

| Condición |
|-----------|
| `path === "/api/health"` **o** `path.startsWith("/api/health/")` |
| `path === "/api/auth"` **o** `path.startsWith("/api/auth/")` |
| `path === "/api/admin/on-premise-license"` **o** `path.startsWith("/api/admin/on-premise-license/")` |

**Nota:** en rutas allowlisted **sin** JWT (p. ej. `POST /api/auth/login`, `GET /api/health`) no hay usuario. En `/api/admin/on-premise-license/*` el guard de licencia no bloquea, pero el controlador aplica **`JwtAuthGuard`** + **`RolesGuard`**: hace falta sesión admin.

**Orden de guards:** el `APP_GUARD` (licencia) corre **antes** que los guards del controlador. Para rutas de negocio: primero licencia, luego JWT/roles donde corresponda.

---

## Persistencia en disco

| Archivo | Contenido |
|---------|-----------|
| **`installation.json`** | `{ "installationId": "<uuid-v4>" }` |
| **`license.jwt`** | Texto UTF-8 del JWT completo (una sola línea o varias; se hace `trim()` al leer). |

**Directorio base:**

- Variable **`ON_PREMISE_DATA_DIR`**: si está definida y no vacía → `path.resolve(valor)` (absoluto recomendado).
- Si no → **`<cwd del proceso Node/Nest>/data/on-premise`**.

**Creación de `installationId`:** en la primera necesidad de leer estado (p. ej. `getStatus`), si no existe `installation.json` o no contiene un `installationId` string válido, se genera UUID v4 y se escribe el JSON (**escritura directa**, sin temp+rename; mejora futura posible).

**Inclusión en backups:** el directorio `ON_PREMISE_DATA_DIR` (o `data/on-premise` por defecto) debe respaldarse con el resto del servidor.

---

## Validación RS256 y claims

- **Algoritmo:** solo **RS256** (`jwt.verify` con `algorithms: ["RS256"]`).
- **Clave pública:**
  - **`LICENSE_PUBLIC_KEY_PEM`**: PEM inline; se pueden usar `\n` escapados en el string del `.env`.
  - **`LICENSE_PUBLIC_KEY_PATH`**: ruta absoluta o relativa al CWD; se resuelve con `path.resolve`. Si el archivo no existe, se registra warning y se considera no configurada.
  - Si no hay PEM efectivo → estado **`PUBLIC_KEY_NOT_CONFIGURED`** (no se puede validar ni subir licencia hasta configurarla).

**`modalidad`:** debe ser compatible con **ON_PREMISE** tras normalizar: `trim`, mayúsculas, guiones → guiones bajos (acepta p. ej. `ON_PREMISE`, `on-premise`, `on_premise`).

**Checks para estado OK:** firma válida, no expirado (`exp` > ahora UTC si está presente), `installationId` del claim **igual** al del servidor, `modalidad` on-premise.

---

## Caché en memoria (estado)

- **`getStatus()`** cachea el DTO completo **60 segundos** (`cacheTtlMs = 60_000`).
- **Invalidación:** al guardar licencia con éxito (`POST upload`) y al crear un `installationId` nuevo en disco.

Operadores: cambios manuales en disco de `license.jwt` pueden tardar hasta **60 s** en reflejarse en `GET status` sin reiniciar el API.

---

## Estados (`state` en `GET .../status`)

Respuesta JSON de **`GET /api/admin/on-premise-license/status`** (200): campos alineados con `OnPremiseLicenseStatusDto` en código.

| `state` | Significado breve |
|---------|-------------------|
| **`OK`** | Licencia válida para esta instalación. |
| **`MISSING`** | No existe `license.jwt` (o vacío/no legible). |
| **`INVALID`** | Firma RS256 inválida, token mal formado, o `modalidad` no compatible. |
| **`EXPIRED`** | Firma válida pero `exp` en el pasado (o `TokenExpiredError` en verify). |
| **`INSTALLATION_MISMATCH`** | JWT verificado y vigente pero `installationId` del claim ≠ servidor. |
| **`PUBLIC_KEY_NOT_CONFIGURED`** | Falta clave pública en env/archivo. |

Campos adicionales: `installationId`, `expiresAt` (ISO o `null`), `empresa`, `modalidad`, `message` (texto humano).

---

## Bloqueo del API (403) — rutas fuera de allowlist

Si la licencia **no** está **`OK`**, cualquier ruta **no** allowlisted responde **403** con cuerpo JSON:

```json
{
  "statusCode": 403,
  "code": "ON_PREMISE_LICENSE_BLOCKED",
  "licenseState": "MISSING",
  "message": "No hay archivo de licencia (license.jwt)."
}
```

`licenseState` repite el mismo valor que tendría `state` en `GET .../status` para esa instalación (incl. `PUBLIC_KEY_NOT_CONFIGURED`).

**Diferencia con errores de upload:** el bloqueo global usa **`code: ON_PREMISE_LICENSE_BLOCKED`**. La subida de licencia usa otro contrato (ver siguiente sección).

---

## Endpoints admin (implementación exacta)

| Método | Ruta HTTP | Auth |
|--------|-----------|------|
| `GET` | **`/api/admin/on-premise-license/status`** | `JwtAuthGuard` + `RolesGuard` → `ADMIN_DEV`, `ADMIN` |
| `POST` | **`/api/admin/on-premise-license/upload`** | Igual |

**Body `POST upload`:** `{ "token": string }` (DTO validado; `whitelist` + `forbidNonWhitelisted`).

**Éxito upload:** **200** `{ "ok": true }`.

**Rechazo de negocio / validación:** **400** con cuerpo típico:

```json
{
  "statusCode": 400,
  "message": {
    "code": "LICENSE_UPLOAD_REJECTED",
    "message": "La licencia no es válida (firma RS256)."
  }
}
```

(Nest puede anidar `message`; el cliente debe leer el objeto si aplica.)

Mensajes posibles del servicio en upload (ejemplos): token vacío, clave pública no configurada, firma/exp/modalidad/`installationId` incorrectos. **No** se usa el mismo `code` que el 403 global.

**Usuario sin rol admin** en `GET/POST` admin: **403** del `RolesGuard` (mensaje de roles), no del guard de licencia.

---

## Módulo y archivos en repo

```
apps/api/
├── .env.example          # incluye ON_PREMISE_DATA_DIR, LICENSE_PUBLIC_KEY_*
└── src/
    ├── app.module.ts     # importa OnPremiseLicenseModule
    └── modules/on-premise-license/
        ├── on-premise-license.module.ts   # APP_GUARD → OnPremiseLicenseGuard
        ├── on-premise-license.service.ts
        ├── on-premise-license.controller.ts
        ├── on-premise-license.guard.ts
        ├── on-premise-license.constants.ts
        ├── on-premise-license.types.ts
        └── dto/upload-license.dto.ts
```

Dependencia: **`jsonwebtoken`** (+ `@types/jsonwebtoken` en dev).

---

## Qué **no** incluye este spike (siguen fuera)

- PostgreSQL para licencia, Prisma, tablas nuevas.
- Despliegue, systemd, Docker (documentación de operaciones aparte).
- UI web (siguiente tarea planificada: mini pantalla admin).
- Permiso atómico `manage:license` en BD.
- Emisión automática de JWT, revocación en línea, `jti` en servidor.
- Cambios al portable / licencia desktop legacy.
- Decorar cada controlador: el bloqueo es **un solo guard global** + allowlist.

---

## Validación manual sugerida

1. Sin clave pública: `GET /api/health` → **200**; ruta de negocio con JWT de usuario → **403** + `licenseState: PUBLIC_KEY_NOT_CONFIGURED`.
2. Con clave, sin `license.jwt`: vendedor logueado → ruta de negocio → **403** + `MISSING`; admin → `GET /api/admin/on-premise-license/status` → **200**, `state: MISSING`.
3. `POST /api/admin/on-premise-license/upload` con JWT válido → **200**; vendedor → negocio → **200** (tras caché o invalidación inmediata post-upload).
4. Borrar `license.jwt` y esperar TTL o reiniciar → bloqueo de negocio de nuevo.
5. Token mal firmado / expirado / otro `installationId` → `status` refleja `INVALID` / `EXPIRED` / `INSTALLATION_MISMATCH`; negocio **403**.
6. `POST /api/auth/login` sin licencia OK → **200** (allowlist).
7. Usuario no admin → `GET .../status` → **403** por roles.

---

## Próximos pasos (post-spike)

- Mini UI admin (consumir `status` + `upload`); ver README carpeta `servidores-locales`.
- Afinar allowlist si aparecen rutas nuevas (WebSockets, etc.).
- Opcional: escritura atómica de `installation.json`; mensajes de upload más granulares (p. ej. distinguir expirado vs firma inválida en `POST`).

---

*Spike v1 — bloqueo duro + allowlist en un solo `APP_GUARD`; filesystem + RS256; sin PostgreSQL para licencia ni portable.*

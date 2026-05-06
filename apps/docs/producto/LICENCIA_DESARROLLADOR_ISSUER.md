# Acceso desarrollador — licencia temporal vía servicio emisor

## 1. Propuesta técnica exacta

| Pieza | Comportamiento |
|-------|----------------|
| **UI** | En `license-blocked.html`, bloque colapsable **“Acceso desarrollador”** con correo, contraseña y días (1–N máx.). |
| **Preload** | Expone `license.requestDeveloperLicense({ email, password, days })` y `license.isDeveloperIssuerConfigured()`. |
| **Main (Electron)** | `license:requestDeveloperLicense`: **POST** al emisor (HTTPS en prod remoto; `http://127.0.0.1:…/api` permitido para API embebida) con `installationId` actual; valida firma con **`validateExternalLicenseFile`**, **`saveState`**, **`touchAnchor`**, relanzamiento como con archivo. |
| **Emisor (vos)** | Servicio HTTPS bajo vuestro control: autentica usuario (p. ej. contra BD o secretos en servidor), **no** en el cliente; calcula `validUntil`; firma payload con **el mismo `LICENSE_HMAC_SECRET`** que usa el escritorio al verificar. |
| **Expiración / bloqueo** | El payload incluye `validUntil` firmado → el flujo existente (`validateStoredState`, pantalla de bloqueo, banner de días) **no cambia**. |
| **Configuración URL** | Por defecto (instalador **con API embebida**): **`http://127.0.0.1:4000/api`** — la app concatena **`/v1/desktop-developer-license`** → `POST /api/v1/desktop-developer-license` en Nest. Opcional: **`DESKTOP_DEV_LICENSE_ISSUER_URL`** (origen base sin barra final) para otro host **HTTPS** en producción. Anular default: **`DESKTOP_DEV_LICENSE_DISABLE_EMBEDDED_DEFAULT=1`**. |
| **Implementación en repo** | El endpoint está en **`apps/api`** (`DesktopDeveloperLicenseModule`). La API arranca **antes** del chequeo de licencia en Electron para que el flujo funcione en la pantalla de bloqueo. |
| **Secreto HMAC** | Mismo **`LICENSE_HMAC_SECRET`** en `resources/backend/.env` (Nest) y verificación en escritorio; `main.js` hidrata `process.env` desde ese `.env` si el `.exe` no define la variable. |

**Credenciales:** el correo del desarrollador **no** se hardcodea en el `.exe`; el emisor decide qué cuentas son válidas (allowlist, roles, etc.).

---

## 2. Cambios de UI (ventana de licencia)

- Mantiene **“Seleccionar licencia”** y **“Salir”**.
- Debajo, elemento **`<details>`** / “Acceso desarrollador” con:
  - Campo **Correo** (`type="email"`).
  - Campo **Contraseña** (`type="password"`).
  - Campo **Días de licencia** (`type="number"`, min=1, max=30 en UI).
  - Botón **“Solicitar licencia temporal”**.
- Si el emisor **no está configurado** (`DESKTOP_DEV_LICENSE_ISSUER_URL` vacío), se muestra aviso y el botón puede deshabilitarse o al pulsar devolver mensaje claro.
- Mensajes de error genéricos en cliente (sin filtrar stack del servidor).

Archivo: **`apps/desktop/license-blocked.html`**.

---

## 3. Endpoint y flujo del servicio emisor

### `POST {BASE}/v1/desktop-developer-license`

**Headers:** `Content-Type: application/json`, `Accept: application/json`

**Body (cliente → servidor):**

```json
{
  "email": "string",
  "password": "string",
  "installationId": "uuid-v4",
  "requestedDays": 7,
  "appVersion": "0.1.0"
}
```

**Validación servidor (obligatoria):**

1. Solo **HTTPS** en producción (el cliente rechaza `http://` salvo entornos de laboratorio documentados).
2. `requestedDays` entero **1 ≤ d ≤ límite servidor** (recomendado **≤ 30**, ver §6).
3. `installationId` formato UUID.
4. Autenticación **email + password** contra vuestra fuente de verdad (BD, IdP, o usuario técnico dedicado). **No** comprobar el correo en el binario del desktop.
5. Autorización: solo cuentas con permiso explícito “emitir licencia desarrollador” (rol, claim, allowlist).
6. **Rate limiting** por IP + por `email` (p. ej. 10/h).
7. Auditar: `installationId`, `email` (hash opcional en log), `licenseId` emitido, `validUntil`, timestamp.

**Respuesta 200** — mismo formato que archivo `.json` local:

```json
{
  "payload": { ... },
  "sig": "hex_hmac_sha256"
}
```

**Errores recomendados:**

| HTTP | Uso |
|------|-----|
| 400 | Días fuera de rango, JSON inválido, `installationId` inválido |
| 401 | Credenciales incorrectas |
| 403 | Cuenta válida pero sin permiso para este flujo |
| 429 | Rate limit |
| 500 | Error interno (mensaje genérico al cliente) |

**Cálculo de `validUntil` en servidor:** igual que `--calendar-days N` en `generate-license.js`: fin del día civil **N días después del día UTC/local acordado** en que se emite (documentar si usáis TZ Chile o UTC).

---

## 4. Formato del `payload` firmado (idéntico a licencia por archivo)

Debe ser aceptado por `validateExternalLicenseFile` en `license/state.js`:

| Campo | Valor |
|-------|--------|
| `v` | `1` |
| `kind` | `"renewal"` |
| `licenseId` | `LIC-...` (único por emisión, ej. `LIC-DEV-<timestamp>`) |
| `licenseType` | `INTERNAL` (recomendado para este flujo) |
| `installationId` | El recibido en el POST (debe coincidir byte a byte con el del equipo) |
| `validUntil` | ISO 8601 — **única fuente de expiración** |
| `issuedAt` | ISO 8601 |
| `issuedTo` | opcional (ej. email del solicitante) |
| `note` | opcional (ej. `"developer-issuer-api"`) |

**Firma:** `sig = HMAC-SHA256( LICENSE_HMAC_SECRET, canonicalStringify(payload) )` en hexadecimal — **misma función** que `desktop/license/state.js` y `scripts/generate-license.js` (`Object.keys(obj).sort()` en JSON.stringify).

---

## 5. Validaciones de seguridad

| Tema | Acción |
|------|--------|
| Secreto HMAC | Solo en servidor emisor y en build del desktop (para **verificar**); nunca en el renderer ni en requests. |
| Transporte | TLS 1.2+; certificados válidos; el cliente puede reforzar con pinning en el futuro. |
| Contraseña | Nunca loguear en main ni en servidor en claro; comparación con hash (bcrypt/Argon2) en servidor. |
| Replay | Cada emisión = `licenseId` nuevo; opcional guardar `jti`/id en servidor para revocar. |
| Abuso de días | Límite duro en servidor **y** en cliente (UI + clamp antes de POST). |
| URL emisor | Configurada por env/IT; evitar endpoints anónimos sin autenticación. |
| Instalación | El servidor **no** debe aceptar otro `installationId` que el enviado si en el futuro añís tokens de sesión; hoy basta con binding en payload firmado. |

---

## 6. Límites recomendados para días temporales

| Contexto | Máx. `requestedDays` (UI + servidor) |
|----------|--------------------------------------|
| Desarrollo / soporte interno | **7–14** |
| Piloto extendido | **30** |
| Por encima de 30 | Solo con proceso manual (archivo firmado offline), no vía API automática |

Cliente (Electron): **máximo 30** en el formulario y en el handler antes del POST. Servidor debe volver a acotar (nunca confiar solo en el cliente).

---

## 7. Archivos en el repositorio

| Ruta | Rol |
|------|-----|
| `apps/desktop/license-blocked.html` | UI segunda opción |
| `apps/desktop/preload.js` | IPC |
| `apps/desktop/main.js` | `fetch` al emisor, validar y guardar |
| `apps/docs/producto/LICENCIA_DESARROLLADOR_ISSUER.md` | Esta especificación |
| `apps/docs/producto/ACCESO_DESARROLLADOR_USO.md` | Guía corta de uso en campo / build |
| `apps/api/src/modules/desktop-developer-license/*` | Endpoint real `POST /api/v1/desktop-developer-license` |
| `apps/desktop/scripts/dev-license-issuer-server.example.cjs` | Servidor de laboratorio **sin** dependencias extra (alternativa al Nest) |

**Variable de entorno:** `DESKTOP_DEV_LICENSE_ISSUER_URL` (definir al arrancar el `.exe`, en el acceso directo, o en el pipeline de build si aplica).

---

*El correo `eduardo.yanez.concha@gmail.com` debe estar autorizado solo en el **servidor emisor**, no en el código del cliente.*

# Acceso desarrollador en el escritorio — uso práctico

## Cómo queda el flujo (simple)

1. Abres la app en el PC del cliente → si no hay licencia válida, ves la pantalla de bloqueo.
2. **Opción A:** «Seleccionar licencia» (archivo `.json` / `.lic` como siempre).
3. **Opción B:** Desplegás **«Acceso desarrollador»** → correo, contraseña, días → **Solicitar licencia temporal**.
4. La app guarda la licencia en el equipo, se reinicia y entra al producto; el contador de días es el que ya existía en la UI.
5. Cuando venza `validUntil`, vuelve el bloqueo total hasta nuevo archivo o nuevo acceso desarrollador.

No tenés que copiar manualmente el `installationId` a otro lado: la app lo manda sola a la API.

## Qué se cambió en el proyecto

| Parte | Qué hace |
|--------|-----------|
| **API Nest** (`POST /api/v1/desktop-developer-license`) | Valida email/contraseña contra la BD (mismo login que la web). Solo usuarios con rol **ADMIN_DEV** pueden emitir. Firma el payload HMAC con `LICENSE_HMAC_SECRET`. |
| **Electron `main.js`** | Arranca la **API embebida antes** de comprobar la licencia, así el POST funciona aunque la app esté bloqueada. URL por defecto del emisor: `http://127.0.0.1:4000/api` (sin variables extra). Lee `LICENSE_HMAC_SECRET` del `.env` del backend embebido si el `.exe` no trae la variable en el entorno. |
| **`.env` embebido** (`embed-api/.env` / plantilla `api/.env.desktop`) | Un solo lugar para `LICENSE_HMAC_SECRET` (y debe coincidir con el valor usado al generar licencias por script si usás el mismo build). |
| **Pantalla `license-blocked.html`** | Dos caminos claros: archivo vs acceso desarrollador. |

## Procedimiento de build (una vez por release)

1. En la plantilla que copiás al backend embebido (`api/.env.desktop` → `resources/backend/.env` en el paquete), definí **`LICENSE_HMAC_SECRET`** con un valor fuerte y **fijo** para esa línea de producto.
2. Empaquetá el escritorio como siempre (ese `.env` viaja dentro del instalador).
3. No hace falta repetir pasos en cada visita al cliente: el mismo instalador ya trae API + secreto alineado.

Opcional: si también definís `LICENSE_HMAC_SECRET` en el acceso directo del `.exe`, ese valor **manda** sobre el `.env`.

## Electron en desarrollo (no empaquetado)

1. **API Nest** en `http://127.0.0.1:4000` (`apps/api`: `npm run start:dev` o equivalente).
2. En `apps/api/.env`: `LICENSE_HMAC_SECRET` (≥16 caracteres; puede ser el mismo placeholder de desarrollo que usa Electron si no definís la variable en el shell) y **`DESKTOP_LICENSE_DIAG_ALLOW=1`** para que responda el diagnóstico HMAC (`GET /api/v1/desktop-license-debug/diag`). Plantilla: `.env.example`.
3. **Electron** (`apps/desktop`): sin variables extra, el emisor por defecto es **`http://127.0.0.1:4000/api`** (igual que el portable). Para desactivar: `DESKTOP_DEV_LICENSE_DISABLE_EMBEDDED_DEFAULT=1`.
4. **Alineación HMAC:** en la pantalla de bloqueo, «Diagnóstico HMAC» debe mostrar la misma huella (16 hex) en Electron y en Nest cuando ambos usan el mismo secreto.
5. **Licencia temporal:** usuario con rol **ADMIN_DEV** en la BD (seed bootstrap).

## Cómo probarlo vos en el PC del usuario

1. Instalá / ejecutá el build empaquetado con API embebida y seed (usuario bootstrap del seed: **eduardo.yanez.concha@gmail.com** / **admin123**, rol ADMIN_DEV — cambiá la contraseña en producción).
2. Asegurate de que `resources/backend/.env` dentro del paquete tenga `LICENSE_HMAC_SECRET` no vacío (misma plantilla que arriba).
3. Abrí la app sin licencia → pantalla de bloqueo.
4. **Acceso desarrollador** → correo y contraseña ADMIN_DEV → días (ej. 7) → Solicitar.
5. Debería reiniciar y mostrar días restantes; al vencer, bloqueo otra vez.

Si ves error de firma o 503: revisá que `LICENSE_HMAC_SECRET` esté en el `.env` del backend embebido del instalador que estás probando.

## Desactivar el emisor por defecto (casos raros)

- `DESKTOP_DEV_LICENSE_DISABLE_EMBEDDED_DEFAULT=1` → no se usa `http://127.0.0.1:4000/api` por defecto; podés fijar otra base con `DESKTOP_DEV_LICENSE_ISSUER_URL`.

## Seguridad (resumen)

- Contraseña: solo al servidor local (o al que definas por URL); no se persiste en el cliente.
- Quién puede emitir: solo **ADMIN_DEV** en la BD.
- El binario no lleva tu correo ni contraseña; lleva el mismo tipo de secreto HMAC que ya usaban las licencias por archivo (no es “nuevo” en ese sentido).

Más detalle técnico del contrato HTTP/payload: `LICENCIA_DESARROLLADOR_ISSUER.md`.

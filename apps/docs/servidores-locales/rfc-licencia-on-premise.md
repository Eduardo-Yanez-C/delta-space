# RFC — Licencia on-premise (especificación funcional/técnica)

**Estado:** aprobado para planificación a largo plazo; **parte del comportamiento ya está implementada** como spike V1 en el backend (ver sección siguiente y [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md)).  
**Audiencia:** producto, backend, frontend, operaciones.  
**Relacionado:** [licenciamiento-on-premise.md](./licenciamiento-on-premise.md) (principios), [README.md](./README.md) (alcance carpeta).

---

## 1. Resumen ejecutivo

La licencia on-premise **ata el derecho de uso a una instalación concreta del servidor** (`installationId`), **no a cada PC cliente**. El **backend** es el único que valida firma, vigencia, límites y módulos. La **carga y renovación** ocurren por **administrador autorizado** vía **UI web** (desde su equipo en la LAN). El producto **sigue siendo licenciado**; servidor interno ≠ software libre.

---

## Spike V1 — implementación en código (referencia breve)

Lo siguiente es **real en el repositorio** (`apps/api`); las secciones §5–§17 de este RFC mezclan **diseño objetivo** y **nombres históricos** — cuando haya conflicto, manda el **spike**:

| Tema | Implementado (V1) |
|------|---------------------|
| Prefijo HTTP | Global **`/api`** (`setGlobalPrefix`) |
| Allowlist | `/api/health`, `/api/auth`, `/api/admin/on-premise-license` (reglas exactas en spike) |
| Admin API | `GET` / `POST` bajo **`/api/admin/on-premise-license`** (`status`, `upload` con `{ token }`) |
| Roles | `ADMIN_DEV`, `ADMIN` en decorador; **sin** `manage:license` en BD |
| Persistencia | `ON_PREMISE_DATA_DIR` + **`installation.json`** + **`license.jwt`** |
| Validación | **RS256**; `LICENSE_PUBLIC_KEY_PEM` o `LICENSE_PUBLIC_KEY_PATH` |
| Estados (`GET status`) | `OK`, `MISSING`, `INVALID`, `EXPIRED`, `INSTALLATION_MISMATCH`, `PUBLIC_KEY_NOT_CONFIGURED` |
| Bloqueo API | **403** `{ code: ON_PREMISE_LICENSE_BLOCKED, licenseState, message }` |
| Upload rechazado | **400** con **`LICENSE_UPLOAD_REJECTED`** (+ mensaje); **no** es el mismo contrato que el 403 global |
| Caché | **60 s** en memoria para `getStatus()` |
| Modo degradado | **No** — bloqueo duro fuera de allowlist |

**Diferencias frecuentes con el texto RFC debajo:** rutas tipo `/admin/license` o códigos `LICENSE_MISSING` en JSON son **conceptuales**; el código usa las rutas y códigos de la tabla anterior. `modalidad` acepta variantes normalizadas a **ON_PREMISE** (p. ej. `on-premise`). La UI admin de este RFC **aún no** está implementada en el frontend.

---

## 2. Formato del artefacto de licencia (recomendación)

- **Preferido:** **JWT firmado** (JWS, algoritmo **RS256** o **ES256**) en un solo archivo `.jwt` o texto pegado en UI.
- **Claims (payload)** — ver sección [Campos](#4-campos-del-payload-licencia) más abajo.
- **Firma:** clave privada solo en poder del **emisor de licencias** (fuera del servidor del cliente); el servidor del cliente incluye solo **clave pública** en variable de entorno o binario.

Alternativa equivalente: JSON canónico + firma detached (`.json` + `.sig`); mismo contenido semántico.

---

## 3. `installationId`

| Pregunta | Respuesta |
|----------|-----------|
| ¿Existe? | **Sí**, obligatorio en el modelo. |
| ¿Qué es? | Identificador **único e inmutable** de esta instalación del servidor (no del usuario). |
| ¿Cómo se obtiene? | En el **primer arranque** del backend en un entorno “vacío” (sin `installationId` persistido), el proceso genera un **UUID v4** (o ULID), lo guarda en **almacenamiento persistente** (archivo dedicado `installation.json` o tabla/row singleton `Installation`) y **nunca lo regenera** salvo borrado explícito de datos (nueva instalación). |
| ¿Para qué sirve? | El JWT de licencia incluye el mismo `installationId`; si no coincide, la licencia es **rechazada** (evita copiar un `.jwt` de otra empresa/servidor). |
| ¿Lo ve el admin? | **Sí**, en pantalla “Estado de licencia” / “Copiar ID de instalación” para solicitar licencia al proveedor. |

---

## 4. Campos del payload (licencia)

Nombres orientados a claims JWT (pueden mapearse 1:1 o con prefijo `lic_`).

| Campo / claim | Obligatorio | Tipo | Descripción |
|---------------|-------------|------|-------------|
| `iss` | Sí | string | Emisor del token (ej. `licencias.empresa-proveedor.com`). |
| `sub` | Sí | string | Identificador de contrato o SKU lógico. |
| `iat` | Sí | number | Fecha emisión (Unix). |
| `exp` | Sí | number | Fecha expiración (Unix); puede alinearse con `fechaExpiracion` explícita. |
| `modalidad` | Sí | string | Constante `ON_PREMISE`. |
| `empresa` | Sí | string | Razón social o nombre licenciatario (mostrable en UI admin). |
| `installationId` | Sí | string | Debe coincidir **exactamente** con el almacenado en el servidor. |
| `maxUsuariosActivos` | No | number | Tope de usuarios con `active=true`; si null, sin límite explícito en token. |
| `modulos` | No | string[] | Ej. `["STANDARD_QUOTES","MARGIN_QUOTES","FV_STUDIES"]`; ausencia = todos los módulos base acordados en contrato o política por defecto documentada. |
| `jti` | Recomendado | string | ID único del token para revocación futura / auditoría. |

**No** incluir secretos del cliente en el JWT. La **firma** es la prueba de autenticidad.

---

## 5. Flujo de primera instalación

1. Operaciones instala SO, Node, PostgreSQL (futuro), despliega backend + frontend.
2. **Primer arranque** del backend: no existe `installationId` persistido → se **genera** y se **guarda**.
3. No existe archivo/token de licencia → estado global (spike): **`MISSING`** en `GET .../status`; ver [spike](./spike-licencia-on-premise-v1.md).
4. **Spike V1:** allowlist incluye `GET /api/health`, rutas bajo `/api/auth` (p. ej. `POST /api/auth/login` sin JWT), y **`/api/admin/on-premise-license/*`** (con JWT admin en controlador). **RFC histórico:** “solo login para usuarios con permiso de licencia” — **no** aplicado en V1 (cualquiera puede intentar login; el negocio sigue bloqueado sin licencia OK).
5. Resto de API (spike): **403** con **`ON_PREMISE_LICENSE_BLOCKED`** y `licenseState` (p. ej. `MISSING`). El RFC mencionaba `LICENSE_MISSING` como nombre conceptual.
6. Admin inicia sesión → ve **banner o pantalla** “Instalación sin licencia” con **installationId** copiable y acción “Cargar licencia”.

---

## 6. Flujo cuando no hay licencia válida

| Situación | Comportamiento |
|-----------|----------------|
| Archivo ausente | Estado `LICENSE_MISSING`; API bloqueada salvo excepciones de §5. |
| Archivo corrupto / firma inválida | Estado `LICENSE_INVALID`; mismo bloqueo; log detallado servidor. |
| `installationId` del token ≠ servidor | `LICENSE_INSTALLATION_MISMATCH`; bloqueo; mensaje admin: “Licencia no es para este servidor”. |
| Token manipulado | Firma falla → `LICENSE_INVALID`. |

**Usuarios sin rol de licencia:** si intentan usar la app, tras login reciben respuesta genérica o pantalla “Sistema no disponible; contacte al administrador” **sin** ver `installationId`.

---

## 7. Flujo de carga inicial de licencia (admin autorizado)

1. Admin accede a **Área licencia** (ruta dedicada, ej. `/admin/licencia` — **no** en sidebar para usuarios sin permiso; puede enlazarse desde ajustes solo si `canManageLicense`).
2. Sube archivo `.jwt` o pega texto en campo multilínea.
3. **POST** multipart o JSON al backend.
4. Backend: verifica firma con clave pública; parsea claims; compara `installationId`; comprueba `exp` y `modalidad === ON_PREMISE`.
5. Si OK: escribe token en almacenamiento acordado (§10), actualiza caché en memoria del proceso, estado **`LICENSE_OK`**.
6. Respuesta 200 + resumen no sensible (empresa, fecha fin, módulos).
7. Si error: 400 con código estable (`LICENSE_SIGNATURE_INVALID`, etc.).

---

## 8. Flujo de renovación

1. Mismo endpoint **POST** que carga inicial (idempotente: **reemplaza** licencia anterior).
2. Opcional: guardar **historial** solo metadatos (`jti`, `iat`, `exp`, usuario que subió, timestamp) en tabla `LicenseAudit` — no duplicar tokens completos indefinidamente si política lo restringe.
3. Tras éxito, estado vuelve a `LICENSE_OK` o `LICENSE_EXPIRING` según fechas.

---

## 9. Comportamiento cuando está por vencer

**Definición:** configurable, ej. `T_warn = 30` días antes de `exp`.

| Ámbito | Comportamiento |
|--------|----------------|
| Backend | Estado derivado `LICENSE_EXPIRING`; header HTTP opcional `X-License-Expires-In-Days` o campo en `GET /admin/license/status`. |
| API de negocio | **Sin bloqueo** mientras `exp` no haya pasado. |
| UI admin | Banner persistente: “La licencia vence el DD/MM/AAAA”. |
| UI usuario normal | Opcional: banner suave “Mantenimiento de contrato pendiente” o ninguno (decisión producto). |

---

## 10. Comportamiento cuando vence

**Política recomendada en este RFC (ajustable antes de implementar):**

- **`exp` < ahora (UTC):** estado `LICENSE_EXPIRED`.
- **Modo degradado (recomendado):**  
  - **Lectura:** permitir GET de recursos existentes (cotizaciones, clientes, listados).  
  - **Escritura:** bloquear POST/PATCH/DELETE que creen o modifiquen datos de negocio (cotizaciones, plantillas, etc.).  
  - **Siempre permitido:** login admin con permiso licencia, `GET/POST /admin/license/*`, `GET /health`.
- **Alternativa dura:** 403 en casi todo salvo renovación (más simple de implementar, peor UX).

Usuarios no-admin: mensaje claro “El período de licencia ha finalizado. Contacte al administrador.”

---

## 11. Quién puede ver / cargar / renovar

| Acción | Rol / permiso |
|--------|----------------|
| Ver `installationId` y estado (`OK`, `EXPIRING`, `EXPIRED`, fechas, empresa en claro) | `LICENSE_ADMIN` o permiso atómico `manage:license` (recomendado mapear a `ADMIN` + `ADMIN_DEV` en v1 o solo `ADMIN_DEV`). |
| Subir / reemplazar token | Mismo permiso. |
| Ver solo “sistema no disponible” | Cualquier usuario sin permiso anterior. |
| Ver fechas de expiración en UI estándar | **No** (opcional excepción: rol “billing” futuro). |

**Regla:** un solo conjunto pequeño de cuentas con `manage:license`; auditar cada POST.

---

## 12. Almacenamiento en el servidor

**Recomendación v1:**

1. **Archivo único** en path configurable, ej. `LICENSE_FILE_PATH=/var/lib/.../license.jwt`  
   - Permisos: solo usuario del proceso del API lectura/escritura; no world-readable.  
   - Backup junto con BD y documentado en runbook.

2. **Caché en memoria** tras lectura exitosa al arranque (token decodificado + `exp`); invalidar al recibir POST exitoso.

**Opcional v2:** duplicar `jti`, `exp`, `installationId` en tabla SQL para consultas sin leer disco — no sustituye verificación criptográfica del archivo al arranque.

**installationId** persiste en:

- `INSTALLATION_ID_FILE` o tabla `app_metadata` key `installation_id` — **una fila**.

---

## 13. Validación en el backend

| Momento | Qué se valida |
|---------|----------------|
| Arranque | Existe archivo (si política exige licencia desde día 1); firma; `modalidad`; `installationId`; `exp` (para fijar estado inicial). |
| Cada request (middleware) | Estado en memoria: si `LICENSE_MISSING`/`INVALID`/`EXPIRED` (modo duro) o degradado, aplicar reglas de §6 y §10. **Optimización:** no re-leer disco por request; solo refrescar tras upload o job cada N minutos opcional. |
| Tras upload | Re-lectura completa y actualización de estado. |
| Alta de usuario | Si `maxUsuariosActivos` definido, contar activos y rechazar si excede. |
| Módulo (ej. MARGIN) | Si `modulos` presente, comprobar inclusión antes de ejecutar rutas del módulo. |

**Clave pública:** `LICENSE_PUBLIC_KEY_PEM` en env (multiline escapada) o archivo montado por volumen.

---

## 14. UI admin — pantallas / estados futuros

1. **Estado de licencia** (`/admin/licencia` o bajo “Datos de empresa” solo si permiso): installationId con botón copiar, estado, empresa, expiración, módulos, límite usuarios.  
2. **Cargar / renovar:** upload + pegar texto + botón enviar + mensajes de error por código.  
3. **Banner global (admin):** expiring / expired.  
4. **Post-login redirect:** si `LICENSE_MISSING` y usuario es admin licencia → redirigir a pantalla de carga.  
5. **Usuarios sin permiso:** página mínima “No disponible” sin datos técnicos.

**No** añadir entrada en sidebar principal para roles sin permiso (enlace condicional o URL directa documentada para IT).

---

## 15. Diferencia vs esquema portable / local actual

| Portable / local | On-premise (este RFC) |
|------------------|------------------------|
| Licencia o validación asociada al **equipo** o archivo en **cliente** | Asociada a **servidor** + `installationId` |
| Validación potencialmente en proceso desktop o dispersa | **Siempre** en backend Nest |
| Renovación por máquina | **Una** licencia; renovación central |
| Riesgo de copias divergentes | Token atado a `installationId` + firma |

Hasta implementar este RFC, el código legacy **coexiste**; la migración será explícita en un plan de release on-premise.

---

## 16. Qué **no** se implementa en esta fase

- **Ya implementado (spike V1):** guard global tipo `APP_GUARD`, endpoints admin bajo `/api/admin/on-premise-license`, persistencia FS, RS256 — ver [spike](./spike-licencia-on-premise-v1.md).
- **Sigue sin implementar:** PostgreSQL dedicado a licencia, despliegue real documentado en runbook, reverse proxy en código, **UI** admin en Next, entidades Prisma para licencia, permiso atómico `manage:license` en BD.
- Infraestructura de **emisión** automática de JWT (portal del proveedor); el admin **recibe** un `.jwt` firmado externamente.  
- Revocación en línea (OCSP) — solo `jti` en auditoría para trazabilidad (futuro).  
- Licencias flotantes multi-servidor.

---

## 17. Códigos de error HTTP / cuerpo (recomendación)

**Implementación spike V1 (real):**

- Bloqueo de API: **`ON_PREMISE_LICENSE_BLOCKED`** + campo **`licenseState`** (valores como `MISSING`, `INVALID`, …).
- Rechazo de subida: **`LICENSE_UPLOAD_REJECTED`** en **400** (ver spike).

**Recomendación RFC / nombres conceptuales** (útiles para producto o futuras versiones):

```json
{ "code": "LICENSE_MISSING", "message": "Instalación sin licencia válida." }
```

Otros conceptuales: `LICENSE_INVALID`, `LICENSE_EXPIRED`, `LICENSE_INSTALLATION_MISMATCH`, `LICENSE_SIGNATURE_INVALID`, `LICENSE_USER_LIMIT`.

---

## Referencias cruzadas

- [licenciamiento-on-premise.md](./licenciamiento-on-premise.md)  
- [backend-interno.md](./backend-interno.md)  
- [checklist-puesta-en-marcha.md](./checklist-puesta-en-marcha.md)

---

*RFC: visión amplia; spike V1 implementado en backend — ver [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md).*

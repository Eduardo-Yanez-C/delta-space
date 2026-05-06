# Licenciamiento on-premise central

## Principios (decisión de producto)

1. El software **sigue siendo licenciado** en despliegue servidor interno: **no** se libera el uso por el hecho de estar en LAN.
2. La licencia **no** depende de cada PC cliente; depende de la **instalación del servidor** (identidad de instancia).
3. La **validación** la realiza el **backend** en arranque y en operaciones sensibles (configurable).
4. La **carga y renovación** las realiza **solo** un administrador autorizado (ej. usted u otro rol `LICENSE_ADMIN` / `ADMIN_DEV` acotado), **desde su computador vía navegador** contra la URL interna — no requiere consola en el servidor para el flujo estándar.
5. Los **usuarios normales** no ven ni modifican la licencia.

---

## Spike V1 — qué está implementado hoy (backend)

En el API Nest existe ya un **primer corte** documentado al detalle en [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md):

- **`installation.json`** + **`license.jwt`** en disco bajo `ON_PREMISE_DATA_DIR` (por defecto `<cwd>/data/on-premise`).
- Validación **RS256** con **`LICENSE_PUBLIC_KEY_PEM`** o **`LICENSE_PUBLIC_KEY_PATH`**.
- **`OnPremiseLicenseGuard`** como **`APP_GUARD`**: lista blanca explícita (`/api/auth`, `/api/health`, `/api/admin/on-premise-license`) y **403** `ON_PREMISE_LICENSE_BLOCKED` fuera de ella si la licencia no está **OK**.
- Endpoints admin: **`GET /api/admin/on-premise-license/status`**, **`POST /api/admin/on-premise-license/upload`** (solo **`ADMIN_DEV`** / **`ADMIN`** con JWT).
- **Caché en memoria** del estado **60 s**; sin modo degradado (bloqueo duro del resto del API).
- Estados devueltos en `status`: `OK`, `MISSING`, `INVALID`, `EXPIRED`, `INSTALLATION_MISMATCH`, `PUBLIC_KEY_NOT_CONFIGURED`.

Los párrafos siguientes de este documento siguen siendo el **modelo normativo y objetivo** a largo plazo (UI admin completa, auditoría, límites por token, etc.). Donde difieran del spike V1, prevalece el **spike** como descripción del **código actual**.

---

## Diferencia con el esquema portable / local actual

| Aspecto | Portable / licencia local por archivo (herencia) | On-premise central (objetivo) |
|---------|--------------------------------------------------|-------------------------------|
| Qué identifica la licencia | A menudo máquina o carpeta local | **Instalación del servidor** (ID de instalación + firma) |
| Quién valida | Proceso local / lectura de archivo en cliente | **Backend** en cada petición crítica o middleware global |
| Renovación | Puede ser manual por PC | **Una** renovación en servidor; afecta a todos los usuarios |
| Riesgo | Divergencia entre PCs, copias no controladas | Punto único de verdad en servidor |

*Nota:* el portable y mecanismos legacy en cliente pueden coexistir; un **API on-premise** puede ejecutar además el spike V1 descrito arriba. Este documento define el **modelo objetivo** además del corte V1 ya codificado.

---

## Modelo de licencia propuesto (payload lógico)

Estructura conceptual del contenido firmado (JSON o JWT firmado) que el emisor (usted / sistema de licencias) entrega al cliente:

| Campo | Tipo / uso |
|-------|------------|
| `empresa` | Nombre o ID legal del licenciatario |
| `modalidad` | Valor fijo `ON_PREMISE` para esta línea |
| `fechaEmision` | ISO 8601 |
| `fechaExpiracion` | ISO 8601; al superarse, modo degradado o bloqueo (política explícita abajo) |
| `maxUsuarios` | Opcional; límite de cuentas activas o concurrentes |
| `modulosHabilitados` | Opcional; lista (ej. `MARGIN`, `FV_STUDIES`) si se quiere granularidad |
| `installationId` | Identificador único de la instalación del servidor (generado en primer arranque y persistido) |
| `firmaDigital` | Firma asimétrica (ej. RS256) sobre el cuerpo; backend valida con **clave pública** embebida o en env |

Variantes de almacenamiento:

- **Archivo** en servidor: `license.json` + firma detached, o un solo `.jwt` firmado.
- **Registro en BD** cifrado: tabla `License` con payload y firma — backup junto con BD.

---

## Dónde vive la licencia en el servidor

- **Filesystem (spike V1):** directorio configurable `ON_PREMISE_DATA_DIR`; archivos **`license.jwt`** e **`installation.json`**. Escritura de la licencia vía **`POST /api/admin/on-premise-license/upload`**. Mantener fuera del webroot y con permisos acotados al usuario del proceso del API.
- **Objetivo / futuro:** endpoint genérico tipo `/admin/license` o copia en **BD** para consulta rápida — no sustituye la verificación criptográfica del artefacto firmado.

Debe incluirse en **backups**; restaurar backup implica restaurar licencia válida en esa fecha.

---

## Cómo la valida el backend

**Spike V1 (implementado):** en **cada petición** no allowlisted, un **guard global** consulta el estado de licencia (con **caché ~60 s** en memoria). No hay validación solo al arranque. Respuesta de bloqueo: **403** con `code: ON_PREMISE_LICENSE_BLOCKED` y `licenseState` alineado al `state` de `GET .../status` (ver spike).

**Objetivo ampliado (RFC / futuro):** validación al arranque; middleware o reglas por módulo; **maxUsuarios / módulos** en altas de usuario o feature flags.

Errores hacia el cliente: mensajes controlados; detalle criptográfico solo en logs del servidor.

---

## Qué pasa cuando vence

**Spike V1:** **bloqueo duro** de todo el API salvo la **lista blanca** (auth, health, endpoints admin de licencia). Sin modo lectura degradada.

**Objetivo / RFC:** opciones de **modo lectura** vs bloqueo total — a acordar si se implementan en una fase posterior.

En cualquier caso debe quedar **mensaje claro** para el admin (“cargue nueva licencia / contacte soporte”) sin exponer secretos.

---

## Quién puede renovarla

- Rol explícito: **administrador de licencia** (puede coincidir con `ADMIN` o ser subconjunto).
- Acción: subir archivo nuevo o pegar token firmado en UI protegida.
- **Auditoría:** registrar usuario, timestamp, hash del nuevo archivo (no el secreto completo en logs).

---

## Relación con cloud y Drive

- La licencia on-premise **no** sustituye almacenamiento en Google Drive.
- Drive puede guardar **copia de respaldo** del archivo de licencia por política de archivo, pero la **validación** es siempre contra lo desplegado en servidor.

---

## Siguiente paso de implementación

1. ~~Generar `installationId` persistente~~ (**hecho** en spike V1).
2. Definir par de claves emisor/receptor y proceso de emisión de licencias (fuera de repo; soporte).
3. **UI mínima admin** para consumir `GET/POST .../on-premise-license` (planificado como siguiente iteración).
4. Tests automatizados de expiración y tampering (mejora continua).

---

*Este documento es la referencia normativa para la línea “Servidores locales” respecto a licenciamiento; el detalle del código V1 está en el spike.*

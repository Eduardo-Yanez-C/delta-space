# Servidores locales — documentación on-premise

**Nombre de la línea de trabajo:** *Servidores locales*  
**Ruta en el repositorio:** `apps/docs/servidores-locales/`  
**Audiencia:** arquitectura, operaciones, desarrollo, producto — **no** es documentación de usuario final ni pantalla en la aplicación.

---

## Propósito de esta carpeta

Centralizar la **estrategia, decisiones y plan de despliegue interno (on-premise)** del software: un único servidor en la red de la empresa que concentra backend, base de datos, almacenamiento y validación de licencia, con acceso vía **navegador en la LAN**.

**Nota de prioridad de producto:** el modelo **principal** orientado a vendedores en PC propio — aplicación de escritorio instalable, licenciamiento fuerte y datos opcionalmente centralizados vía **Hub** (no carpetas compartidas) — está descrito en **`apps/docs/producto/arquitectura-escritorio-licenciamiento-central.md`**. Esta carpeta sigue siendo válida para clientes que elijan explícitamente servidor web interno.

Esta área existe para **separar explícitamente** esta línea de trabajo de:

| Enfoque | Relación con esta carpeta |
|--------|---------------------------|
| **Portable** (actual) | Herencia documentada como *no* objetivo para multiusuario en red. Ver `licenciamiento-on-premise.md` y `arquitectura-on-premise.md`. |
| **Cloud pública** (futuro) | Fuera de alcance por decisión actual. No se planifica aquí despliegue en GCP/AWS/Azure salvo referencias comparativas puntuales. |
| **Google Drive / carpeta de red compartida** | **No** es base del sistema: no sustituye BD central ni backend. El respaldo en Drive puede coexistir como *backup* del servidor, no como runtime. |
| **Módulos funcionales** (cotizaciones, plantillas, FV, etc.) | La documentación funcional sigue en `api/docs/`, `web/docs/`, etc. Aquí solo se describe **cómo** esos módulos conviven en un servidor interno. |

---

## Decisión arquitectónica aprobada

- **Servidor interno** de la empresa (VM o físico).
- **Backend API** único, escuchando en red interna (y/o reverse proxy).
- **Base de datos central** seria (orientación: PostgreSQL) — no SQLite compartido por SMB.
- **Frontend web** servido para usuarios que acceden por **IP o nombre interno** (`http(s)://servidor-cotizaciones...`).
- **Storage** en disco del servidor (uploads, logos, PDFs generados, capturas) — no en el PC de cada usuario como fuente de verdad.
- **Licencia on-premise central**: vinculada a la **instalación del servidor**, validada por el **backend**; carga y renovación previstas para **administradores autorizados** desde la interfaz web. El software **sigue siendo licenciado**; el servidor local **no** implica producto liberado.

---

## Estado implementado vs pendiente (resumen)

| Tema | Estado |
|------|--------|
| **Backend spike V1** — FS (`installation.json`, `license.jwt`), RS256, `APP_GUARD` + allowlist, `GET/POST /api/admin/on-premise-license/*` | **Implementado** — ver [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md) |
| **PostgreSQL** en el repo (`schema.prisma` + baseline `20260210120000_postgresql_baseline`; SQLite archivado en `migrations-sqlite-archive/`) | **Hecho** — operación servidor/staging: ver `apps/deploy/servidor-local/` |
| **Mini UI admin** — `/admin/licencia-on-premise` | **Implementado** |

---

## Qué **no** incluye esta etapa (por ahora)

- Alineación del **portable/desktop** (puede seguir en SQLite en su propio empaquetado) con esta línea servidor.
- Despliegue automatizado en producción interna (ver `despliegue-paso-a-paso.md` como guía futura).
- Entrada grande en el sidebar para todos los usuarios (la mini UI admin irá acotada a admins).
- Historial de licencias, emisión automática, revocación en línea, permiso `manage:license` en BD.

---

## Índice de documentos

| Documento | Contenido |
|-----------|-----------|
| [arquitectura-on-premise.md](./arquitectura-on-premise.md) | Vista objetivo: componentes y flujo LAN. |
| [backend-interno.md](./backend-interno.md) | Rol del API, arranque, CORS, servicios. |
| [frontend-web-interno.md](./frontend-web-interno.md) | Navegador, URL interna, relación con desktop. |
| [base-de-datos-interna.md](./base-de-datos-interna.md) | Por qué no SQLite multiusuario en red; PostgreSQL. |
| [storage-local-servidor.md](./storage-local-servidor.md) | Uploads y archivos en el servidor. |
| [seguridad-y-red.md](./seguridad-y-red.md) | LAN, HTTPS interno, roles, firewall, backups. |
| [licenciamiento-on-premise.md](./licenciamiento-on-premise.md) | Modelo de licencia, diferencia vs portable; **+ spike V1**. |
| [rfc-licencia-on-premise.md](./rfc-licencia-on-premise.md) | RFC amplio; **+ sección alineada al spike V1**. |
| [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md) | **Referencia de implementación real** (allowlist, endpoints, estados, 403, FS). |
| [variables-entorno-ejemplo.md](./variables-entorno-ejemplo.md) | Variables conceptuales (sin secretos), **incl. licencia on-premise**. |
| [despliegue-paso-a-paso.md](./despliegue-paso-a-paso.md) | Orden recomendado de implementación futura. |
| [../../deploy/servidor-local/README.md](../../deploy/servidor-local/README.md) | **Carpeta operativa** (pendrive/handoff), no solo conceptual. |
| [checklist-puesta-en-marcha.md](./checklist-puesta-en-marcha.md) | Lista previa a declarar operativo. |

---

## Estado actual del producto (contexto)

El sistema ya incluye: frontend web, backend Nest, Prisma, auth y roles, cotizaciones STANDARD/MARGIN, plantillas y snapshots MARGIN, datos de empresa, vista previa/PDF, logo y branding. El **repositorio del API** usa **PostgreSQL** como motor Prisma para servidor/staging (migraciones SQLite archivadas). El **portable/desktop** puede seguir en su propia línea. La línea *Servidores locales* incluye **carpeta operativa** `apps/deploy/servidor-local/` para handoff al servidor.

---

*Última actualización: PostgreSQL baseline en repo; carpeta `apps/deploy/servidor-local/`; UI admin licencia implementada.*

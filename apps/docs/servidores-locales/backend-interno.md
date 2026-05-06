# Backend en servidor local

## Rol del backend

En despliegue on-premise, el backend (NestJS + Prisma en este proyecto) es el **único** componente que:

- Autentica y autoriza usuarios (JWT, roles, permisos ya existentes).
- Ejecuta reglas de negocio (cotizaciones STANDARD/MARGIN, plantillas, FV, etc.).
- Persiste en la **base de datos central**.
- Lee/escribe **archivos** en rutas del servidor (`uploads/`, etc.).
- **Valida la licencia on-premise (spike V1):** `OnPremiseLicenseGuard` como **`APP_GUARD`** en cada petición HTTP (con caché ~60 s del estado), salvo rutas en lista blanca — detalle en [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md) y [licenciamiento-on-premise.md](./licenciamiento-on-premise.md).

Los clientes (navegadores) **no** acceden a la BD ni al filesystem directamente.

---

## Arranque y proceso

- Un **único proceso** (o réplicas detrás de balanceador, fase avanzada) escucha en un puerto TCP interno (ej. `3000`, `4000`).
- Variables de entorno cargadas desde archivo `.env` en el servidor (no commiteado).
- **Health check** expuesto como **`GET /api/health`** (prefijo global `api` en Nest) para monitorización interna.
- **Logs** hacia stdout/archivo rotativo en el servidor para auditoría y soporte.

---

## Variables clave (concepto)

Detalle en `variables-entorno-ejemplo.md`. Mínimo conceptual:

- `DATABASE_URL` — cadena del motor cliente/servidor (PostgreSQL).
- `JWT_SECRET` — firma de tokens; rotación documentada.
- `NODE_ENV=production`
- Rutas de storage: directorio base de uploads (absoluto en el servidor).
- Licencia on-premise (spike V1): **`LICENSE_PUBLIC_KEY_PEM`** o **`LICENSE_PUBLIC_KEY_PATH`**, **`ON_PREMISE_DATA_DIR`** (opcional). Ver `variables-entorno-ejemplo.md`.

---

## CORS y red interna

- El frontend se servirá desde un **origen** concreto (ej. `https://cotizaciones.empresa.local`).
- El backend debe listar ese origen en **CORS** `origin` permitidos — no `*` con credenciales.
- Si frontend y API comparten el mismo host detrás de un reverse proxy (mismo dominio, rutas `/api`), CORS puede simplificarse.

---

## Rutas y servicios necesarios (existentes + futuros)

**Ya presentes en el producto (ejemplos):** auth, cotizaciones, clientes, productos, estudios FV, plantillas, company-profile, documentos de cotización.

**Licencia on-premise (spike V1 — implementado):**

- Endpoints **`GET /api/admin/on-premise-license/status`** y **`POST /api/admin/on-premise-license/upload`** (JWT + roles `ADMIN` / `ADMIN_DEV`).
- Guard global: si la licencia no está **OK**, **403** con `code: ON_PREMISE_LICENSE_BLOCKED` fuera de la allowlist (`/api/auth`, `/api/health`, `/api/admin/on-premise-license`).

**Ampliaciones futuras (RFC):** auditoría de uploads, límites por claim, modo degradado, UI admin en el navegador.

---

## Separación portable vs servidor

| Aspecto | Portable / dev local | Servidor on-premise |
|---------|----------------------|---------------------|
| Quién escucha | Cada máquina puede tener su API | Solo el servidor |
| BD | A menudo SQLite archivo local | PostgreSQL en el mismo host o host DB dedicado |
| Licencia | Archivo local por instancia | Licencia **instalación servidor**, validada centralmente |

---

## Referencias

- `arquitectura-on-premise.md`, `seguridad-y-red.md`, `licenciamiento-on-premise.md`, `spike-licencia-on-premise-v1.md`.

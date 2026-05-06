# Variables de entorno — ejemplo conceptual (on-premise)

> **Aviso:** valores ilustrativos. No usar en producción sin sustituir por secretos reales gestionados por la empresa (vault, archivo `.env` fuera de git).

---

## Backend (API)

```bash
# Entorno
NODE_ENV=production
PORT=4000

# Base de datos (PostgreSQL recomendado en despliegue objetivo; el proyecto puede seguir en SQLite en dev)
DATABASE_URL=postgresql://cotizaciones_app:CAMBIAR_PASSWORD@127.0.0.1:5432/cotizaciones_pfv?schema=public

# Autenticación JWT (sesión de usuarios de la app; distinto del JWT de licencia on-premise)
JWT_SECRET=CAMBIAR_POR_CADENA_LARGA_ALEATORIA
JWT_EXPIRES_IN=8h

# Storage en disco del servidor (ruta absoluta)
UPLOADS_ROOT=/var/lib/cotizaciones-pfv/uploads
# o en Windows: D:\CotizacionesPfv\uploads

# Origen del frontend (CORS)
CORS_ORIGIN=https://cotizaciones.empresa.local

# --- Licencia on-premise (spike V1 — implementado) ---
# Clave pública RS256 para verificar el JWT de licencia (una de las dos formas):
LICENSE_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
# O ruta a un archivo PEM en el servidor:
# LICENSE_PUBLIC_KEY_PATH=/var/lib/cotizaciones-pfv/license/license-public.pem
# En Windows (ejemplo): LICENSE_PUBLIC_KEY_PATH=D:\CotizacionesPfv\license\license-public.pem

# Directorio donde el API persiste installation.json y license.jwt (opcional).
# Si se omite: <cwd del proceso>/data/on-premise
# ON_PREMISE_DATA_DIR=/var/lib/cotizaciones-pfv/on-premise
```

**Archivos generados por el API en ese directorio:**

| Archivo | Descripción |
|---------|-------------|
| `installation.json` | `{ "installationId": "<uuid>" }` — identidad de la instalación del servidor. |
| `license.jwt` | Contenido textual del JWT de licencia (escrito tras `POST /api/admin/on-premise-license/upload` exitoso). |

No usar `LICENSE_FILE_PATH` como nombre de variable en este proyecto: la ruta del token es **fija** bajo `ON_PREMISE_DATA_DIR` + `license.jwt`. Ver [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md).

---

## Frontend (Next.js build)

```bash
NODE_ENV=production

# URL base del API tal como la resuelve el navegador del usuario
NEXT_PUBLIC_API_URL=https://cotizaciones.empresa.local/api
```

Si frontend y API comparten host y path bajo reverse proxy, ajustar a la convención real (`/api` proxy pass).

---

## Reverse proxy (referencia Nginx — no es `.env` de Node)

```nginx
# Ejemplo conceptual: mismo host, /api → backend
# proxy_pass http://127.0.0.1:4000;
```

---

## Qué no commitear

- `.env`, `.env.production`, certificados privados, `JWT_SECRET`, passwords de BD, **clave privada** usada para **firmar** licencias (solo la pública va al servidor del cliente).

---

## Referencias

- [spike-licencia-on-premise-v1.md](./spike-licencia-on-premise-v1.md) — comportamiento real del spike.
- [backend-interno.md](./backend-interno.md), [despliegue-paso-a-paso.md](./despliegue-paso-a-paso.md), [licenciamiento-on-premise.md](./licenciamiento-on-premise.md).

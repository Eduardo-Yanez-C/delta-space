# Desarrollo local (API + Web + PostgreSQL)

Procedimiento mínimo verificado para recuperar el entorno cuando el login en `http://localhost:3000/login` falla o la API no responde.

## Requisitos

- **Node.js** (versión acorde al repo, p. ej. 20 LTS).
- **PostgreSQL** en marcha y una base vacía creada (ej. `cotizaciones_dev`).

## Variables de entorno

### API — `apps/api/.env`

Copiar desde `apps/api/.env.example` y ajustar:

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@localhost:5432/NOMBRE_BD` (**obligatorio**) |
| `PORT` | `4000` (por defecto) |
| `JWT_SECRET` | Cualquier secreto en dev |
| `CORS_ORIGIN` | `http://localhost:3000` (o comas si varios orígenes) |

Sin PostgreSQL y sin `DATABASE_URL` válida, **Nest no arranca** → el navegador muestra **Failed to fetch**.

### Web — `apps/web/.env.local` (opcional)

Copiar `apps/web/.env.local.example` → `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Si no existe el archivo, el código usa el mismo valor por defecto.

## Comandos (desde la raíz del monorepo `Sofware de cotrizaciones`)

Instalar dependencias (una vez o tras clonar):

```bash
npm install
```

Generar cliente Prisma y aplicar migraciones (con PostgreSQL levantado):

```bash
npm run prisma:generate --workspace=api
npm run prisma:migrate --workspace=api
```

Poblar datos iniciales (usuarios de prueba, etc.):

```bash
npm run prisma:seed --workspace=api
```

### Levantar todo junto (recomendado)

```bash
npm run dev
```

Esto ejecuta **API** (`nest start --watch` en puerto **4000**) y **Web** (`next dev` en puerto **3000**).

### Levantar por separado (dos terminales)

**Terminal 1 — API:**

```bash
npm run dev:api
```

**Terminal 2 — Web:**

```bash
npm run dev:web
```

## Portable (build)

Desde la raíz del monorepo:

```bash
npm run build:desktop:clean
```

Carpeta lista para copiar:

`apps/desktop/dist/Cotizaciones-PFV-Portable/`

Ejecutable: `Cotizaciones PFV Avanzada.exe`

## Validación rápida

1. **API:** abrir `http://localhost:4000/api/health` → debe responder JSON con `ok` (o equivalente).
2. **Web:** abrir `http://localhost:3000/login` → login sin "Failed to fetch".
3. **Portable:** ejecutar el `.exe`; revisar `backend.log` en la carpeta de datos de la app si algo falla.

## Nota sobre `localStorage`

En **modo desarrollo** (`next dev` en localhost), la URL del API **no** se toma de `localStorage` para evitar URLs heredadas del portable u otros entornos. En **producción** (`next build` + `next start`) sí se usa la config de instalación guardada cuando aplica.

# PV Quoting — Resumen técnico-funcional del MVP

Documento de referencia interna del proyecto. Describe el estado del sistema al cierre de la etapa MVP para mantener continuidad en futuras iteraciones.

---

## 1. Módulos implementados

| Módulo | Backend (API) | Frontend (Web) | Descripción breve |
|--------|----------------|----------------|-------------------|
| **Autenticación** | ✅ | ✅ | Login JWT, sesión, protección de rutas |
| **Usuarios y roles** | ✅ | ✅ | CRUD usuarios, asignación de roles, activar/desactivar |
| **Clientes** | ✅ | ✅ | Listado, crear, editar, eliminar |
| **Productos** | ✅ | ✅ | Catálogo, CRUD, detalle, proveedores asociados, historial de precios |
| **Proveedores** | ✅ | ✅ | Listado, crear, editar, desactivar |
| **Precios** | ✅ | ✅ | Historial por producto (crear desde detalle de producto); filtrado por rol |
| **Cotizaciones** | ✅ | ✅ | Listado, crear, editar cabecera, versiones, ítems, vista previa, impresión/PDF |
| **Cálculo FV** | ✅ | ✅ | Modal técnico-comercial, guardado por versión, resumen en cotización y en vista previa |

**Catálogo de apoyo (solo lectura en MVP):** categorías, marcas y modelos de producto. Cargados por seed; sin CRUD en UI.

---

## 2. Funcionalidades principales por módulo

### Autenticación
- Login con email y contraseña; emisión de JWT.
- Endpoint `GET /api/auth/me` para rehidratar usuario y roles.
- Persistencia del token en `localStorage` (documentado como temporal para MVP).
- Rutas protegidas en frontend; redirección a `/login` si no hay sesión.
- Página de acceso restringido (`/acceso-restringido`) para rutas sin permiso.

### Usuarios y roles
- Roles: **ADMIN**, **VENTAS**, **INGENIERIA**, **LECTURA**.
- Solo ADMIN accede al módulo de usuarios (listado, crear, editar, activar/desactivar).
- Asignación múltiple de roles por usuario.
- Advertencia al editar el propio usuario antes de desactivarse.

### Clientes
- Listado con búsqueda implícita; columnas: nombre, tipo, email/teléfono, RUT.
- Crear y editar: tipo, nombre, RUT, email, teléfono, dirección, notas.
- Eliminar cliente (solo ADMIN); confirmación antes de borrar.
- Tipos: RESIDENCIAL, COMERCIAL, INDUSTRIAL.

### Productos
- Listado con búsqueda y filtros (categoría, marca, proveedor, origen, estado comercial).
- Crear/editar: código, SKU, categoría, marca, modelo, nombre, descripción, unidad, moneda, estado comercial, proveedor principal, etc.
- Detalle: datos generales, proveedores asociados, historial de precios.
- Gestión de proveedores por producto (principal/alternativo, lead time, MOQ, garantía).
- Historial de precios: solo creación de nuevos registros; sin edición de históricos. Campos sensibles (compra, costos, márgenes) visibles solo para ADMIN.

### Proveedores
- Listado con búsqueda y filtros (origen, tipo de actor, activo/inactivo).
- Crear/editar: datos legales, contacto, país, ciudad, origen (NACIONAL/INTERNACIONAL), tipo de actor (FABRICANTE, DISTRIBUIDOR, etc.), moneda, lead time.
- Desactivar proveedor (solo ADMIN); sin borrado físico.

### Precios
- Alta de precios desde el detalle del producto (proveedor, precio, costos, vigencia, referencia).
- Regla de vigencia: al crear un nuevo precio para el mismo producto+proveedor, el anterior se cierra con `validTo` = día anterior al `validFrom` del nuevo.
- Roles no ADMIN: solo ven precio de venta y datos no sensibles.

### Cotizaciones
- Listado con filtros (estado, cliente, responsable); columnas: título, cliente, tipo de proyecto, versión actual, estado, responsable, fecha, total.
- Crear cotización: cliente, título, tipo de proyecto, moneda, validez, condiciones de pago, plazo de entrega, etapa comercial, notas.
- Editar cabecera (mismos campos).
- **Versiones:** numeradas; crear nueva versión o duplicar la actual; selección por URL (`?versionId=...`).
- **Ítems:** agregar desde producto (con selección de precio vigente), agregar ítem manual, editar cantidad/descuento/precio (override según rol), eliminar ítem.
- Totales calculados en backend: subtotal, descuentos, IVA, total.
- **Vista previa:** ruta dedicada con diseño para impresión; botones Imprimir y Exportar PDF (vía diálogo del navegador).
- Resumen de cálculo FV incluido en vista previa/PDF cuando existe cálculo guardado para la versión mostrada.
- Permisos: lectura para todos los roles con acceso; crear/editar y override de precio para ADMIN y VENTAS.

### Cálculo fotovoltaico (FV)
- Modal desde el detalle de cotización (visible solo si hay versión seleccionada).
- Entradas: consumo mensual o anual, cuenta mensual, valor kWh consumo/inyección, cobertura deseada, tipo de proyecto, potencia por panel, opcionalmente potencia objetivo.
- Prioridad: si hay consumo anual se usa; si no, consumo mensual × 12.
- Backend recalcula al guardar; se persisten supuestos (HSP, performance ratio, versión del método).
- Resultados: planta kWp, cantidad de paneles, generación anual/mensual, ahorro anual/mensual, % ahorro, pago residual.
- Gráficos (Recharts): generación vs consumo, pago actual vs pago con FV.
- Resumen en detalle de cotización (KPIs) y bloque resumen en vista previa/PDF cuando aplica.

---

## 3. Stack tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, Recharts |
| **Backend** | NestJS 10, TypeScript, Prisma 5 |
| **Base de datos** | SQLite (desarrollo); modelo preparado para migración a PostgreSQL |
| **Autenticación** | JWT (passport-jwt), bcrypt para contraseñas |
| **Monorepo** | npm workspaces (`apps/api`, `apps/web`) |

---

## 4. Estructura general del proyecto

```
pv-quoting-platform/
├── package.json              # Scripts raíz: dev, build, lint, prisma:migrate, prisma:generate
├── MVP-RESUMEN.md            # Este documento
├── apps/
│   ├── api/                  # Backend NestJS
│   │   ├── prisma/
│   │   │   ├── schema.prisma # Modelo de datos
│   │   │   ├── dev.db       # SQLite (generado)
│   │   │   └── seed.ts      # Seed: roles, admin, catálogo, clientes, productos, precios
│   │   ├── src/
│   │   │   ├── main.ts      # Bootstrap; prefijo /api; CORS; puerto 4000
│   │   │   ├── app.module.ts
│   │   │   ├── infra/prisma/
│   │   │   └── modules/
│   │   │       ├── auth/         # Login, JWT, GET me
│   │   │       ├── users/        # CRUD usuarios, activar/desactivar, roles
│   │   │       ├── clients/      # CRUD clientes
│   │   │       ├── products/     # CRUD productos, relación proveedores
│   │   │       ├── suppliers/    # CRUD proveedores
│   │   │       ├── prices/       # Historial de precios (crear; filtro por rol)
│   │   │       ├── categories/   # Lectura categorías
│   │   │       ├── brands/       # Lectura marcas
│   │   │       ├── product-models/ # Lectura modelos (por marca)
│   │   │       ├── quotes/       # Cotizaciones, versiones, ítems
│   │   │       └── fv-calculation/ # Cálculo FV (guardar/obtener por quote/versión)
│   │   ├── .env                # DATABASE_URL, JWT_SECRET, etc.
│   │   └── docs/               # Diseños de fases
│   │
│   └── web/                   # Frontend Next.js
│       ├── app/               # App Router
│       │   ├── layout.tsx, page.tsx (dashboard)
│       │   ├── login/, acceso-restringido/
│       │   ├── clientes/, productos/, proveedores/, usuarios/, cotizaciones/
│       │   └── cotizaciones/[id]/ (detalle, editar, vista-previa)
│       ├── components/        # layout (Sidebar, Header, AppLayout), ui (Modal, Badge, etc.)
│       └── lib/               # api.ts (cliente HTTP), auth-context, useCan, format, fv-calculation
└── node_modules/              # Dependencias compartidas y por workspace
```

---

## 5. Estado actual del MVP

- **Fase de cierre MVP** completada: diagnóstico aplicado (dashboard, permisos vista previa, eliminación de `alert`, banners de éxito, helpers de formato, estados vacíos, títulos, validación FV, labels Chile, accesibilidad, botón FV condicional).
- **Build:** `npm run build` en raíz ejecuta build de API y de Web; ambos compilan correctamente.
- **Base de datos:** SQLite en desarrollo; migraciones y seed listos para uso local.
- **Sin funcionalidades rotas conocidas** en el alcance descrito en este documento.

---

## 6. Qué compila y funciona

| Componente | Comando | Estado |
|------------|---------|--------|
| API | `npm --workspace api run build` | ✅ Compila |
| Web | `npm --workspace web run build` | ✅ Compila |
| Build completo | `npm run build` (desde raíz) | ✅ Pasa |
| Desarrollo conjunto | `npm run dev` (api + web en paralelo) | ✅ Disponible |
| Prisma | `npm run prisma:generate`, `npm run prisma:migrate` (desde raíz, ejecutan en api) | ✅ Disponible |
| Seed | `npm --workspace api run prisma:seed` | ✅ Carga datos iniciales |

Flujos validados en desarrollo: login, CRUD de clientes/productos/proveedores/usuarios, listado y detalle de cotizaciones, versiones e ítems, vista previa e impresión/PDF, cálculo FV y resumen en cotización y vista previa.

---

## 7. Mejoras futuras recomendadas

- **Seguridad:** Sustituir persistencia de token en `localStorage` por cookies httpOnly (o mecanismo equivalente) en producción.
- **Catálogo:** CRUD de categorías, marcas y modelos (hoy solo lectura desde seed).
- **Cotizaciones:** Flujo de envío por email; estados de aprobación/rechazo con notificaciones.
- **Cálculo FV:** Factores mensuales de generación o integración con datos de irradiación/ubicación.
- **PDF:** Generación server-side de PDF (p. ej. con librería dedicada) en lugar de depender solo del “Guardar como PDF” del navegador.
- **Tests:** Tests unitarios y de integración en API y E2E en flujos críticos del frontend.
- **Internacionalización:** Soporte multiidioma si se requiere.
- **Auditoría:** Registro de cambios sensibles (precios, permisos, eliminaciones).

---

## 8. Riesgos y deudas técnicas

| Tema | Descripción |
|------|-------------|
| **Token en localStorage** | Documentado como temporal; en producción debe revisarse (cookie, refresh token, etc.). |
| **SQLite en desarrollo** | Adecuado para desarrollo local; para producción se debe usar PostgreSQL (schema y migraciones ya compatibles). |
| **CORS** | Configurado con origen por defecto `http://localhost:3000`; en producción definir `CORS_ORIGIN` según el dominio del frontend. |
| **JWT_SECRET** | En producción debe ser un secreto fuerte y único; no reutilizar el valor de desarrollo. |
| **Validación de entrada** | En API, varios DTOs son clases planas sin `class-validator`; conviene añadir validación explícita en endpoints críticos. |
| **Manejo de errores** | Algunos `catch` en frontend podrían reportar mejor al usuario (p. ej. opciones de filtro en listados). |

---

## 9. Pasos para levantar el sistema localmente

1. **Requisitos:** Node.js (v18+ recomendado), npm.

2. **Clonar / abrir el proyecto** y en la raíz del monorepo:

   ```bash
   npm install
   ```

3. **Configurar la API** (en `apps/api`):
   - Crear o editar `apps/api/.env` con al menos:
     ```env
     DATABASE_URL="file:./dev.db"
     JWT_SECRET="clave-secreta-mvp-cambiar-en-produccion"
     ```
   - Opcional: `PORT=4000`, `CORS_ORIGIN=http://localhost:3000`, `JWT_EXPIRES_IN=7d`.

4. **Base de datos y datos iniciales:**
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   npm --workspace api run prisma:seed
   ```
   (Desde raíz, `prisma:generate` y `prisma:migrate` pueden ejecutarse vía scripts que apunten al workspace `api`; el seed se ejecuta en `api`.)

5. **Levantar API y frontend:**
   ```bash
   npm run dev
   ```
   - API: http://localhost:4000 (prefijo `/api`).
   - Web: http://localhost:3000.

6. **Acceso inicial:** En el navegador ir a http://localhost:3000, redirigirá a login. Usar las credenciales del seed (ver sección 10).

---

## 10. Credenciales y datos semilla de prueba

### Usuario administrador (creado por seed)

| Campo | Valor |
|-------|--------|
| **Email** | `admin@pvquoting.local` |
| **Contraseña** | `admin123` |
| **Rol** | ADMIN |

Solo se crea si no existe ningún usuario en la base de datos. Con este usuario se puede acceder a todos los módulos, incluido Usuarios y todas las acciones de productos, proveedores y cotizaciones.

### Roles disponibles (seed)

- **ADMIN:** Acceso total; gestión de usuarios y configuración.
- **VENTAS:** Clientes, cotizaciones; ver productos y precios de venta.
- **INGENIERIA:** Lectura técnica; apoyo en cálculo FV y cotizaciones.
- **LECTURA:** Solo visualización.

### Otros datos semilla

- **Clientes:** 3 (residencial, comercial, industrial) con datos de ejemplo en Chile.
- **Categorías:** 18 (paneles, inversores, baterías, estructuras, mano de obra, ingeniería, etc.).
- **Marcas y modelos:** Varias marcas fotovoltaicas y modelos asociados.
- **Proveedores:** Al menos 6 (nacionales e internacionales) con distintos tipos de actor.
- **Productos:** Paneles, inversores, baterías, estructuras, ítems de servicios; con relaciones producto-proveedor y precios de ejemplo.
- **Precios:** Registros con vigencia, incluyendo casos nacional/internacional y cierre automático de vigencia anterior.

Para restablecer datos desde cero (en desarrollo): eliminar o renombrar `apps/api/prisma/dev.db`, volver a ejecutar `prisma:migrate` y `prisma:seed`.

---

*Última actualización: cierre de etapa MVP. Documento para uso interno del proyecto.*

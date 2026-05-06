# Fase 2C — Plan frontend: productos, proveedores y precios

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/productos` | Listado: tabla, búsqueda, filtros (categoría, marca, modelo, proveedor, supplyOrigin, commercialStatus). Columnas: código, SKU, nombre, categoría, marca, modelo, proveedor principal, origen, moneda, estado. Acciones: Ver, Crear, Editar. |
| `/productos/nuevo` | Formulario crear producto (todos los campos del modelo). |
| `/productos/[id]` | Detalle: secciones (datos generales, clasificación, proveedor principal, proveedores asociados, historial de precios). Indicadores nacional/internacional, principal/alternativos. |
| `/productos/[id]/editar` | Formulario editar producto. |
| `/proveedores` | Listado: búsqueda, filtros (supplyOrigin, actorType, active). Columnas: nombre, país, ciudad, origen, tipo actor, moneda, lead time, estado. Ver, Crear, Editar, Desactivar. |
| `/proveedores/nuevo` | Formulario crear proveedor. |
| `/proveedores/[id]/editar` | Formulario editar proveedor. |

## Componentes

- **Badge** — Estado comercial, supplyOrigin, actorType (colores por tipo).
- **ProductosList** — Tabla + barra de filtros y búsqueda (client component).
- **ProveedoresList** — Tabla + filtros (client component).
- **ProductForm** — Form crear/editar producto (categoría, marca, modelo, proveedor principal, validaciones).
- **SupplierForm** — Form crear/editar proveedor.
- **ProductDetail** — Vista detalle con cards: datos generales, clasificación, proveedor principal, sección proveedores asociados, sección historial de precios.
- **ProductSuppliersSection** — Lista de proveedores del producto, agregar, marcar principal/alternativo, lead time/MOQ/warranty/notes. Llamadas a API product-suppliers.
- **ProductPricesSection** — Tabla de precios del producto, botón agregar nuevo precio (modal o página), sin edición de registros existentes.

## API (lib/api.ts)

- Tipos: Category, Brand, ProductModel, Supplier, Product (con relations), ProductSupplier (con supplier), ProductPrice.
- Funciones: fetchCategories, fetchBrands, fetchProductModels(brandId?), fetchSuppliers(filters), fetchSupplier(id), createSupplier, updateSupplier, deactivateSupplier; fetchProducts(filters), fetchProduct(id, includeLatestPrice?), createProduct, updateProduct; fetchProductSuppliers(productId), addProductSupplier(productId, dto), updateProductSupplier(productId, supplierId, dto), removeProductSupplier(productId, supplierId); fetchProductPrices(productId), createPrice(dto).

## Cómo probar cada pantalla

1. **Productos listado:** Ir a /productos. Ver tabla con datos del seed. Probar búsqueda, filtros por categoría, marca, supplyOrigin, estado. Clic en Ver, Crear, Editar.
2. **Proveedores listado:** Ir a /proveedores. Ver tabla. Filtros por origen, tipo de actor, activo. Crear, editar, desactivar.
3. **Form proveedor:** /proveedores/nuevo y /proveedores/[id]/editar. Validar campos obligatorios, supplyOrigin y actorType.
4. **Form producto:** /productos/nuevo y /productos/[id]/editar. Cargar categorías y marcas; al elegir marca cargar modelos. Validar categoría obligatoria, modelo coherente con marca.
5. **Detalle producto:** /productos/[id]. Ver todas las secciones; en proveedores asociados agregar/alternar principal; en precios agregar nuevo (sin editar históricos).

## Archivos creados o modificados (Fase 2C)

- **lib/api.ts** — Extendido con tipos y funciones: Category, Brand, ProductModel, Supplier, Product, ProductSupplier, ProductPrice; fetchCategories, fetchBrands, fetchProductModels, fetchSuppliers, fetchSupplier, createSupplier, updateSupplier, deactivateSupplier; fetchProducts, fetchProduct, createProduct, updateProduct; fetchProductSuppliers, addProductSupplier, updateProductSupplier, removeProductSupplier; fetchProductPrices, createPrice.
- **components/layout/Sidebar.tsx** — Añadidos enlaces Productos y Proveedores.
- **components/layout/AppLayout.tsx** — Títulos para /productos, /productos/nuevo, /productos/[id], /productos/[id]/editar, /proveedores, /proveedores/nuevo, /proveedores/[id]/editar.
- **components/ui/Badge.tsx** — Nuevo: Badge, CommercialStatusBadge, SupplyOriginBadge, ActorTypeBadge.
- **app/page.tsx** — Tarjetas de Productos y Proveedores habilitadas (enlaces al listado).
- **app/productos/page.tsx** — Página listado productos.
- **app/productos/ProductosList.tsx** — Tabla + búsqueda + filtros (categoría, marca, proveedor, supplyOrigin, commercialStatus).
- **app/productos/nuevo/page.tsx** — Crear producto.
- **app/productos/[id]/page.tsx** — Detalle producto (delega a ProductDetail).
- **app/productos/[id]/editar/page.tsx** — Editar producto.
- **app/productos/ProductForm.tsx** — Formulario crear/editar producto (validación categoría, marca/modelo).
- **app/productos/ProductDetail.tsx** — Vista detalle con cards: datos generales, clasificación, proveedor principal, opciones nacional/internacional, ProductSuppliersSection, ProductPricesSection.
- **app/productos/ProductSuppliersSection.tsx** — Lista proveedores asociados, agregar, marcar principal, quitar (lead time, MOQ, garantía, notas).
- **app/productos/ProductPricesSection.tsx** — Tabla historial de precios, botón agregar nuevo precio (formulario inline con proveedor opcional), sin edición de registros existentes.
- **app/proveedores/page.tsx** — Página listado proveedores.
- **app/proveedores/ProveedoresList.tsx** — Tabla + búsqueda + filtros (supplyOrigin, actorType, active).
- **app/proveedores/nuevo/page.tsx** — Crear proveedor.
- **app/proveedores/[id]/editar/page.tsx** — Editar proveedor + botón Desactivar.
- **app/proveedores/SupplierForm.tsx** — Formulario crear/editar proveedor (todos los campos del modelo).
- **docs/FASE2C-FRONTEND-PLAN.md** — Este plan.

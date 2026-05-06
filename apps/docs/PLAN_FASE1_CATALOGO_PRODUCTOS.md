# Plan técnico Fase 1 — Catálogo/productos (campos comunes + ProductPanelSpecs)

## Objetivo
Aclarar el modelo productocéntrico, añadir campos técnicos comunes en `Product`, crear la tabla `ProductPanelSpecs`, migrar sin romper cotizaciones, plantillas, adicionales ni validaciones.

---

## 1. Cambios concretos en `schema.prisma`

### 1.1 Comentarios de aclaración (modelo productocéntrico)

**ProductCategory (línea ~188):** Añadir encima del modelo:
```prisma
// Categoría: tipo de producto (paneles, inversores, baterías, etc.). Independiente de proveedor.
```

**Brand (línea ~204):** Añadir:
```prisma
// Marca: catálogo maestro. Independiente del proveedor. Un proveedor puede vender varias marcas.
```

**ProductModel (línea ~214):** Añadir:
```prisma
// Modelo: pertenece a una Brand. Identificador técnico/comercial (ej. "X1-Smart", "600-620W").
```

**Product (línea ~229):** Sustituir/añadir al bloque de comentarios existente:
```prisma
// Producto: entidad central del catálogo. Es la oferta técnica/comercial (marca + modelo + categoría + especificaciones).
// primarySupplierId = proveedor por defecto para compra; el mismo producto puede estar en varios proveedores (ProductSupplier).
```

**ProductSupplier (línea ~278):** Añadir:
```prisma
// Relación N:M: "este producto está disponible en este proveedor". Precio por combinación en ProductPrice.
```

### 1.2 Campos nuevos en `Product` (todos opcionales)

Añadir **después** de `isBatteryComponent` (aprox. línea 255), **antes** de `categoryId`:

```prisma
  // --- Campos técnicos comunes (Fase 1 catálogo). Opcionales para compatibilidad. ---
  technicalType     String?   // Ej. MONOCRISTALINO, BIFACIAL, ON_GRID, STRING, MICROINVERSOR
  powerW            Int?      // Potencia en W (paneles, inversores)
  maxCurrentA      Float?    // Corriente máxima en A (inversores, protecciones)
  efficiencyPercent Float?   // Eficiencia % (paneles, inversores)
```

**Tipos:** `technicalType` y `powerW` ya existen como tipos en Prisma; `maxCurrentA` y `efficiencyPercent` como `Float?` (en SQLite serán REAL).

### 1.3 Nueva tabla `ProductPanelSpecs`

Añadir **después** del modelo `Product` y **antes** de `ProductSupplier` (para que la relación quede junto a Product).

```prisma
// Especificaciones técnicas por categoría: paneles. 1:1 opcional (solo productos de categoría paneles).
model ProductPanelSpecs {
  id                 String   @id @default(cuid())

  productId          String   @unique
  product            Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  powerW             Int?
  efficiencyPercent  Float?
  vmpV               Float?   // Tensión en punto de máxima potencia
  impA               Float?   // Corriente en punto de máxima potencia
  vocV               Float?   // Tensión en circuito abierto
  iscA               Float?   // Corriente en cortocircuito
  bifacialityPercent Float?
  cellType           String?  // Ej. MONOCRISTALINO, POLICRISTALINO
  lengthMm           Int?
  widthMm            Int?
  heightMm           Int?
  weightKg           Float?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

En el modelo **Product**, añadir la relación inversa (junto al resto de relaciones, ej. después de `quoteTemplateLines`):

```prisma
  panelSpecs         ProductPanelSpecs?
```

---

## 2. Nombres exactos de campos y tipos

| Ubicación | Campo | Tipo Prisma | Notas |
|-----------|--------|-------------|--------|
| Product | technicalType | String? | Texto libre o valores controlados por UI |
| Product | powerW | Int? | Potencia en vatios |
| Product | maxCurrentA | Float? | Corriente en amperes |
| Product | efficiencyPercent | Float? | Porcentaje 0–100 |
| ProductPanelSpecs | productId | String | FK, @unique |
| ProductPanelSpecs | powerW | Int? | |
| ProductPanelSpecs | efficiencyPercent | Float? | |
| ProductPanelSpecs | vmpV | Float? | |
| ProductPanelSpecs | impA | Float? | |
| ProductPanelSpecs | vocV | Float? | |
| ProductPanelSpecs | iscA | Float? | |
| ProductPanelSpecs | bifacialityPercent | Float? | |
| ProductPanelSpecs | cellType | String? | |
| ProductPanelSpecs | lengthMm | Int? | |
| ProductPanelSpecs | widthMm | Int? | |
| ProductPanelSpecs | heightMm | Int? | |
| ProductPanelSpecs | weightKg | Float? | |

---

## 3. Relaciones exactas

- **Product** 1 — 0..1 **ProductPanelSpecs**: `Product.panelSpecs` (opcional), `ProductPanelSpecs.product` (obligatorio). FK `ProductPanelSpecs.productId` → `Product.id`, `onDelete: Cascade` (si se borra el producto, se borran sus specs).
- No se tocan: Product → Category, Brand, Model, Supplier (primarySupplier), ProductSupplier, ProductPrice, QuoteItem, QuoteItemLine, QuoteTemplateLine.

---

## 4. Endpoints y cambios mínimos de API

### 4.1 GET /api/products/:id (lectura)

- **Cambio:** en `ProductsService.findOne()`, añadir en el `include`:
  ```ts
  panelSpecs: true
  ```
- **Resultado:** la respuesta incluye `panelSpecs: ProductPanelSpecs | null`. Los productos ya devuelven todos los campos de Product (incluidos los 4 nuevos); al incluir `panelSpecs`, el cliente recibe también las specs de panel si existen.

### 4.2 GET /api/products (listado)

- **Opción recomendada:** no incluir `panelSpecs` en el listado (evitar payload grande). Si más adelante se necesita en listado, se puede añadir un query `?includePanelSpecs=true`.
- **Fase 1:** sin cambios en el listado.

### 4.3 POST /api/products (crear)

- **DTO:** en `CreateProductDto`, añadir opcionales:
  - `technicalType?: string`
  - `powerW?: number`
  - `maxCurrentA?: number`
  - `efficiencyPercent?: number`
  - `panelSpecs?: { powerW?, efficiencyPercent?, vmpV?, impA?, vocV?, iscA?, bifacialityPercent?, cellType?, lengthMm?, widthMm?, heightMm?, weightKg? }`
- **Servicio:** en `ProductsService.create()`:
  - Mapear los 4 campos comunes al `data` del `prisma.product.create`.
  - Si `dto.panelSpecs` viene definido (objeto presente, no necesariamente con datos), después del `product.create` hacer `prisma.productPanelSpecs.create({ data: { productId: product.id, ...dto.panelSpecs } })` solo con los campos no undefined. Si `panelSpecs` es undefined o null, no crear fila.

### 4.4 PATCH /api/products/:id (actualizar)

- **DTO:** en `UpdateProductDto`, añadir opcionales:
  - `technicalType?: string | null`
  - `powerW?: number | null`
  - `maxCurrentA?: number | null`
  - `efficiencyPercent?: number | null`
  - `panelSpecs?: { ... } | null`
- **Servicio:** en `ProductsService.update()`:
  - Añadir al `data` del `prisma.product.update` los 4 campos cuando vengan en el DTO (respeta `null` para “borrar” valor).
  - Si `dto.panelSpecs !== undefined`: si es `null`, eliminar fila de `ProductPanelSpecs` para ese productId si existe (`deleteMany`). Si es objeto, hacer upsert: `upsert({ where: { productId: id }, create: { productId: id, ...panelSpecs }, update: { ...panelSpecs } })`, pasando solo propiedades definidas en el objeto.

No se añaden rutas nuevas; solo se amplían DTOs y lógica de create/update/findOne.

---

## 5. Cómo migrar sin romper nada

1. **Migración Prisma (solo DDL):**
   - Ejecutar `npx prisma migrate dev --name add_product_tech_fields_and_panel_specs`.
   - La migración: añade 4 columnas a `Product` (nullable) y crea la tabla `ProductPanelSpecs` con FK a `Product`. No se modifican ni eliminan columnas existentes.
2. **Datos existentes:** no requieren backfill. Los 4 campos nuevos en Product quedan en NULL; no hay filas en ProductPanelSpecs hasta que se editen productos.
3. **Compatibilidad:**
   - Cotizaciones: siguen usando `productId`, snapshots, etc. No referencian `ProductPanelSpecs` ni los nuevos campos; no hay cambios en QuoteItem/QuoteItemLine.
   - Plantillas: igual; QuoteTemplateLine.productId y snapshots sin cambios.
   - Adicionales: sin cambios.
   - Validaciones técnicas: siguen leyendo solo `Product` (connectionType, nominalVoltageV, inverterType, isBatteryComponent). No es obligatorio que en Fase 1 lean `powerW` ni `panelSpecs`; se puede hacer en una fase posterior.
4. **Backend:** tras la migración, regenerar cliente Prisma (`npx prisma generate`) y desplegar; los servicios que no toquen los nuevos campos siguen igual.
5. **Frontend:** puede seguir usando GET /products/:id y PATCH sin enviar los nuevos campos; la API los ignora si no se envían y devuelve null/objeto vacío. Cuando el frontend quiera mostrar/editar ficha técnica, enviará y recibirá `panelSpecs` y los 4 campos.

---

## 6. Cómo probar Fase 1

1. **Migración:**
   - `cd apps/api && npx prisma migrate dev --name add_product_tech_fields_and_panel_specs`
   - Comprobar que no hay errores y que la tabla `ProductPanelSpecs` existe y `Product` tiene las 4 columnas nuevas.
2. **GET /api/products/:id:**
   - Llamar con un producto existente (ej. un panel). Respuesta debe incluir `panelSpecs: null` y los campos `technicalType`, `powerW`, `maxCurrentA`, `efficiencyPercent` en null o con valor si ya se guardaron.
3. **PATCH /api/products/:id:**
   - Enviar solo `{ "technicalType": "MONOCRISTALINO", "powerW": 600 }`. Verificar que el producto se actualiza y que en GET vuelven esos valores.
   - Enviar `{ "panelSpecs": { "powerW": 620, "efficiencyPercent": 22.5, "vocV": 41.2 } }`. Verificar que se crea una fila en ProductPanelSpecs y GET devuelve `panelSpecs` con esos datos.
   - Enviar `{ "panelSpecs": null }`. Verificar que se elimina la fila de panelSpecs y GET devuelve `panelSpecs: null`.
4. **POST /api/products:**
   - Crear un producto con categoría paneles y body que incluya `technicalType`, `powerW` y `panelSpecs`. Verificar que se crea producto y, si se envió panelSpecs, una fila en ProductPanelSpecs.
5. **Regresión:**
   - Crear/editar cotización con ítem desde catálogo; vista previa/PDF sin cambios.
   - Crear cotización desde plantilla; no debe fallar.
   - Ejecutar validaciones técnicas en una cotización con productos; deben seguir devolviendo las mismas reglas (sin usar aún powerW ni panelSpecs).

---

## Resumen de archivos a tocar (Fase 1)

| Archivo | Acción |
|--------|--------|
| `api/prisma/schema.prisma` | Comentarios productocéntricos; 4 campos en Product; modelo ProductPanelSpecs; relación en Product |
| `api/prisma/migrations/XXXX_add_product_tech_fields_and_panel_specs/migration.sql` | Generado por Prisma |
| `api/src/modules/products/dto/create-product.dto.ts` | Añadir technicalType, powerW, maxCurrentA, efficiencyPercent, panelSpecs? |
| `api/src/modules/products/dto/update-product.dto.ts` | Añadir los mismos como opcionales o null |
| `api/src/modules/products/products.service.ts` | create: mapear 4 campos y opcionalmente crear panelSpecs; update: mapear 4 campos y upsert/delete panelSpecs; findOne: include panelSpecs |

No se modifican: controller (misma ruta y body), quote/plantilla/adicionales/validaciones (salvo que se quiera usar en el futuro los nuevos campos en validaciones).

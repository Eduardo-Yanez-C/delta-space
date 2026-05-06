# Plan técnico Fase 2 — Specs de inversores y baterías + UI de ficha técnica

## Objetivo
Extender el catálogo técnico con ProductInverterSpecs y ProductBatterySpecs, y ofrecer en frontend la visualización y edición de la ficha técnica según categoría del producto, sin romper cotizaciones, plantillas, adicionales ni validaciones actuales.

---

## 1. Nuevos modelos y relación 1:1 con Product

### 1.1 ProductInverterSpecs

Relación: **Product 1 — 0..1 ProductInverterSpecs**. Misma pauta que ProductPanelSpecs: `productId` @unique, FK a Product, `onDelete: Cascade`.

**Campos recomendados (todos opcionales):**

| Campo | Tipo Prisma | Uso |
|-------|-------------|-----|
| productId | String | FK @unique |
| inverterType | String? | ON_GRID \| HYBRID \| OFF_GRID (alineado con Product.inverterType) |
| powerAcW | Int? | Potencia AC salida (W) |
| maxPvVoltageV | Float? | Tensión máxima entrada PV (V) |
| startupVoltageV | Float? | Tensión de arranque MPPT (V) |
| mpptVoltageMinV | Float? | Rango MPPT mínimo (V) |
| mpptVoltageMaxV | Float? | Rango MPPT máximo (V) |
| maxDcCurrentA | Float? | Corriente DC máxima (A) |
| efficiencyPercent | Float? | Eficiencia máxima (%) |
| connectionType | String? | MONOFASICO \| TRIFASICO (alineado con Product.connectionType) |
| ipRating | String? | Grado de protección (ej. IP65) |
| communication | String? | Comunicación (ej. RS485, WiFi, Ethernet) |

**Ubicación en schema:** después de ProductPanelSpecs, antes de ProductSupplier. En **Product** añadir relación: `inverterSpecs ProductInverterSpecs?`.

### 1.2 ProductBatterySpecs

Relación: **Product 1 — 0..1 ProductBatterySpecs**. `productId` @unique, FK a Product, `onDelete: Cascade`.

**Campos recomendados (todos opcionales):**

| Campo | Tipo Prisma | Uso |
|-------|-------------|-----|
| productId | String | FK @unique |
| capacityKwh | Float? | Capacidad útil (kWh) |
| nominalVoltageV | Float? | Tensión nominal (V) |
| maxChargeDischargePowerW | Float? | Potencia máxima carga/descarga (W) |
| chemistry | String? | Química (ej. NMC, LFP) |
| cycles | Int? | Ciclos garantizados |
| weightKg | Float? | Peso (kg) |
| dimensionsMm | String? | Dimensiones (ej. "600x400x200") o JSON en fase posterior |

**Ubicación en schema:** después de ProductInverterSpecs. En **Product** añadir: `batterySpecs ProductBatterySpecs?`.

---

## 2. Relaciones exactas

- **Product**  
  - `panelSpecs ProductPanelSpecs?` (ya existe)  
  - `inverterSpecs ProductInverterSpecs?` (nuevo)  
  - `batterySpecs ProductBatterySpecs?` (nuevo)  

- **ProductInverterSpecs**  
  - `productId String @unique`  
  - `product Product @relation(..., onDelete: Cascade)`  

- **ProductBatterySpecs**  
  - `productId String @unique`  
  - `product Product @relation(..., onDelete: Cascade)`  

No se tocan QuoteItem, QuoteItemLine, QuoteTemplateLine ni ProductPrice. Las specs son solo lectura para cotizaciones (snapshots ya existentes); no se guardan en ítem/línea.

---

## 3. API: extender GET / POST / PATCH sin endpoints nuevos

Criterio: **un producto tiene como máximo una de las tres tablas de specs** (panel, inversor o batería) según su categoría. La API sigue siendo productocéntrica: mismo recurso `/products` con body que puede incluir una sola de `panelSpecs`, `inverterSpecs` o `batterySpecs`.

### 3.1 GET /api/products/:id

- En **ProductsService.findOne()**, ampliar el `include` con:
  - `inverterSpecs: true`
  - `batterySpecs: true`
- La respuesta incluye `panelSpecs`, `inverterSpecs` y `batterySpecs` (cada uno objeto o `null`). El cliente decide qué mostrar según `product.category.slug`.

### 3.2 POST /api/products

- **CreateProductDto:** añadir opcionales:
  - `inverterSpecs?: CreateProductInverterSpecsDto`
  - `batterySpecs?: CreateProductBatterySpecsDto`
- Tipos: mismos campos que los modelos, todos opcionales (sin `productId` en el DTO; se asigna en backend).
- **ProductsService.create():**
  - Tras crear el producto y (si aplica) `panelSpecs`, si `dto.inverterSpecs` es objeto con al menos un valor → `productInverterSpecs.create({ productId: product.id, ... })`.
  - Si `dto.batterySpecs` es objeto con al menos un valor → `productBatterySpecs.create({ productId: product.id, ... })`.
- No validar en Fase 2 que la categoría “corresponda” a la spec enviada (un producto de categoría “baterías” podría tener por error `inverterSpecs`; se puede restringir en una fase posterior). Prioridad: no romper y mantener un solo endpoint.

### 3.3 PATCH /api/products/:id

- **UpdateProductDto:** añadir opcionales:
  - `inverterSpecs?: UpdateProductInverterSpecsDto | null`
  - `batterySpecs?: UpdateProductBatterySpecsDto | null`
- **ProductsService.update():**
  - Si `dto.inverterSpecs === null` → `productInverterSpecs.deleteMany({ where: { productId: id } })`.
  - Si `dto.inverterSpecs` es objeto → `productInverterSpecs.upsert({ where: { productId: id }, create: { productId: id, ... }, update: { ... } })`.
  - Igual para `batterySpecs` (null → delete; objeto → upsert).
- Misma convención que Fase 1: solo se envían en el body las propiedades que se quieren cambiar; `null` en un campo de la spec significa “borrar valor”.

No se crean rutas nuevas (p. ej. `/products/:id/inverter-specs`). Justificación: mantener un solo recurso “producto” y evitar que el frontend tenga que hacer varias peticiones para cargar/guardar producto + specs; las validaciones por categoría se pueden hacer en frontend y, si se desea, en backend en una fase posterior.

---

## 4. Frontend: mostrar y editar ficha técnica según categoría

### 4.1 Criterio de categoría

- **Paneles:** `category.slug` en lista definida, p. ej. `["paneles-fotovoltaicos"]` (o cualquier slug que se asigne a paneles).
- **Inversores:** `category.slug` en `["inversores-on-grid", "inversores-hibridos", "inversores-off-grid"]`.
- **Baterías:** `category.slug === "baterias"`.

Se puede definir en frontend una utilidad, p. ej. `getSpecKind(categorySlug): 'panel' | 'inverter' | 'battery' | null`.

### 4.2 Detalle de producto (vista)

- **ProductDetail** ya recibe `product` con `category`, y en Fase 2 con `panelSpecs`, `inverterSpecs`, `batterySpecs`.
- Añadir una sección **“Ficha técnica”** (card o bloque) debajo de “Datos generales” (o junto a ellos):
  - Si hay enlace `product.technicalSheetUrl`, mostrarlo como ya se hace (ej. “Abrir enlace”).
  - Según `getSpecKind(product.category?.slug)`:
    - **panel:** si `product.panelSpecs` existe, mostrar campos (potencia, eficiencia, Vmp, Imp, Voc, Isc, bifacialidad, tipo célula, dimensiones, peso) en una lista de pares etiqueta/valor; si no hay specs, mensaje tipo “Sin datos de ficha técnica” y CTA “Editar producto” si tiene permiso.
    - **inverter:** igual con `product.inverterSpecs` (tipo, potencia AC, tensiones PV, MPPT, corriente, eficiencia, monofásico/trifásico, IP, comunicación).
    - **battery:** igual con `product.batterySpecs` (capacidad, tensión, potencia, química, ciclos, peso, dimensiones).
  - Si la categoría no es panel/inversor/batería, no mostrar bloque de specs o mostrar solo el enlace a ficha técnica si existe.

### 4.3 Edición de producto (formulario)

- **ProductForm** (o la página de edición) hoy ya envía todo el producto con PATCH. En Fase 2:
  - Incluir en el estado del formulario los objetos opcionales `panelSpecs`, `inverterSpecs`, `batterySpecs` (según lo que devuelva GET).
  - Según la categoría seleccionada (o la actual si no se puede cambiar), mostrar **un solo bloque de campos de ficha**:
    - Si categoría = paneles → formulario de panelSpecs (mismos campos que Fase 1).
    - Si categoría = inversores → formulario de inverterSpecs.
    - Si categoría = baterías → formulario de batterySpecs.
  - Al enviar PATCH, enviar solo la spec que corresponde a la categoría actual (las otras no se envían o se envían como null si el usuario “borró” la ficha). No es necesario enviar las tres en cada guardado.
  - Mantener `technicalSheetUrl` como hasta ahora (enlace externo a PDF/ficha).

No hace falta un “wizard” ni pantallas separadas: un solo formulario de producto con una sección condicional “Ficha técnica” según categoría.

---

## 5. Compatibilidad con cotizaciones, plantillas, adicionales y validaciones

- **Cotizaciones (QuoteItem, QuoteItemLine):** Siguen usando solo `productId` y snapshots (nombre, descripción, precios, etc.). No se guardan `panelSpecs` ni `inverterSpecs` ni `batterySpecs` en ítem/línea. Compatibilidad: total; no se tocan modelos ni flujos.
- **Plantillas (QuoteTemplateLine):** Siguen con `productId` y snapshots. No referencian specs. Sin cambios.
- **Adicionales:** Reglas y sugerencias siguen operando sobre producto e ítems/líneas actuales. Sin cambios.
- **Validaciones técnicas actuales:** Siguen leyendo solo `Product` (connectionType, nominalVoltageV, inverterType, isBatteryComponent). No leen aún ProductPanelSpecs, ProductInverterSpecs ni ProductBatterySpecs. En Fase 2 no es obligatorio cambiar el motor de validaciones; solo dejar preparado el modelo y la API para que en una fase posterior el servicio pueda:
  - Incluir en el `include` de la versión `product.panelSpecs`, `product.inverterSpecs`, `product.batterySpecs`.
  - Opcionalmente, usar campos de esas tablas (p. ej. inverterSpecs.mpptVoltageMinV/MaxV, inverterSpecs.connectionType) para reglas más finas, manteniendo Product como fallback cuando la spec no exista.

---

## 6. Preparación para uso en validaciones técnicas (fase posterior)

- **Datos:** Con ProductInverterSpecs y ProductBatterySpecs, el servicio de validaciones puede:
  - Cargar producto con `include: { panelSpecs: true, inverterSpecs: true, batterySpecs: true }`.
  - Para reglas que hoy usan `Product.connectionType` o `Product.inverterType`, seguir usando Product y, si existe, dar prioridad a `inverterSpecs.connectionType` / `inverterSpecs.inverterType` cuando el producto sea inversor.
  - Introducir reglas nuevas que usen solo specs (p. ej. rango MPPT vs tensión de string de paneles) cuando estén disponibles.
- **Contrato:** No cambiar en Fase 2 la firma ni los códigos de alerta del endpoint de validaciones; solo asegurar que el modelo y la API de productos exponen las specs para que una futura iteración las consuma.

---

## 7. Orden de implementación sugerido

1. **Schema y migración**  
   Añadir ProductInverterSpecs y ProductBatterySpecs en Prisma, relaciones en Product, migración con nombre tipo `add_inverter_and_battery_specs`.

2. **Backend: DTOs y servicio**  
   Crear tipos Create/Update para inverterSpecs y batterySpecs; extender CreateProductDto y UpdateProductDto; en create/update de ProductsService, manejar create/upsert/delete de inverterSpecs y batterySpecs; en findOne, incluir `inverterSpecs: true` y `batterySpecs: true`.

3. **Frontend: tipos y detalle**  
   Actualizar tipo `Product` en api.ts con `inverterSpecs` y `batterySpecs`; en ProductDetail, añadir sección “Ficha técnica” y renderizado condicional por categoría (panel / inversor / batería).

4. **Frontend: formulario de edición**  
   En ProductForm (o página de edición), añadir estado y campos para la spec que corresponda a la categoría; al guardar, enviar en el PATCH la spec correspondiente (objeto o null).

5. **Pruebas y regresión**  
   Verificar GET/POST/PATCH con y sin specs; que cotizaciones, plantillas y validaciones sigan igual; que la UI no se rompa cuando no hay specs.

---

## 8. Resumen

| Tema | Decisión |
|------|----------|
| Modelos | ProductInverterSpecs y ProductBatterySpecs, 1:1 opcional con Product, onDelete Cascade. |
| Campos inversor | inverterType, powerAcW, maxPvVoltageV, startupVoltageV, mpptVoltageMinV/MaxV, maxDcCurrentA, efficiencyPercent, connectionType, ipRating, communication. |
| Campos batería | capacityKwh, nominalVoltageV, maxChargeDischargePowerW, chemistry, cycles, weightKg, dimensionsMm. |
| API | Sin endpoints nuevos; GET incluye inverterSpecs y batterySpecs; POST/PATCH aceptan inverterSpecs y batterySpecs (objeto o null) con la misma convención que panelSpecs. |
| UI detalle | Sección “Ficha técnica” según categoría (panel / inversor / batería); solo lectura. |
| UI edición | Un bloque de campos de ficha según categoría; envío en el mismo PATCH del producto. |
| Compatibilidad | Cotizaciones, plantillas y adicionales sin cambios; validaciones actuales sin cambios; modelo y API listos para que validaciones futuras consuman specs. |

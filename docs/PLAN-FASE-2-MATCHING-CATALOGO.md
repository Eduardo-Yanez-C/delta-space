# Plan de implementación Fase 2: Matching con catálogo (cotización desde estudio)

Implementar matching para paneles, inversor y estructura con los ajustes aprobados: categoría robusta, tolerancia en paneles, peso real de connectionType en inversores, fallback manual en estructuras sin match claro, y señal visual prevista para “Desde catálogo” vs “Manual”.

---

## Ajustes incorporados

1. **Categoría no dependiente solo del slug:** Estrategia de resolución que intente slug exacto y, si falla o se quiere robustez, alternativas (nombre de categoría, slugs alternativos).
2. **Paneles:** Tolerancia de potencia definida; si no hay candidato dentro del rango, fallback manual (no “el más cercano” sin control).
3. **Inversores:** `connectionType` con peso real: priorizar mono/trifásico según estudio; solo si no hay match, flexibilizar.
4. **Estructuras:** Sin coincidencia clara por tipo de montaje → fallback manual (no match dudoso).
5. **Señal visual:** Dejar prevista (y si es posible implementar en Fase 2) la distinción ítem “Desde catálogo” vs “Manual”.

---

## 1. Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| **`apps/api/src/modules/fv-study/suggested-items-matching.ts`** | Nuevo módulo (o archivo de helpers): resolución de categoría robusta, extracción de Wp/kW, detección mono/trifásico y montaje, reglas de tolerancia y filtrado. Salida: candidatos o null para cada tipo. |
| **`apps/api/src/modules/fv-study/suggested-items-price.ts`** | Helper o función en el mismo archivo anterior: dado un `productId` y `tx`, obtener precio vigente (validFrom/validTo). Devuelve `{ priceId, unitPrice, currency } \| null`. |
| **`apps/api/src/modules/fv-study/fv-study.service.ts`** | En la rama `createWithSuggestedItems`: para ítems 1 (paneles), 2 (inversor), 3 (estructura) llamar al matching; si hay resultado con precio, crear QuoteItem desde producto; si no, crear ítem manual (fallback). Ítems 4 y 5 sin cambios (siempre manual). Mantener una sola transacción. |
| **`apps/web/app/cotizaciones/[id]/CotizacionDetalleView.tsx`** | (O en el componente que muestra la tabla de ítems.) Señal visual: por cada ítem, si `item.productId != null` mostrar badge o texto “Desde catálogo”; si no, “Manual” o no mostrar. Dejar constantes/estructura preparada para futuras mejoras. |
| **`apps/web/app/cotizaciones/constants.ts`** o equivalente | Opcional: constante o tipo para etiquetas “Desde catálogo” / “Manual” reutilizable. |

No se tocan: schema Prisma, controlador (sigue igual), endpoint (mismo body/query). Opcional: si el listado de ítems está en un subcomponente, tocar ese subcomponente para el badge.

---

## 2. Helpers o servicios de matching

### 2.1 Ubicación y dependencias

- **Archivo:** `apps/api/src/modules/fv-study/suggested-items-matching.ts` (nuevo).
- **Dependencias:** Solo Prisma (cliente de transacción `tx` pasado desde `FvStudyService`). No inyectar `FvStudyService` para evitar ciclos; las funciones reciben `tx`, `study` y devuelven `{ productId, product, ... } | null` o el producto elegido + datos para crear ítem.

### 2.2 Resolución de categoría (robusta)

- **Función:** `resolveCategoryId(tx, kind: 'panels' | 'inverter' | 'structure') => Promise<number | null>`.
- **Estrategia:**
  1. Intentar por slug exacto: para `panels` → `paneles-fotovoltaicos`, `inverter` → `inversores-on-grid`, `structure` → `estructuras`. Buscar `ProductCategory` con ese `slug`.
  2. Si no se encuentra, intentar por nombre normalizado: buscar categorías cuyo `name` (en mayúsculas/minúsculas) contenga una palabra clave (ej. para panels: "paneles" o "fotovoltaicos"; para inverter: "inversores" y "on-grid" o "on grid"; para structure: "estructuras"). Tomar la primera coincidencia con `id`.
  3. Si aún no hay resultado, devolver `null` (no match → fallback manual).
- **Constantes:** Definir en el mismo archivo los slugs preferidos y, como respaldo, listas de palabras clave por tipo para búsqueda por nombre.

### 2.3 Helpers de extracción (puros, testeables)

- **`extractWpFromText(name: string | null, description: string | null): number | null`**  
  Buscar en `name` y luego en `description` un patrón numérico seguido de `W` o `Wp` (ej. `430W`, `550 Wp`, `400 W`). Devolver el primer número encontrado en Watt. Si no hay match, `null`.

- **`extractKwFromText(name: string | null, description: string | null): number | null`**  
  Buscar en `name` y `description` patrones como `X.X kW`, `X kW`, `XXK`, `100K` (K = kW). Devolver el valor en kW. Si no hay match, `null`.

- **`productMatchesConnectionType(name: string | null, description: string | null, connectionType: string): boolean`**  
  Si `connectionType === 'MONOFASICO'`, devolver true si en name o description aparece “monofásico” (o “monofasico” sin tilde). Si `connectionType === 'TRIFASICO'`, true si aparece “trifásico” (o “trifasico”). Case-insensitive.

- **`productMatchesMountingType(name: string | null, description: string | null, mountingType: string): boolean`**  
  Mapear `mountingType` a palabra(s): TECHO → ["techo","cubierta"], SUELO → ["suelo","piso"], INCLINADO_FIJO → ["inclinado","fijo"], SEGUIMIENTO → ["seguimiento"], OTRO → []. Devolver true si name o description (concatenados, lowercased) contiene al menos una de las palabras. Si mountingType vacío o desconocido, false.

### 2.4 Resolución de precio vigente

- **Función:** `getCurrentPriceForProduct(tx, productId: string) => Promise<{ priceId: string; unitPrice: number; currency: string } | null>`.
- **Lógica:** Misma que en QuoteItemsService: `ProductPrice` donde `productId`, `validFrom <= now`, y (`validTo` es null o `validTo >= now`), ordenar por `validFrom` desc, limit 1. Si hay fila, devolver priceId, precio (como number) y moneda; si no, `null`.

---

## 3. Reglas exactas por panel, inversor y estructura

### 3.1 Paneles

1. **Categoría:** `resolveCategoryId(tx, 'panels')`. Si `null` → fallback manual.
2. **Listar productos:** `tx.product.findMany({ where: { categoryId, commercialStatus: 'ACTIVO' }, include: { category: true, brand: true, model: true } })`.
3. **Enriquecer con Wp:** Para cada producto, `extractWpFromText(product.name, product.description)`. Descartar productos que devuelvan `null` (no se puede inferir Wp).
4. **Tolerancia:** Definir constante ej. `PANEL_WP_TOLERANCE_PERCENT = 15` (o `PANEL_WP_TOLERANCE_ABS = 80` en W). Candidatos válidos: productos cuyo Wp extraído esté dentro de `[potenciaPorPanelWp - tolerancia, potenciaPorPanelWp + tolerancia]`. Si se usa porcentaje: `minWp = study.potenciaPorPanelWp * (1 - 0.15)`, `maxWp = study.potenciaPorPanelWp * (1 + 0.15)` (y redondear si hace falta). Si **ningún** producto queda dentro del rango → fallback manual.
5. **Ordenar y elegir:** Entre los que están en rango, ordenar por distancia absoluta a `potenciaPorPanelWp` (más cercano primero). Desempate: el que tenga precio vigente (llamada a `getCurrentPriceForProduct`); si ambos tienen, por `product.id`. Tomar el primero.
6. **Precio:** Si el producto elegido no tiene precio vigente → fallback manual (no ítem con productId a 0). Si tiene precio → crear ítem desde producto con quantity = `study.cantidadPaneles`.

### 3.2 Inversor

1. **Categoría:** `resolveCategoryId(tx, 'inverter')`. Si `null` → fallback manual.
2. **Listar productos:** Misma idea, `categoryId` y `commercialStatus: 'ACTIVO'`.
3. **Enriquecer con kW:** Para cada uno, `extractKwFromText(name, description)`. Descartar los que devuelvan `null`.
4. **Peso real de connectionType:**  
   - Primera pasada: filtrar solo productos donde `productMatchesConnectionType(name, description, study.connectionType) === true`. Entre estos, filtrar por rango de potencia (ej. inversor entre 80% y 120% de `potenciaSistemaKwp`, o tolerancia similar). Ordenar por cercanía de kW a `potenciaSistemaKwp`, desempate por precio vigente e id. Si hay al menos uno → elegir ese.  
   - Si **no** hay ninguno que coincida en conexión: segunda pasada sin filtrar por conexión; entre los que tienen kW en rango, ordenar por cercanía y desempate. Si hay alguno → elegir. Si tampoco hay → fallback manual.
5. **Precio:** Si el producto elegido no tiene precio vigente → fallback manual. Si tiene → crear ítem desde producto, quantity 1.

### 3.3 Estructura

1. **Categoría:** `resolveCategoryId(tx, 'structure')`. Si `null` → fallback manual.
2. **Listar productos:** `categoryId` y `commercialStatus: 'ACTIVO'`.
3. **Match por montaje:** Filtrar productos donde `productMatchesMountingType(name, description, study.mountingType) === true`. Si **no hay ninguno** → **fallback manual** (no elegir un producto cualquiera de la categoría).
4. **Si hay al menos uno:** Ordenar por “tiene precio vigente” primero, luego por id. Tomar el primero. Si ese producto no tiene precio vigente → fallback manual; si tiene → crear ítem desde producto, quantity 1.

---

## 4. Cómo se resuelve el precio vigente

- **Función única:** `getCurrentPriceForProduct(tx, productId)` en el mismo módulo de matching (o en `suggested-items-price.ts`).
- **Consulta:**  
  `tx.productPrice.findFirst({ where: { productId, validFrom: { lte: now }, OR: [ { validTo: null }, { validTo: { gte: now } } ] }, orderBy: { validFrom: 'desc' } })`.  
  Si no hay fila, devolver `null`. Si hay, devolver `{ priceId: price.id, unitPrice: toNum(price.price), currency: price.currency ?? product.defaultCurrency ?? 'USD' }`. Para `product.defaultCurrency` puede hacerse un findUnique de product si no se tiene en contexto.
- **Uso:** Cada resolver (paneles, inversor, estructura) después de elegir producto llama a `getCurrentPriceForProduct`. Solo si el resultado es no null se crea ítem desde producto; en caso contrario se usa fallback manual.

---

## 5. Cómo se hace el fallback manual

- **Misma forma que en Fase 1:** Crear un `QuoteItem` con `productId: null`, `productNameSnapshot` y `productDescriptionSnapshot` con el texto genérico ya usado en Fase 1 (paneles: “Suministro de paneles fotovoltaicos” + descripción con cantidad y Wp del estudio; inversor: “Suministro de inversor” + descripción mono/trifásico y kW; estructura: “Estructura de montaje” + descripción tipo montaje y paneles). `unitPriceSnapshot: 0`, `lineTotalSnapshot: 0`, `quantity` según estudio (cantidadPaneles para paneles, 1 para inversor y estructura).
- **Opcional (producto sin precio):** Si se encontró producto pero sin precio vigente, se puede usar como snapshots `product.name` y `product.description` en lugar del texto genérico, para que la línea se vea más profesional. En el plan se deja como opción; lo mínimo es usar siempre el texto genérico de Fase 1 para cualquier fallback.

---

## 6. Señal visual “Desde catálogo” vs “Manual”

- **Criterio:** En frontend, para cada ítem de la versión, si `item.productId != null` → considerar ítem “Desde catálogo”; si `item.productId == null` → “Manual”.
- **Implementación prevista:** En la tabla de ítems del detalle de cotización (p. ej. en `CotizacionDetalleView` o en el componente que renderiza las filas de ítems), añadir una columna o un badge por fila: por ejemplo “Desde catálogo” (badge o texto discreto) cuando `productId` está definido, y “Manual” o nada cuando no. Usar etiquetas reutilizables (constantes en `constants.ts` o en el componente).
- **Alcance Fase 2:** Implementar al menos este indicador en la vista de detalle de cotización donde se listan los ítems. Si la tabla está en un subcomponente, tocar ese subcomponente para recibir el ítem y mostrar el badge.

---

## 6.1 Constantes y configuración (matching)

Definir en `suggested-items-matching.ts` (o en un archivo de constantes del módulo):

| Constante | Valor sugerido | Uso |
|-----------|----------------|-----|
| `PANEL_WP_TOLERANCE_PERCENT` | `15` | Paneles: solo candidatos cuyo Wp extraído esté en ±15% de `potenciaPorPanelWp`. |
| `INVERTER_KW_MIN_RATIO` / `INVERTER_KW_MAX_RATIO` | `0.8`, `1.2` | Inversor: potencia nominal del producto entre 80% y 120% de `potenciaSistemaKwp`. |
| `CATEGORY_SLUGS` | `{ panels: 'paneles-fotovoltaicos', inverter: 'inversores-on-grid', structure: 'estructuras' }` | Slugs preferidos para resolución de categoría. |
| Palabras clave categoría (fallback) | panels: `['paneles','fotovoltaicos']`, inverter: `['inversores','on-grid','on grid']`, structure: `['estructuras']` | Búsqueda por nombre de categoría si slug no existe. |

---

## 7. Pruebas sin romper Fase 1

### 7.1 Casos a probar

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| **Categoría por slug** | Catálogo con categorías con slug exacto | Match por slug; ítems desde producto cuando hay precio. |
| **Categoría solo por nombre** | Slug distinto pero nombre “Paneles fotovoltaicos” | Resolución robusta encuentra categoría; si hay productos y precio, match. |
| **Paneles en tolerancia** | estudio 430 Wp, catálogo con 430 W y 550 W | Elige 430 W (dentro de ±15%). |
| **Paneles fuera de tolerancia** | estudio 200 Wp, catálogo solo 430 W y 550 W | Ninguno en rango → fallback manual. |
| **Inversor conexión prioritaria** | estudio MONOFASICO, 5 kW; catálogo inversor 3.6 mono y 10 trifásico | Elige 3.6 mono (prioridad conexión). |
| **Inversor sin match conexión** | estudio TRIFASICO; catálogo solo monofásicos en rango de potencia | Segunda pasada sin filtro conexión; si hay uno en rango, ese; si no, manual. |
| **Estructura con montaje** | mountingType TECHO; producto “Estructura techo” | Match; ítem desde producto si tiene precio. |
| **Estructura sin match montaje** | mountingType SUELO; catálogo solo “Estructura techo” | Ninguno coincide → fallback manual (no elegir el de techo). |
| **Producto sin precio** | Match de producto pero sin ProductPrice vigente | Fallback manual (mismo texto genérico o nombre del producto). |
| **createWithSuggestedItems false** | Body false | Cotización vacía; sin cambios respecto a Fase 1. |
| **Sin categorías / catálogo vacío** | Sin datos de categoría o sin productos ACTIVO | Tres ítems (paneles, inversor, estructura) manuales; igual que Fase 1. |

### 7.2 Regresión Fase 1

- Crear cotización desde estudio con ítems sugeridos en entorno donde no hay productos o no hay match: las 5 líneas deben seguir siendo manuales con los mismos textos que en Fase 1.
- Crear cotización desde estudio con ítems sugeridos en entorno con match y precios: hasta 3 líneas pueden ser desde producto (paneles, inversor, estructura); instalación e ingeniería siempre manuales. Totales coherentes con precios.
- La transacción debe seguir siendo única (Quote + Version + Items + recalc + FvStudy update). No introducir una segunda transacción para el matching.

### 7.3 Señal visual

- Tras crear una cotización con al menos un ítem desde producto, abrir el detalle y comprobar que las filas con `productId` muestran “Desde catálogo” (o el indicador acordado) y las manuales “Manual” o sin indicador.

---

## 8. Orden sugerido de implementación

1. **Helpers de extracción y resolución de categoría** en `suggested-items-matching.ts`: `extractWpFromText`, `extractKwFromText`, `productMatchesConnectionType`, `productMatchesMountingType`, `resolveCategoryId` (con estrategia slug + nombre).
2. **Precio vigente:** `getCurrentPriceForProduct(tx, productId)`.
3. **Resolvers por tipo:** `resolvePanelCandidate(tx, study)`, `resolveInverterCandidate(tx, study)`, `resolveStructureCandidate(tx, study)` que devuelvan `{ product, price, quantity } | null` o la estructura necesaria para crear el ítem (productId, priceId, unitPrice, currency, snapshots, quantity). Si null, el caller usará fallback manual.
4. **Integración en FvStudyService:** Dentro de la transacción, para sortOrder 1, 2, 3 llamar a los resolvers; si resultado no null y price no null, crear QuoteItem con productId y precio; si no, crear ítem manual como hoy. Ítems 4 y 5 sin cambio.
5. **Frontend:** En la tabla de ítems del detalle, añadir badge/indicador “Desde catálogo” / “Manual” según `item.productId`.
6. **Pruebas manuales** según la tabla de casos y regresión Fase 1.

Con este plan se puede implementar la Fase 2 con matching robusto, tolerancia en paneles, peso real de connectionType, fallback manual en estructuras sin match claro y señal visual prevista para ítem desde catálogo vs manual.

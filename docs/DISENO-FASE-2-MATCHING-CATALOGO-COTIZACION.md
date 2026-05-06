# Diseño Fase 2: Matching con catálogo para cotización desde estudio

## Objetivo

Mejorar la propuesta base generada desde estudio para que, cuando sea posible, los ítems de **paneles**, **inversor** y **estructura** se creen desde productos reales del catálogo (con precio vigente) en lugar de quedar siempre como ítems manuales con precio 0. Si no hay match claro o no hay precio vigente, se mantiene el fallback a ítem manual.

---

## 1. Reglas de matching por tipo de ítem

### 1.1 Paneles

| Criterio | Regla |
|----------|--------|
| **Categoría** | Productos en categoría con slug `paneles-fotovoltaicos`. |
| **Estado** | Solo productos con `commercialStatus = "ACTIVO"`. |
| **Potencia** | El estudio aporta `potenciaPorPanelWp` (ej. 400, 430, 550). Se busca un producto cuya “potencia por panel” sea la más cercana a ese valor. Como el modelo `Product` no tiene campo numérico de potencia, se extrae de `name` o `description` con una heurística: número seguido de `W`, `Wp` o ` W` (ej. regex tipo `/\d+\s*Wp?\b/i`), tomando el primer número encontrado como Wp. Si varios productos coinciden en categoría, se ordenan por distancia entre ese Wp extraído y `potenciaPorPanelWp` y se toma el más cercano. Si en ningún producto se detecta Wp, se puede tomar el primer producto ACTIVO de la categoría (o no hacer match y usar manual). |
| **Desempate** | Si hay empate de distancia (ej. dos paneles 430 W), preferir el que tenga precio vigente; si ambos lo tienen, el primero por `id` o por `name`. |

### 1.2 Inversor

| Criterio | Regla |
|----------|--------|
| **Categoría** | Productos en categoría con slug `inversores-on-grid` (para estudios típicos on-grid). No usar en esta fase inversores híbridos u off-grid salvo que se defina regla por tipo de proyecto. |
| **Estado** | Solo `commercialStatus = "ACTIVO"`. |
| **Potencia** | El estudio aporta `potenciaSistemaKwp` (ej. 5.2, 10, 100). Se busca inversor cuya “potencia nominal” sea cercana. Se extrae de `name` o `description` con heurística: número en kW (patrones tipo `X.X kW`, `X kW`, `XXK`, `100K`). Se considera un rango aceptable: por ejemplo inversor con potencia nominal entre 80% y 120% de `potenciaSistemaKwp`, o simplemente el más cercano por potencia extraída. |
| **Conexión** | El estudio aporta `connectionType` (MONOFASICO / TRIFASICO). Si en `name` o `description` del producto aparece “monofásico” / “trifásico”, priorizar productos que coincidan con el tipo de conexión. Si no hay coincidencia por texto, se puede ignorar en esta fase y elegir solo por potencia (evitando desempate innecesario). |
| **Cantidad** | En Fase 2 se mantiene una sola línea de inversor (cantidad 1). |
| **Desempate** | Misma idea: preferir producto con precio vigente; luego por id o name. |

### 1.3 Estructura

| Criterio | Regla |
|----------|--------|
| **Categoría** | Productos en categoría con slug `estructuras`. |
| **Estado** | Solo `commercialStatus = "ACTIVO"`. |
| **Tipo de montaje** | El estudio aporta `mountingType` (TECHO, SUELO, INCLINADO_FIJO, SEGUIMIENTO, OTRO). Se mapea a palabras clave: techo, suelo, inclinado, seguimiento. Se buscan productos cuyo `name` o `description` contenga (sin importar mayúsculas) la palabra correspondiente. Si hay al menos un producto que coincida, se elige uno de ellos (p. ej. el primero con precio vigente). Si no hay coincidencia por texto, se toma el primer producto ACTIVO de la categoría (o no match → manual). |
| **Cantidad** | 1 unidad (una línea “estructura”). No desglosar por cantidad de paneles en esta fase. |
| **Desempate** | Preferir producto con precio vigente; luego por id o name. |

---

## 2. Datos del estudio usados para buscar coincidencias

| Ítem sugerido | Campos FvStudy usados | Uso en matching |
|---------------|------------------------|------------------|
| Paneles | `cantidadPaneles`, `potenciaPorPanelWp`, `potenciaSistemaKwp` | Categoría paneles; potencia por panel para elegir producto (y cantidad = `cantidadPaneles`). |
| Inversor | `potenciaSistemaKwp`, `connectionType`, `tipoProyecto` | Categoría inversores on-grid; potencia para rango/cercanía; opcionalmente connectionType para priorizar mono/trifásico en nombre/descripción. |
| Estructura | `cantidadPaneles`, `mountingType` | Categoría estructuras; mountingType para palabra clave en name/description. |

Instalación e ingeniería no llevan matching en esta fase; siguen siendo siempre ítems manuales.

---

## 3. Cómo elegir producto y precio vigente

### 3.1 Resolución de categoría

- Obtener `categoryId` a partir del slug: `ProductCategory` donde `slug = 'paneles-fotovoltaicos' | 'inversores-on-grid' | 'estructuras'`. Si la categoría no existe, no hay match (fallback manual).

### 3.2 Búsqueda de producto

- Listar productos con `categoryId` y `commercialStatus = 'ACTIVO'`.
- Aplicar filtros/heurísticas por tipo (potencia extraída, palabras clave de montaje o conexión).
- Ordenar según reglas de desempate (precio vigente primero, luego id/name).
- Tomar el primer resultado como “producto candidato”.

### 3.3 Precio vigente

- Para el producto candidato, buscar un `ProductPrice` vigente: `validFrom <= now` y (`validTo` es null o `validTo >= now`), ordenar por `validFrom` desc, tomar el primero.
- Si existe: usar ese precio como `unitPriceSnapshot` (y opcionalmente `priceId` si se persiste para trazabilidad). Moneda del precio o la del producto.
- Si no existe precio vigente: **no** crear ítem desde producto con precio 0; en su lugar usar **fallback a ítem manual** con nombre/descripción similares a las del producto (para que el usuario vea una descripción útil) y precio 0. Así se evita crear ítems “vinculados a producto” sin precio y se mantiene la regla actual de que un ítem desde producto exige precio vigente (o override).

### 3.4 Creación del ítem en la cotización

- **Match con precio:** Crear `QuoteItem` con `productId`, snapshots de nombre/categoría/marca/modelo desde el producto, `quantity` (cantidadPaneles para paneles, 1 para inversor y estructura), `unitPriceSnapshot` y `lineTotalSnapshot` calculado, `currencySnapshot`, `priceId` opcional. Es el mismo contrato que “agregar ítem desde producto” en QuoteItemsService.
- **Match sin precio o sin match:** Crear ítem manual como en Fase 1 (mismos nombres/descripciones sugeridos desde el estudio, precio 0). Si hubo producto pero sin precio, se puede usar `productNameSnapshot` = product.name y `productDescriptionSnapshot` = product.description para que la línea se vea profesional aunque sea manual.

---

## 4. Cómo manejar ambigüedad o falta de match

| Situación | Comportamiento |
|-----------|----------------|
| **Categoría inexistente** | No hay match; ítem manual con texto genérico (Fase 1). |
| **Ningún producto ACTIVO en la categoría** | Ítem manual. |
| **Varios productos candidatos** | Aplicar desempate: 1) que tenga precio vigente; 2) por id o name estable. Siempre un solo producto elegido. |
| **Producto elegido pero sin precio vigente** | Fallback a ítem manual usando nombre/descripción del producto (opcional) o el texto genérico del estudio. No crear QuoteItem con productId y precio 0. |
| **No se puede extraer potencia o keyword** | Para paneles/inversor: considerar “sin match” y usar ítem manual. Para estructura: usar primer producto ACTIVO de la categoría si se desea, o manual. Definir una regla fija (ej. “si no se extrae Wp en paneles, no hay match”). |

No se requiere intervención del usuario para elegir entre varios productos en esta fase; el sistema elige uno de forma determinista.

---

## 5. Convivencia producto real vs ítem manual

- En una misma cotización generada desde estudio pueden coexistir:
  - **Ítems desde producto:** paneles, inversor y/o estructura con `productId` y precio vigente.
  - **Ítems manuales:** cualquier línea que no haya tenido match o no haya tenido precio (incluidas instalación e ingeniería).
- El orden de las 5 líneas se mantiene (sortOrder 1–5); solo cambia el origen de los datos (producto vs manual) y si viene precio o 0.
- El usuario puede seguir editando, borrando o agregando ítems; no hay bloqueo. Los ítems desde producto son editables como los actuales (cantidad, override de precio si hay permiso, etc.).
- En frontend se puede mostrar igual que hoy; opcionalmente un indicador por línea (“Desde catálogo” / “Manual”) si se expone en el API que el ítem tiene `productId` (ya se ve en el detalle de ítem). No es obligatorio en Fase 2.

---

## 6. Archivos a tocar (backend y frontend)

### 6.1 Backend

| Archivo | Cambio |
|---------|--------|
| **`apps/api/src/modules/fv-study/fv-study.service.ts`** | Inyectar dependencia para acceder a productos y precios (Prisma ya está; no hace falta nuevo servicio si se usa solo Prisma). Introducir una función o clase helper (p. ej. `resolveSuggestedItemPanels(study, tx)`, `resolveSuggestedItemInverter(study, tx)`, `resolveSuggestedItemStructure(study, tx)`) que: resuelva categoría por slug, busque productos con la lógica anterior, extraiga potencia/keywords con helpers, elija producto y precio vigente. Devolver `{ productId, priceId?, unitPrice, currency, quantity, snapshots } \| null`; si null, el flujo actual usa ítem manual. |
| **Helpers de extracción** | Funciones puras (o en un util): `extractWpFromProductNameOrDescription(name?, description?)` → number \| null; `extractKwFromProductNameOrDescription(name?, description?)` → number \| null; `productMatchesMountingType(name?, description?, mountingType)` → boolean. Ubicación: mismo archivo o `apps/api/src/modules/fv-study/suggested-items-matching.ts` (o similar). |
| **Transacción en createQuoteFromStudy** | Para cada uno de los ítems 1–3 (paneles, inversor, estructura): llamar al resolver pasando `study` y `tx`; si el resultado tiene producto y precio, crear `QuoteItem` con productId, snapshots, unitPriceSnapshot, lineTotalSnapshot; si no, crear ítem manual como en Fase 1. Ítems 4 y 5 siempre manuales. Al final, seguir llamando a `recalcVersionTotalsTx(tx, version.id)`. |
| **Prisma** | No hace falta nueva migración; se reutilizan `Product`, `ProductCategory`, `ProductPrice`. Asegurar que las consultas usen el cliente de transacción `tx` cuando se llame desde dentro de `createQuoteFromStudy`. |

No es estrictamente necesario tocar `QuoteItemsService`: la creación de ítems desde producto se hace con los mismos datos que usaría addItem (productId, snapshots, quantity, unitPriceSnapshot, etc.) pero dentro de la transacción del estudio, creando con `tx.quoteItem.create` para no abrir otra transacción ni repetir lógica de permisos.

### 6.2 Frontend

| Archivo | Cambio |
|---------|--------|
| **Opcional** | Si se quiere mostrar “Desde catálogo” en la tabla de ítems del detalle de cotización, usar que el ítem tiene `productId` no nulo. No es obligatorio para Fase 2; el diseño puede dejarse solo backend y probar con datos reales. |

---

## 7. Cómo probarlo sin romper lo actual

1. **Catálogo con datos que hacen match**
   - Estudio con `potenciaPorPanelWp = 430`, `cantidadPaneles = 10`, `potenciaSistemaKwp = 5`, `connectionType = MONOFASICO`, `mountingType = TECHO`.
   - Crear cotización desde estudio con ítems sugeridos.
   - Verificar: línea paneles con producto de ~430 W y precio; línea inversor con producto ~3.6–10 kW y precio si existe; línea estructura con producto que mencione techo y precio si existe. Totales coherentes con precios.

2. **Catálogo sin match (potencia rara)**
   - Estudio con `potenciaPorPanelWp = 999` (no existe en catálogo).
   - Crear cotización: línea paneles debe ser manual con descripción genérica y precio 0. Resto según corresponda.

3. **Producto sin precio vigente**
   - Si el único panel que hace match no tiene `ProductPrice` vigente: línea paneles debe ser manual (precio 0), no ítem con productId y 0.

4. **createWithSuggestedItems = false**
   - Sigue creando cotización vacía; sin cambios.

5. **Regresión Fase 1**
   - Sin catálogo o categorías vacías: las 5 líneas deben seguir siendo manuales como en Fase 1.

6. **Edición posterior**
   - Cotización generada con ítems desde producto: editar cantidad o precio de un ítem y guardar; totales deben recalcularse. Eliminar ítem y agregar otro; flujo normal.

Con este diseño se puede implementar la Fase 2 de matching con catálogo manteniendo fallback a manual y sin romper el flujo actual.

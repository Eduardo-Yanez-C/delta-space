# Plan de implementación Fase 1: Cotización pro desde estudio (ítems sugeridos manuales)

Implementar la propuesta base automática desde el Estudio FV usando ítems manuales editables, con los ajustes aprobados.

---

## Ajustes incorporados

1. **Señal visual en detalle de cotización:** Mostrar texto tipo "Propuesta base generada desde estudio" cuando la cotización se creó con ítems sugeridos, para que el usuario entienda por qué hay líneas precargadas.
2. **Orden fijo de ítems (`sortOrder`):** 1 Paneles, 2 Inversor, 3 Estructura, 4 Instalación, 5 Ingeniería.
3. **Descripciones base comerciales:**  
   - Suministro de paneles fotovoltaicos  
   - Suministro de inversor  
   - Estructura de montaje  
   - Instalación y puesta en marcha  
   - Ingeniería y diseño  
4. **Inversor:** Una sola línea en Fase 1 (sin lógica de varios inversores).
5. **UX:** Dejar claro que la propuesta es editable y que algunos precios pueden requerir ajuste posterior.

---

## 1. Archivos a tocar

| Archivo | Acción |
|---------|--------|
| `apps/api/prisma/schema.prisma` | Añadir campo `suggestedItemsFromStudy Boolean @default(false)` en modelo `Quote`. |
| `apps/api/prisma/migrations/` | Nueva migración para el campo anterior. |
| `apps/api/src/modules/fv-study/fv-study.controller.ts` | Aceptar body opcional con `createWithSuggestedItems` en `createQuoteFromStudy`. |
| `apps/api/src/modules/fv-study/fv-study.service.ts` | Cargar estudio con datos necesarios; si `createWithSuggestedItems !== false`, crear 5 QuoteItem manuales y recalcular totales; setear `suggestedItemsFromStudy` en Quote. |
| `apps/api/src/modules/fv-study/fv-study.module.ts` | Importar `QuotesModule` e inyectar `QuoteVersionsService` para usar `recalcVersionTotalsTx` dentro de la transacción. |
| `apps/api/src/modules/quotes/quotes.module.ts` | Exportar `QuoteVersionsService` para uso desde FvStudyModule. |
| `apps/api/src/modules/quotes/versions/quote-versions.service.ts` | Asegurar que `recalcVersionTotalsTx` sea invocable con un cliente de transacción `tx` pasado desde fuera (ya existe; solo documentar uso). |
| `apps/api/src/modules/quotes/quotes.service.ts` | Incluir `suggestedItemsFromStudy` en las respuestas de Quote (findOne, list si aplica). |
| `apps/web/lib/api.ts` | Añadir `suggestedItemsFromStudy?: boolean` a tipos `QuoteDetail` y `QuoteListItem` si el listado lo muestra. |
| `apps/web/app/cotizaciones/[id]/CotizacionDetalleView.tsx` | Mostrar banner "Propuesta base generada desde estudio" cuando `quote.suggestedItemsFromStudy === true`; texto aclarando que las líneas son editables y que algunos precios pueden requerir ajuste. |

No se tocan: DTOs de QuoteItem (se crean ítems manuales con datos fijos desde el servicio), frontend del estudio (el botón sigue llamando al mismo endpoint; se puede enviar body `{ createWithSuggestedItems: true }`).

---

## 2. Cambios en backend

### 2.1 Schema y migración

- En `Quote`, añadir:
  - `suggestedItemsFromStudy Boolean @default(false)`
- Generar migración con `npx prisma migrate dev --name add_quote_suggested_items_from_study`.

### 2.2 Endpoint create-quote desde estudio

- **Ruta:** `POST /api/fv-studies/:id/create-quote`
- **Body opcional:** `{ "createWithSuggestedItems": true }` (por defecto considerar `true` si no se envía).
- **Controlador:** Leer body con `CreateQuoteFromStudyDto` o similar con `createWithSuggestedItems?: boolean`; pasar al servicio. Si no hay body, usar `true`.

### 2.3 Lógica en FvStudyService.createQuoteFromStudy

- **Parámetro:** `createWithSuggestedItems: boolean` (default `true`).
- **Carga del estudio:** Además de los campos actuales, incluir en el `select`: `cantidadPaneles`, `potenciaPorPanelWp`, `potenciaSistemaKwp`, `connectionType`, `tipoProyecto`, `mountingType`, `currency` (para moneda de ítems).
- **Transacción (resumen):**
  1. Crear `Quote` con `suggestedItemsFromStudy: createWithSuggestedItems` (y el resto como ahora).
  2. Crear `QuoteVersion` (versión 1) como ahora.
  3. Si `createWithSuggestedItems === true`:
     - Crear 5 registros `QuoteItem` en esa versión, en este orden y con `sortOrder` 1 a 5, todos ítems **manuales** (sin `productId`), con:
       - `productNameSnapshot`: nombre comercial indicado abajo.
       - `productDescriptionSnapshot`: descripción breve opcional (ej. referencia a potencia o tipo de montaje donde aplique).
       - `quantity`, `unitPriceSnapshot` (0), `currencySnapshot` (moneda del estudio), `discountPercentSnapshot` (0), `lineTotalSnapshot` (0 porque precio 0).
       - `sortOrder`: 1, 2, 3, 4, 5.
     - Llamar a `quoteVersionsService.recalcVersionTotalsTx(tx, version.id)` pasando el cliente de transacción `tx` para actualizar subtotal, descuentos, IVA y total de la versión dentro de la misma transacción.
  4. Actualizar `FvStudy` a COTIZADO como ahora.
  5. Devolver `{ quote, version }` como hasta ahora.

### 2.4 Definición de los 5 ítems (manuales)

Constantes de nombres/descripciones (en el servicio o en un pequeño helper):

| sortOrder | productNameSnapshot | productDescriptionSnapshot | quantity |
|-----------|---------------------|----------------------------|----------|
| 1 | Suministro de paneles fotovoltaicos | Opcional: "X unidades de Y Wp — Sistema Z kWp" (X=cantidadPaneles, Y=potenciaPorPanelWp, Z=potenciaSistemaKwp) | study.cantidadPaneles |
| 2 | Suministro de inversor | Opcional: "Inversor para sistema de X kW" (X=potenciaSistemaKwp) | 1 |
| 3 | Estructura de montaje | Opcional: "Estructura para N paneles" o según mountingType (techo/suelo/inclinado) | 1 |
| 4 | Instalación y puesta en marcha | Opcional: "Incluye instalación y puesta en marcha del sistema" | 1 |
| 5 | Ingeniería y diseño | Opcional: "Proyecto de ingeniería y diseño" | 1 |

- `currencySnapshot`: `study.currency ?? "USD"`.
- `unitPriceSnapshot`: 0.
- `discountPercentSnapshot`: 0.
- `lineTotalSnapshot`: 0 (quantity * unitPriceSnapshot * (1 - discount/100) = 0).
- Resto de snapshots (category, brand, model): null.
- `productId`, `categoryId`, `brandId`, `modelId`: null.

### 2.5 Recálculo de totales

- Dentro de la misma transacción, después de crear los 5 `QuoteItem`, llamar a `this.quoteVersionsService.recalcVersionTotalsTx(tx, version.id)`.
- `QuoteVersionsService` debe exponer el método `recalcVersionTotalsTx(tx, versionId)` para que pueda ser invocado con el cliente `tx` de la transacción externa (ya existe; solo asegurar que la firma sea compatible: primer argumento el cliente Prisma de la transacción).
- **Módulos:** `QuotesModule` exporta `QuoteVersionsService`. `FvStudyModule` importa `QuotesModule` y declara `FvStudyService` con dependencia de `QuoteVersionsService`. Evitar dependencia circular: FvStudyModule → QuotesModule (QuotesModule no debe importar FvStudyModule).

### 2.6 Respuesta de Quote (list/detail)

- En `QuotesService` (o donde se arma la respuesta de una quote): incluir el campo `suggestedItemsFromStudy` en el objeto Quote devuelto por `findOne` y, si el listado devuelve ese dato, en cada ítem de listado.

---

## 3. Cómo se crean los QuoteItem sugeridos

- **Dónde:** Dentro del callback de `prisma.$transaction` en `createQuoteFromStudy`, usando el cliente `tx`.
- **Método:** `tx.quoteItem.create({ data: { ... } })` cinco veces, o un bucle con array de especificaciones, en orden de `sortOrder` 1 a 5.
- **Datos por ítem:**  
  - `quoteVersionId`: id de la versión recién creada.  
  - `productId`, `categoryId`, `brandId`, `modelId`: null.  
  - `productNameSnapshot`, `productDescriptionSnapshot`: según tabla anterior.  
  - `categoryNameSnapshot`, `brandNameSnapshot`, `modelNameSnapshot`: null.  
  - `currencySnapshot`: moneda del estudio.  
  - `unitPriceSnapshot`: 0.  
  - `unitCostSnapshot`, `discountPercentSnapshot`, `marginPercentSnapshot`: null (o discount 0).  
  - `quantity`: según tabla (cantidadPaneles para paneles, 1 para el resto).  
  - `lineTotalSnapshot`: 0 (o quantity * unitPriceSnapshot si en el futuro se usa otro precio por defecto).  
  - `sortOrder`: 1, 2, 3, 4, 5.  
  - `configSnapshot`: null.
- No usar `QuoteItemsService.addItem` desde aquí para no duplicar lógica de permisos ni salir de la transacción; la creación es interna al caso de uso "crear cotización desde estudio".

---

## 4. Cómo se hace el recálculo de totales

- Tras crear los 5 ítems con `tx.quoteItem.create`, invocar `this.quoteVersionsService.recalcVersionTotalsTx(tx, version.id)`.
- `recalcVersionTotalsTx` ya implementa: leer versión con ítems, sumar `lineTotalSnapshot` → subtotal, aplicar `globalDiscountPercent` y `vatPercent` de la versión, actualizar `subtotal`, `discountsTotal`, `taxesTotal`, `total` de la versión con `tx.quoteVersion.update`.
- Con precios 0 en todos los ítems, el total quedará en 0; al editar precios después, el usuario puede recalcular o el sistema ya recalcula al guardar ítems (flujo actual de cotizaciones).

---

## 5. Cómo se ve en frontend

### 5.1 Detalle de cotización (CotizacionDetalleView)

- **Condición:** `quote.suggestedItemsFromStudy === true`.
- **Ubicación:** Junto o debajo del bloque existente "Basado en Estudio FV" (enlace al estudio), o como primer mensaje informativo de la página.
- **Contenido del banner (ejemplo):**
  - Título o frase destacada: **"Propuesta base generada desde estudio"**
  - Texto secundario: "Las líneas siguientes se generaron a partir del estudio FV y son editables. Complete precios donde corresponda y ajuste cantidades o descripciones si lo necesita."
- **Estilo:** Tarjeta o banner informativo (ej. fondo azul/ámbar suave, borde discreto), no de error. Por ejemplo clase tipo `bg-sky-50 border border-sky-200` o similar para que se distinga como información.

### 5.2 Mensaje de “editable y precios”

- Incluir en el mismo bloque la idea de que:
  - La propuesta base es editable.
  - Algunos precios pueden estar en 0 y requerir ajuste posterior.
- No hace falta un segundo banner; un solo bloque con los dos párrafos (origen + editable/precios) es suficiente.

### 5.3 Listado de cotizaciones

- Opcional: en la fila de la cotización, mostrar un indicador pequeño (badge o icono) "Propuesta base" cuando `suggestedItemsFromStudy === true`. No obligatorio para Fase 1; puede dejarse para una iteración posterior.

### 5.4 Creación desde estudio (botón actual)

- El botón "Crear cotización desde este estudio" enviará en el body `{ createWithSuggestedItems: true }` (o sin body y el backend interpreta true por defecto).
- Opcional en Fase 1: enlace "Crear cotización vacía" que llame con `createWithSuggestedItems: false`. Si no se implementa, se puede documentar que el backend acepta `false` para uso futuro o para pruebas.

---

## 6. Cómo probar el flujo completo

### 6.1 Crear cotización con propuesta base (caso feliz)

1. Tener un estudio FV con datos válidos (cantidadPaneles, potenciaPorPanelWp, potenciaSistemaKwp, etc.).
2. En el detalle del estudio, pulsar "Crear cotización desde este estudio" (con body `createWithSuggestedItems: true` o por defecto).
3. Verificar:
   - Redirección al detalle de la cotización creada.
   - La cotización tiene `sourceFvStudyId` y `suggestedItemsFromStudy === true`.
   - La versión 1 tiene exactamente 5 ítems, en orden: Paneles, Inversor, Estructura, Instalación, Ingeniería.
   - Nombres y descripciones según lo definido (comerciales y profesionales).
   - Cantidad de paneles = cantidadPaneles del estudio; resto cantidad 1.
   - Precios en 0; totales de la versión en 0 (o coherentes con eso).
   - En el detalle de la cotización se muestra el banner "Propuesta base generada desde estudio" y el texto sobre edición y precios.

### 6.2 Editar ítems y precios

1. En la misma cotización, editar el precio unitario de un ítem (ej. paneles) y guardar.
2. Verificar que el resumen económico de la versión se actualiza (subtotal, total).
3. Editar cantidad o descripción de un ítem y verificar que se persiste correctamente.

### 6.3 Crear cotización vacía (opcional)

1. Si se implementa la opción "Crear cotización vacía" o se llama al API con `createWithSuggestedItems: false`:
   - La cotización se crea con versión 1 sin ítems.
   - `suggestedItemsFromStudy` debe ser false.
   - No se muestra el banner de "Propuesta base generada desde estudio".

### 6.4 Estudios existentes y compatibilidad

1. Cotizaciones ya creadas antes del cambio no tienen `suggestedItemsFromStudy` (o será false por defecto): no muestran el nuevo banner.
2. Crear cotización desde un estudio con datos mínimos (ej. cantidadPaneles 10, potenciaPorPanelWp 400): verificar que los 5 ítems se crean con descripciones coherentes (ej. "10 unidades de 400 Wp — Sistema X kWp" si se usa esa descripción).

### 6.5 Vista previa / PDF

1. Abrir la vista previa (y exportar PDF) de una cotización creada con propuesta base.
2. Verificar que los 5 ítems aparecen en el documento con los nombres y cantidades correctos; no es necesario cambiar nada en la vista previa salvo que se quiera añadir una leyenda tipo "Propuesta base desde estudio" (opcional en Fase 1).

---

## 7. Orden sugerido de implementación

1. **Schema y migración:** Añadir `suggestedItemsFromStudy` a Quote; ejecutar migración.
2. **QuotesModule:** Exportar `QuoteVersionsService`.
3. **FvStudyModule:** Importar `QuotesModule`; inyectar `QuoteVersionsService` en `FvStudyService`.
4. **FvStudyController:** Aceptar body opcional con `createWithSuggestedItems` y pasarlo al servicio.
5. **FvStudyService:** Implementar carga ampliada del estudio, creación de Quote con `suggestedItemsFromStudy`, creación de los 5 QuoteItem con `sortOrder` 1–5 y descripciones definidas, llamada a `recalcVersionTotalsTx(tx, version.id)`.
6. **QuotesService:** Incluir `suggestedItemsFromStudy` en la respuesta de quote (findOne y list si aplica).
7. **Frontend api.ts:** Añadir `suggestedItemsFromStudy` a los tipos de Quote.
8. **CotizacionDetalleView:** Mostrar el banner cuando `quote.suggestedItemsFromStudy === true` con el texto acordado (origen + editable + precios).
9. **Frontend llamada create-quote:** Enviar body `{ createWithSuggestedItems: true }` al crear cotización desde estudio (o dejar que el backend use true por defecto si no se envía body).
10. **Pruebas manuales:** Seguir la sección 6.

Con este plan se puede implementar la Fase 1 sin romper el flujo actual y dejando clara la señal visual y la UX de propuesta base editable.

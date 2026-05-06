# Plan de implementación — Fase 1: Plantillas predeterminadas

Alcance: solo plantillas base para crear cotizaciones rápidas. **No** se implementan adicionales automáticos en esta fase.

Plantillas iniciales: **3 kW OnGrid**, **4 kW OnGrid**, **6 kW OnGrid**.

---

## 1. Archivos a tocar

### Backend (API)

| Archivo | Acción |
|---------|--------|
| `apps/api/prisma/schema.prisma` | Añadir modelos `QuoteTemplate` y `QuoteTemplateItem`; opcionalmente campo `sourceQuoteTemplateId` en `Quote` para trazabilidad (o dejarlo para fase posterior). |
| `apps/api/prisma/migrations/` | Nueva migración para tablas `QuoteTemplate` y `QuoteTemplateItem`. |
| `apps/api/prisma/seed.ts` | Añadir función de seed para las 3 plantillas y sus ítems (5 líneas por plantilla: paneles, inversor, estructura, instalación, ingeniería). Reutilizar textos alineados con Efora si se documentan en `docs/referencia-plantilla-efora.md`. |
| `apps/api/src/modules/quote-templates/` | **Nuevo módulo.** |
| `apps/api/src/modules/quote-templates/quote-templates.module.ts` | Módulo Nest (imports: PrismaModule, AuthModule; exports: QuoteTemplatesService). |
| `apps/api/src/modules/quote-templates/quote-templates.controller.ts` | GET listado de plantillas activas; GET por id (opcional). POST **no** en Fase 1 (solo lectura desde seed). |
| `apps/api/src/modules/quote-templates/quote-templates.service.ts` | findMany (activas, ordenadas); findOne; **createQuoteFromTemplate(templateId, dto, currentUser)** que crea Quote + QuoteVersion + QuoteItems en transacción y llama a recalcVersionTotalsTx. |
| `apps/api/src/modules/quote-templates/dto/create-quote-from-template.dto.ts` | clientId, currency (opcional), title (opcional). |
| `apps/api/src/modules/quote-templates/dto/quote-template-item.dto.ts` | Tipos o DTOs de respuesta para ítems de plantilla (si hace falta). |
| `apps/api/src/app.module.ts` | Importar y registrar `QuoteTemplatesModule`. |
| `apps/api/src/modules/quotes/versions/quote-versions.service.ts` | Sin cambios; ya expone `recalcVersionTotalsTx` para uso desde QuoteTemplatesService. |
| `apps/api/src/modules/quotes/quotes.module.ts` | Exportar `QuoteVersionsService` (ya exportado); QuoteTemplatesModule lo importará para crear ítems y recalcular. |

### Frontend (Web)

| Archivo | Acción |
|---------|--------|
| `apps/web/lib/api.ts` | Tipos `QuoteTemplate`, `QuoteTemplateItem`; función `fetchQuoteTemplates()`; función `createQuoteFromTemplate(templateId, body)`. |
| `apps/web/app/cotizaciones/` | Opción “Desde plantilla” en el flujo de nueva cotización. |
| `apps/web/app/cotizaciones/nueva/page.tsx` (o nueva ruta) | Ajustar para ofrecer: “Nueva cotización (vacía)” y “Desde plantilla”. Si “Desde plantilla”, redirigir a selector de plantilla + cliente o a una página intermedia. |
| `apps/web/app/cotizaciones/desde-plantilla/page.tsx` | **Nueva página:** formulario con selector de cliente, selector de plantilla (3 / 4 / 6 kW OnGrid), moneda opcional, título opcional; botón “Crear cotización”. Al enviar, llamar a `createQuoteFromTemplate` y redirigir al detalle de la cotización creada. |
| Navegación (sidebar o listado de cotizaciones) | Botón o enlace “Nueva cotización desde plantilla” que lleve a `/cotizaciones/desde-plantilla` (o integrar en `/cotizaciones/nueva` con pestañas/tabs). |

### Documentación / referencia

| Archivo | Acción |
|---------|--------|
| `docs/referencia-plantilla-efora.md` | Documento de referencia con estructura de ítems y textos sugeridos tomados de la planilla Efora (nombres de líneas, descripciones, orden). El seed de plantillas usará estos textos para `productNameSnapshot` y `productDescriptionSnapshot` de cada QuoteTemplateItem. |

---

## 2. Modelos y migraciones

### 2.1 QuoteTemplate

- `id` String @id @default(cuid())
- `name` String (ej. "3 kW OnGrid", "4 kW OnGrid", "6 kW OnGrid")
- `systemType` String (ej. "ONGRID")
- `targetPowerKwp` Decimal (3, 4, 6)
- `description` String? (opcional)
- `active` Boolean @default(true)
- `sortOrder` Int @default(0)
- `createdAt` DateTime
- `updatedAt` DateTime

### 2.2 QuoteTemplateItem

- `id` String @id @default(cuid())
- `quoteTemplateId` String; relación con QuoteTemplate (onDelete: Cascade)
- `sortOrder` Int (1 = paneles, 2 = inversor, 3 = estructura, 4 = instalación, 5 = ingeniería)
- `itemType` String ("PANELES" | "INVERSOR" | "ESTRUCTURA" | "INSTALACION" | "INGENIERIA" | "OTRO")
- `quantityRule` String ("FIXED" | "DERIVED_FROM_POWER")
- `quantityFixed` Int? (cuando quantityRule = FIXED, ej. 1)
- `potenciaPorPanelWp` Int? (solo para PANELES cuando quantityRule = DERIVED_FROM_POWER; ej. 400)
- `productNameSnapshot` String (texto por defecto para la línea)
- `productDescriptionSnapshot` String? (descripción por defecto; puede incluir placeholders como "{{cantidadPaneles}}" que se reemplazan al aplicar)
- `unitPriceDefault` Decimal? @default(0)
- `createdAt` DateTime
- `updatedAt` DateTime

Para Fase 1 no se usa `productId` en plantilla; todos los ítems generados son “manuales” (productId null) con snapshots rellenados desde la plantilla y cantidades calculadas (paneles = ceil(targetPowerKwp * 1000 / potenciaPorPanelWp), resto 1).

### 2.3 Quote (opcional en Fase 1)

- Añadir `sourceQuoteTemplateId` String? y relación con QuoteTemplate (onDelete: SetNull) para indicar que la cotización se generó desde una plantilla. Permite trazabilidad y futuras mejoras (ej. “Basado en plantilla 4 kW OnGrid”). Si se prefiere no tocar Quote en Fase 1, se puede omitir y añadir en una iteración posterior.

### 2.4 Migración

- Después de editar `schema.prisma`, ejecutar `npx prisma migrate dev --name add_quote_templates` para generar la migración y aplicarla.

---

## 3. Endpoints

### 3.1 GET /api/quote-templates

- **Descripción:** Listar plantillas activas para selector en frontend.
- **Respuesta:** Array de { id, name, systemType, targetPowerKwp, description, sortOrder } con ítems incluidos (id, sortOrder, itemType, quantityRule, quantityFixed, potenciaPorPanelWp, productNameSnapshot, productDescriptionSnapshot, unitPriceDefault) ordenados por sortOrder.
- **Permisos:** Cualquier usuario autenticado que pueda crear cotizaciones (ej. ADMIN, VENTAS) o solo lectura (LECTURA, INGENIERIA) para mostrar selector.
- **Uso:** Pantalla “Crear desde plantilla” carga las plantillas y muestra dropdown o cards (3 kW, 4 kW, 6 kW OnGrid).

### 3.2 GET /api/quote-templates/:id

- **Descripción:** Obtener una plantilla por id con sus ítems (para previsualización o para el backend al crear la cotización).
- **Permisos:** Mismo que listado.

### 3.3 POST /api/quote-templates/:id/create-quote

- **Descripción:** Crear una cotización desde la plantilla. Cuerpo: `CreateQuoteFromTemplateDto` (clientId, currency?, title?).
- **Lógica:**
  1. Validar que la plantilla exista y esté activa.
  2. Validar que el cliente exista y que el usuario tenga permiso (mismo criterio que crear cotización normal).
  3. En una transacción Prisma:
     - Crear Quote (clientId, ownerId = currentUser.id, title = dto.title ?? "Cotización [nombre plantilla] - [nombre cliente]", projectType = "RESIDENCIAL", currency = dto.currency ?? "USD", sourceQuoteTemplateId = template.id si se añade el campo, sin sourceFvStudyId).
     - Crear QuoteVersion (versionNumber 1, status BORRADOR, totales en 0, vatPercent 19, createdById = currentUser.id).
     - Para cada QuoteTemplateItem (ordenado por sortOrder): calcular quantity (si DERIVED_FROM_POWER: cantidad = ceil(targetPowerKwp * 1000 / potenciaPorPanelWp); si FIXED: quantityFixed). Crear QuoteItem con productId null, snapshots desde la plantilla (sustituyendo placeholders como {{cantidadPaneles}} por la cantidad calculada), quantity, unitPriceSnapshot = unitPriceDefault ?? 0, lineTotalSnapshot = quantity * unitPrice, sortOrder, currencySnapshot = currency de la quote.
     - Llamar a QuoteVersionsService.recalcVersionTotalsTx(tx, version.id).
  4. Devolver { quote, version } para que el frontend redirija al detalle de la cotización.
- **Permisos:** ADMIN, VENTAS (mismos que crear cotización).

---

## 4. Cómo crear la cotización desde plantilla

1. **Entrada:** templateId, body: { clientId, currency?, title? }, currentUser.
2. **Validaciones:** plantilla existe y active; cliente existe; usuario con rol permitido.
3. **Cálculo de cantidades por ítem:**
   - PANELES con quantityRule = DERIVED_FROM_POWER: `quantity = Math.ceil((targetPowerKwp * 1000) / (potenciaPorPanelWp ?? 400))`.
   - Resto (INVERSOR, ESTRUCTURA, INSTALACION, INGENIERIA): quantity = quantityFixed ?? 1.
4. **Texto de descripción:** Si productDescriptionSnapshot contiene "{{cantidadPaneles}}" o "{{targetPowerKwp}}", reemplazar por la cantidad calculada o targetPowerKwp de la plantilla.
5. **Quote:** Sin sourceFvStudyId; sourceQuoteTemplateId opcional; title = dto.title ?? `Cotización ${template.name} - ${client.name}`.
6. **QuoteVersion:** Una sola versión inicial con ítems; después el usuario puede editar ítems, precios y totales como en cualquier cotización (todo editable).

No se implementa matching con catálogo en Fase 1; los ítems son todos manuales con precio por defecto (0 o unitPriceDefault). El matching desde plantilla puede ser Fase 3 según el diseño general.

---

## 5. Uso de la planilla Efora como referencia del seed

- La planilla **Items Cotización Efora.xlsx** es referencia externa: no se lee en tiempo de ejecución.
- En `docs/referencia-plantilla-efora.md` (o similar) se documenta:
  - Estructura de líneas típicas: 1) Paneles, 2) Inversor, 3) Estructura, 4) Instalación, 5) Ingeniería.
  - Textos de nombre y descripción por línea (copiados o adaptados de Efora) para 3, 4 y 6 kW.
- El **seed** en `prisma/seed.ts`:
  - Crea las 3 plantillas (3 kW OnGrid, 4 kW OnGrid, 6 kW OnGrid) con targetPowerKwp 3, 4, 6 y systemType "ONGRID".
  - Para cada plantilla, crea 5 QuoteTemplateItem con itemType, sortOrder, quantityRule (PANELES = DERIVED_FROM_POWER con potenciaPorPanelWp 400; resto FIXED con quantityFixed 1), productNameSnapshot y productDescriptionSnapshot tomados de la referencia (ej. "Suministro de paneles fotovoltaicos", "Suministro de inversor", etc., con descripción que use "{{cantidadPaneles}}" y "{{targetPowerKwp}}" donde corresponda).
- Si la planilla Efora tiene precios unitarios de referencia, se pueden fijar en `unitPriceDefault` en el seed; si no, 0 y el usuario los completa después.

---

## 6. Cómo probarlo

1. **Migración y seed**
   - `npx prisma migrate dev`
   - `npx prisma db seed`
   - Verificar en DB que existen 3 filas en QuoteTemplate y 15 en QuoteTemplateItem (5 por plantilla).

2. **API**
   - GET /api/quote-templates: devuelve las 3 plantillas con ítems.
   - POST /api/quote-templates/:id/create-quote con body { clientId: "<id cliente existente>", currency: "CLP" } (usuario ADMIN o VENTAS): crea una Quote con una versión y 5 ítems; totales coherentes con precios por defecto; ítems editables en el detalle.

3. **Frontend**
   - Acceder a “Nueva cotización desde plantilla” (o equivalente), elegir cliente y plantilla (ej. 4 kW OnGrid), crear: redirige al detalle de la cotización con 5 líneas (paneles con cantidad calculada para 4 kW, inversor, estructura, instalación, ingeniería con cantidad 1). Editar cantidad o precio de un ítem y guardar: totales se recalculan.
   - Cotización creada desde plantilla no tiene estudio vinculado; vista previa/PDF no muestra bloque de estudio FV ni gráficos (comportamiento actual para cotizaciones sin sourceFvStudyId).

4. **Regresión**
   - Crear cotización vacía normal y desde estudio: sin cambios.
   - Listado de cotizaciones y detalle siguen funcionando igual; las creadas desde plantilla son cotizaciones normales con ítems base rellenados.

Con este plan se implementa la Fase 1 de plantillas predeterminadas (modelo, seed, endpoint crear desde plantilla, flujo en frontend) sin adicionales automáticos y dejando todo listo para edición posterior.

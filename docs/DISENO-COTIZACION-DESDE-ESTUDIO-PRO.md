# Diseño: cotización pro desde Estudio FV (propuesta base editable)

## Objetivo

Automatizar **parcialmente** la creación de cotización a partir del Estudio FV: que el estudio no solo cree una cotización vacía, sino que genere una **propuesta base editable** con ítems sugeridos a partir de los resultados del estudio.

---

## 1. Arquitectura funcional de la automatización

### 1.1 Flujo actual (sin cambios de contrato)

- Usuario en detalle del Estudio FV → "Crear cotización desde este estudio".
- Backend: `POST /api/fv-studies/:id/create-quote` → crea Quote + QuoteVersion (vacía), vincula `sourceFvStudyId`, actualiza estudio a COTIZADO.
- Usuario llega a la cotización y agrega ítems manualmente o desde el catálogo.

### 1.2 Flujo objetivo (pro)

- Mismo punto de partida: "Crear cotización desde este estudio".
- Backend: mismo endpoint (o extendido) con **opción** de generar ítems sugeridos.
- Si la opción está activa (por defecto): además de Quote + versión inicial, se crean **N QuoteItem** en esa versión, con datos derivados del estudio (paneles, inversor, estructura, instalación, ingeniería).
- Todo es **editable**: el usuario puede borrar ítems, cambiar cantidades, precios, agregar más líneas. La sugerencia es solo una base comercial inteligente.

### 1.3 Principios de diseño

| Principio | Aplicación |
|-----------|------------|
| **No rígido** | Los ítems sugeridos son registros normales de QuoteItem; no hay “modo bloqueado” ni contrato especial. |
| **Editable** | El usuario puede editar precios, cantidades, descripciones y eliminar o duplicar ítems como en cualquier cotización. |
| **Reversible** | Se mantiene la posibilidad de crear cotización vacía (sin ítems sugeridos) para no romper flujos que prefieran empezar de cero. |
| **Trazabilidad** | La cotización sigue vinculada al estudio por `sourceFvStudyId`; los ítems no necesitan un flag especial en esta fase (opcional para analytics). |

### 1.4 Opción de comportamiento

- **Parámetro de entrada:** en el endpoint de creación de cotización desde estudio se acepta un flag, por ejemplo `createWithSuggestedItems` (o `withSuggestedItems`).
  - `true` (recomendado por defecto): crear Quote + versión inicial + ítems sugeridos.
  - `false`: comportamiento actual (Quote + versión vacía).
- **Frontend:** el botón "Crear cotización desde este estudio" usa por defecto `true`. Opcionalmente se puede ofrecer en la misma pantalla un enlace o desplegable "Crear cotización vacía" que llame con `false`.

---

## 2. Ítems automáticos vs sugerencias previas

### 2.1 Comparación

| Enfoque | Descripción | Pros | Contras |
|---------|-------------|------|--------|
| **Ítems automáticos** | Al crear la cotización se crean ya los QuoteItem en la versión inicial. | Una sola acción; la cotización llega con una propuesta lista para revisar y editar. | Requiere definir reglas y, si hay catálogo, lógica de matching. |
| **Sugerencias previas** | Pantalla intermedia “Revisar sugerencias” con lista de líneas propuestas; el usuario confirma y entonces se crea la cotización con esos ítems. | El usuario ve antes de comprometer. | Paso extra en el flujo; duplicación de lógica (construir sugerencias en frontend o en un endpoint de “preview”). |

### 2.2 Recomendación

**Generar ítems automáticos** en la creación de la cotización (cuando `createWithSuggestedItems === true`).

- Mejor experiencia: un clic y la cotización tiene ya una base comercial.
- La “sugerencia” es simplemente el conjunto de ítems creados en la versión 1; el usuario los ve y edita en la pantalla de detalle de la cotización.
- Si en el futuro se quiere un paso de “preview”, se puede añadir un endpoint tipo `GET /api/fv-studies/:id/suggested-quote-items` que devuelva la misma estructura que se usaría para crear ítems, y en frontend mostrar un modal antes de confirmar; por ahora no es necesario.

---

## 3. Reglas de negocio por tipo de ítem

Las reglas siguientes usan **solo datos del Estudio FV** (y opcionalmente catálogo de productos). Todas las líneas son editables después.

### 3.1 Paneles

| Dato del estudio | Uso |
|------------------|-----|
| `cantidadPaneles` | Cantidad del ítem. |
| `potenciaPorPanelWp` | Para descripción y, si hay matching por catálogo, búsqueda (ej. panel de ~400 Wp). |
| `potenciaSistemaKwp` | Contexto; puede usarse en descripción o en lógica de inversor. |

**Regla:** Una línea de “Paneles FV” con cantidad = `cantidadPaneles`, descripción tipo “Panel fotovoltaico X Wp” (X = `potenciaPorPanelWp`).  
**Precio:** Si hay matching con producto del catálogo (categoría paneles, potencia similar), usar producto y precio vigente; si no, ítem **manual** con nombre/descripción y precio 0 o a completar por el usuario.

### 3.2 Inversor(es)

| Dato del estudio | Uso |
|------------------|-----|
| `potenciaSistemaKwp` | Dimensionar potencia del inversor (típicamente 1 inversor hasta cierto kWp; por encima, 2 o más). |
| `connectionType` (MONOFASICO / TRIFASICO) | Filtrar productos por tipo (monofásico vs trifásico). |
| `tipoProyecto` | Contexto (residencial/comercial/industrial); opcional para descripción o reglas finas. |

**Regla:**  
- Hasta un umbral (ej. ≤ 10 kWp): 1 línea “Inversor” con cantidad 1, potencia sugerida ≈ `potenciaSistemaKwp` (redondeada a producto disponible o descripción).  
- Por encima del umbral: 2 líneas de inversor (mitad de potencia cada uno) o 1 línea con cantidad 2 y descripción “Inversor X kW” según criterio interno.  
**Precio:** Si hay producto de categoría inversores on-grid (o híbrido si aplica) que coincida en tipo de conexión y rango de potencia, usar ese producto y precio; si no, ítem manual con descripción y precio 0 o a completar.

### 3.3 Estructura

| Dato del estudio | Uso |
|------------------|-----|
| `cantidadPaneles` | Para cantidad o descripción (ej. “Estructura para N paneles”). |
| `mountingType` (TECHO, SUELO, INCLINADO_FIJO, etc.) | Tipo de estructura; descripción y, si hay catálogo, filtro por categoría estructuras. |

**Regla:** Una línea “Estructura de montaje” (o “Estructura techo/suelo/inclinado” según `mountingType`), cantidad 1 o N según convención (ej. 1 “kit” por sistema, o por cada N paneles).  
**Precio:** Matching por categoría estructuras y tipo de montaje si existe; si no, ítem manual.

### 3.4 Instalación / mano de obra

| Dato del estudio | Uso |
|------------------|-----|
| `potenciaSistemaKwp`, `tipoProyecto` | Descripción y posible tarifa sugerida (si en el futuro hay tabla de costes por kWp). |
| `cantidadPaneles` | Opcional para descripción. |

**Regla:** Una línea “Instalación y puesta en marcha” (o “Mano de obra instalación”), cantidad 1, descripción opcional con referencia a potencia o tipo de proyecto.  
**Precio:** Por defecto 0 o valor sugerido si se define luego una regla (ej. USD por kWp); usuario completa.

### 3.5 Ingeniería

| Dato del estudio | Uso |
|------------------|-----|
| `tipoProyecto`, `potenciaSistemaKwp` | Descripción y posible tarifa. |

**Regla:** Una línea “Ingeniería y diseño” (o “Proyecto de ingeniería”), cantidad 1.  
**Precio:** 0 o valor sugerido; usuario completa.

### 3.6 Resumen de líneas sugeridas

| Orden | Tipo | Origen de datos | Precio por defecto |
|-------|------|------------------|---------------------|
| 1 | Paneles FV | cantidadPaneles, potenciaPorPanelWp | Catálogo o manual (0) |
| 2 | Inversor(es) | potenciaSistemaKwp, connectionType | Catálogo o manual (0) |
| 3 | Estructura | cantidadPaneles, mountingType | Catálogo o manual (0) |
| 4 | Instalación | potenciaSistemaKwp, tipoProyecto | Manual (0) |
| 5 | Ingeniería | tipoProyecto, potenciaSistemaKwp | Manual (0) |

Todas las líneas llevan `sortOrder` para orden coherente en la cotización.

---

## 4. Datos del estudio que alimentan cada sugerencia

Resumen en una sola tabla:

| Sugerencia | Campos FvStudy usados | Notas |
|------------|------------------------|-------|
| Paneles | `cantidadPaneles`, `potenciaPorPanelWp`, `potenciaSistemaKwp` | 1 línea; cantidad = cantidadPaneles. |
| Inversor | `potenciaSistemaKwp`, `connectionType`, `tipoProyecto` | 1 o 2 líneas según potencia. |
| Estructura | `cantidadPaneles`, `mountingType` | 1 línea. |
| Instalación | `potenciaSistemaKwp`, `tipoProyecto` | 1 línea manual. |
| Ingeniería | `tipoProyecto`, `potenciaSistemaKwp` | 1 línea manual. |

Moneda de la cotización: la misma que la del estudio (`study.currency` o Quote.currency).

---

## 5. Integración sin romper lo actual

### 5.1 Backend

- **Endpoint:** Se mantiene `POST /api/fv-studies/:id/create-quote`. Se añade un body opcional (o query) con `createWithSuggestedItems?: boolean` (default `true`).
- **Transacción:** La misma transacción que hoy: crear Quote, crear QuoteVersion, actualizar FvStudy a COTIZADO. Si `createWithSuggestedItems === true`, dentro de la misma transacción se crean los QuoteItem sugeridos y se llama a la recalculación de totales de la versión (subtotal, descuentos, IVA, total).
- **Servicio de ítems:** La lógica de “sugerir ítems” puede vivir en un método del FvStudyService que construya los payloads de ítem (manual o con productId/priceId) y use el QuoteItemsService para crearlos, o que cree directamente vía Prisma dentro de la transacción para no duplicar permisos. Se recomienda reutilizar la lógica de creación de ítem (manual o desde producto) para mantener una sola fuente de verdad de totales y snapshots.
- **Compatibilidad:** Si `createWithSuggestedItems === false` o no se envía (y se interpreta como false en una primera fase), el comportamiento es idéntico al actual: versión sin ítems.

### 5.2 Frontend

- El botón "Crear cotización desde este estudio" sigue llamando al mismo endpoint; se envía `createWithSuggestedItems: true` en el body.
- Tras la creación, la redirección va al detalle de la cotización (como ahora); el usuario verá la versión 1 con ítems ya cargados y podrá editarlos.
- Opcional: un segundo botón o enlace "Crear cotización vacía" que llame con `createWithSuggestedItems: false`.

### 5.3 Modelo de datos

- No se requieren cambios de schema. QuoteItem ya soporta ítems manuales (snapshots) y ítems desde producto (productId, precios). No es obligatorio añadir un campo `suggestedFromFvStudy` en QuoteItem; si más adelante se quiere analítica, se puede añadir un flag opcional.

---

## 6. Fases de implementación recomendadas

### Fase 1 – Base con ítems manuales (recomendada para empezar)

- **Objetivo:** Cotización con ítems sugeridos **solo como ítems manuales** (sin matching con catálogo).
- **Alcance:**
  - Endpoint `create-quote` acepta `createWithSuggestedItems` (default `true`).
  - Con `true`: después de crear Quote y QuoteVersion, se crean 5 QuoteItem en este orden: Paneles, Inversor, Estructura, Instalación, Ingeniería.
  - Cada ítem: nombre/descripción derivados del estudio, cantidad, `unitPriceSnapshot` = 0 (o un valor por defecto configurable), `currencySnapshot` = moneda del estudio.
  - Recalcular totales de la versión dentro de la transacción.
- **Ventaja:** No depende del catálogo; funciona siempre y da una propuesta base clara que el usuario completa y edita.
- **Entregable:** Crear cotización desde estudio → versión 1 con 5 líneas editables.

### Fase 2 – Matching opcional con catálogo

- **Objetivo:** Cuando exista producto adecuado en el catálogo, usar ese producto y su precio vigente para Paneles, Inversor y Estructura.
- **Alcance:**
  - Definir criterios de búsqueda: por categoría (paneles, inversores on-grid, estructuras) y atributos (potencia por panel, potencia inversor, tipo montaje).
  - Si hay match: crear QuoteItem con `productId` y precio vigente (igual que “agregar desde producto”).
  - Si no hay match: igual que Fase 1 (ítem manual con 0 o descripción).
- **Ventaja:** Propuestas con precios ya rellenados cuando el catálogo esté alineado con el estudio.

### Fase 3 – Refinamientos

- **Objetivo:** Ajustar reglas y UX.
- **Posibles mejoras:**
  - Varias líneas de inversor cuando la potencia supere un umbral.
  - Desglose de protecciones AC/DC, cables o monitoreo si se definen reglas.
  - Parámetro de configuración (ej. “solo ítems manuales” vs “intentar catálogo”) por tenant o por estudio.
  - Endpoint de preview `GET /api/fv-studies/:id/suggested-quote-items` para mostrar sugerencias antes de crear la cotización (opcional).

---

## 7. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Arquitectura | Mismo endpoint de creación; flag `createWithSuggestedItems` (default true) para incluir ítems sugeridos. |
| Ítems vs sugerencias previas | Generar ítems automáticos en la versión inicial; todo editable. |
| Paneles | 1 línea; cantidad = cantidadPaneles; descripción con potencia por panel; Fase 1 manual, Fase 2 opcional desde catálogo. |
| Inversor | 1 (o 2) líneas según potencia y connectionType; Fase 1 manual, Fase 2 matching por categoría y potencia. |
| Estructura | 1 línea según mountingType y cantidadPaneles; Fase 1 manual, Fase 2 matching por categoría. |
| Instalación / Ingeniería | Siempre ítems manuales con descripción; precio 0 o a completar. |
| Integración | Sin cambios de schema; misma transacción Quote + Version + (opcional) Items + recalc totales. |
| Fases | 1) Solo ítems manuales; 2) Matching catálogo para paneles/inversor/estructura; 3) Refinamientos y opcional preview. |

Con este diseño se puede implementar la automatización parcial de la cotización desde el Estudio FV manteniendo el flujo actual y dejando una base comercial inteligente y totalmente editable.

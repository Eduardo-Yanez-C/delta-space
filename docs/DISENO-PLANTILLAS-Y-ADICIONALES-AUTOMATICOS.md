# Diseño: Plantillas predeterminadas + Adicionales automáticos

## Objetivo

Permitir generar cotizaciones rápidas y profesionales a partir de **plantillas comerciales predefinidas** (ej. 3 kW OnGrid, 4 kW OnGrid, 6 kW OnGrid) y soportar **adicionales automáticos o sugeridos** (ej. canalización extra sobre 20 m), sin romper el flujo actual: Cliente → Estudio FV → Cotización, propuesta base desde estudio, matching con catálogo, vista previa/PDF con gráficos.

---

## Contexto actual (no romper)

- **Cotización vacía:** se puede crear desde cero (sin estudio) y luego agregar ítems manuales o desde producto.
- **Cotización desde estudio:** se crea desde un FvStudy; opcionalmente con “ítems sugeridos” (paneles, inversor, estructura, instalación, ingeniería) que pueden venir del catálogo (matching) o manuales.
- **QuoteItem:** snapshot de producto o ítem manual; sortOrder; cantidad; precios; no hay concepto hoy de “plantilla” ni “adicional”.

El nuevo bloque se construye **encima** de eso: las plantillas y los adicionales son orígenes de **generación de ítems** (o de sugerencias), no reemplazan Quote/QuoteVersion/QuoteItem.

---

## Parte 1 — Plantillas predeterminadas

### 1.1 Concepto funcional

Una **plantilla** es un “molde” comercial que define:

- **Tipo de sistema:** OnGrid, Híbrido, etc. (alineado con proyecto o uso futuro).
- **Potencia objetivo:** ej. 3, 4, 6 kW (para OnGrid); luego otros para híbrido.
- **Componentes base:** qué líneas debe tener la cotización (paneles, inversor, estructura, instalación, ingeniería, y opcionalmente otros).
- **Cantidades base:** por componente (ej. N paneles según potencia y Wp, 1 inversor, 1 estructura, etc.).
- **Reglas mínimas de ajuste:** cómo derivar cantidades a partir de la potencia (ej. paneles = redondear(potencia_kW * 1000 / Wp_por_panel)).

Con una plantilla el usuario podría:

- Crear una **cotización rápida** eligiendo “Cotización desde plantilla 4 kW OnGrid” (sin pasar por estudio), y el sistema genera una versión inicial con ítems rellenados según la plantilla (y opcionalmente matching con catálogo).
- O, en una fase posterior, **aplicar una plantilla sobre una cotización vacía** o **alinear un estudio** con una plantilla de referencia.

### 1.2 Modelado de datos (propuesta)

- **QuoteTemplate (plantilla predeterminada)**  
  Entidad nueva, configuración administrativa (solo lectura para la mayoría de usuarios en una primera fase).

  - `id`, `name` (ej. "3 kW OnGrid", "4 kW OnGrid").
  - `systemType`: String (ONGRID, HIBRIDO, etc.).
  - `targetPowerKwp`: Decimal (3, 4, 6, …).
  - `description`: opcional, texto para el usuario.
  - `active`: Boolean, para poder desactivar sin borrar.
  - `sortOrder`: para orden en selectores.

- **QuoteTemplateItem (línea base de la plantilla)**  
  Define cada “componente base” de la plantilla.

  - `id`, `quoteTemplateId`.
  - `sortOrder`: orden en la cotización generada.
  - `itemType`: Enum o String — PANELES, INVERSOR, ESTRUCTURA, INSTALACION, INGENIERIA, OTRO (extensible).
  - `quantityRule`: cómo obtener la cantidad — FIXED, DERIVED_FROM_POWER, etc.
  - `quantityFixed`: número fijo cuando la regla es FIXED (ej. 1 inversor, 1 estructura).
  - `quantityFormula`: expresión o parámetros cuando es DERIVED_FROM_POWER (ej. “potencia_kW * 1000 / Wp_panel” con redondeo; en una fase 1 se puede implementar solo “paneles = f(potencia, Wp)” y el resto fijo).
  - `productId`: opcional; si está definido, la plantilla sugiere ese producto; si no, ítem manual con nombre/descripción.
  - `productNameSnapshot`, `productDescriptionSnapshot`: texto por defecto para ítem manual cuando no hay producto o no hay match.
  - `unitPriceDefault`: opcional; precio unitario por defecto (0 si debe rellenarse o resolverse por catálogo).

Relación: una plantilla tiene N QuoteTemplateItem (ordenados por sortOrder). Al “aplicar plantilla” se crean QuoteItem en una QuoteVersion con esos datos (cantidades calculadas, snapshots, y opcionalmente matching por itemType como en el flujo estudio → cotización).

- **Integración con catálogo:**  
  Opcionalmente, al generar ítems desde plantilla se puede reutilizar la lógica de matching (paneles por Wp, inversor por kW y conexión, estructura por montaje) usando `targetPowerKwp` y parámetros por defecto (Wp por panel, connectionType, mountingType). Así la plantilla no duplica catálogo; solo define estructura y cantidades; el matching llena producto y precio cuando exista.

### 1.3 Reglas mínimas de ajuste (Fase 1)

- **Paneles:** cantidad = f(potencia objetivo, Wp por panel). Ej.: `ceil(targetPowerKwp * 1000 / potenciaPorPanelWp)`. Si no se define Wp en la plantilla, usar un valor por defecto (ej. 400 W) o dejarlo para que el usuario edite.
- **Inversor / estructura / instalación / ingeniería:** cantidad fija (1) en Fase 1; descripción y nombre desde plantilla o desde matching si se implementa.
- Más adelante: fórmulas o “quantityFormula” por tipo para otros componentes (ej. metros de canalización base).

---

## Parte 2 — Adicionales automáticos

### 2.1 Concepto funcional

Un **adicional** es un ítem comercial que se puede:

- **Agregar automáticamente** cuando se cumple una condición (ej. “canalización extra si metros > 20”).
- **Sugerir** al usuario (mostrar como opción para agregar con un clic), sin insertarlo hasta que el usuario acepte.

Cada adicional define:

- **Condición de activación:** ej. “si canalización > 20 m”, “si hay más de N paneles”, “si tipo = COMERCIAL”. En Fase 1 se puede limitar a condiciones simples (umbral numérico sobre un valor ingresado o calculado).
- **Unidad de cobro:** metro lineal, unidad, juego, etc.
- **Precio unitario:** valor por unidad (o desde catálogo si el adicional está vinculado a un producto).
- **Modo:** AUTO (se agrega al generar/aplicar cuando se cumple la condición) o SUGERIDO (se muestra como sugerencia; el usuario agrega si quiere).

### 2.2 Modelado de datos (propuesta)

- **QuoteAddOn (adicional)**  
  Configuración administrativa.

  - `id`, `name` (ej. "Canalización extra sobre 20 m").
  - `description`: texto opcional.
  - `conditionType`: String — METROS_CANALIZACION, CANTIDAD_PANELES, TIPO_PROYECTO, etc. (extensible).
  - `conditionThreshold`: valor numérico cuando aplica (ej. 20 para “sobre 20 m”).
  - `conditionParam`: opcional; nombre del parámetro (ej. “metrosCanalizacion”, “cantidadPaneles”) para no hardcodear en código.
  - `addMode`: AUTO | SUGERIDO.
  - `unit`: String (m, unidad, juego, …).
  - `unitPriceDefault`: Decimal; precio unitario por defecto.
  - `quantityRule`: cómo calcular cantidad — FIXED, EXCESS_OVER_THRESHOLD (ej. metros - 20), etc.
  - `quantityFixed`: cuando es fijo (ej. 1).
  - `productId`: opcional; si existe, se puede usar producto y precio de catálogo.
  - `productNameSnapshot`, `productDescriptionSnapshot`: para ítem manual.
  - `sortOrder`: para orden al insertar en la cotización.
  - `active`: Boolean.

- **Uso:**  
  En “aplicar plantilla” o “generar desde estudio” (o en un paso explícito “revisar adicionales”), el sistema evalúa cada QuoteAddOn activo: si la condición se cumple y el modo es AUTO, crea un QuoteItem en la versión; si es SUGERIDO, guarda la sugerencia para mostrarla en la UI (ej. “Tiene 25 m de canalización. ¿Agregar canalización extra (5 m × $X)? ”).

- **Dónde se evalúa la condición:**  
  Hace falta un **contexto** con valores: metros de canalización (ingresado o por defecto), cantidad de paneles (de plantilla o estudio), tipo de proyecto (de quote o estudio). Ese contexto puede ser un DTO o un objeto en memoria al “aplicar plantilla” o “crear desde estudio”; en Fase 1 se puede tener solo uno o dos tipos de condición (ej. metrosCanalizacion) y el resto en fases siguientes.

---

## 3. Integración con el flujo actual

### 3.1 Puntos de enganche

| Punto | Uso de plantillas | Uso de adicionales |
|-------|-------------------|---------------------|
| **Crear cotización vacía** | Opción “Desde plantilla”: el usuario elige cliente, plantilla (ej. 4 kW OnGrid) y opcionalmente moneda; el sistema crea Quote + QuoteVersion + QuoteItems según plantilla (+ matching opcional). Sustituye o complementa “Nueva cotización” sin ítems. | Tras generar ítems desde plantilla, evaluar adicionales con contexto (ej. metros = 0 o valor por defecto); si hay AUTO y se cumple condición, agregar ítems; si SUGERIDO, mostrar en UI. |
| **Crear cotización desde estudio** | No sustituye el flujo actual. Opcionalmente se podría “alinear” una plantilla al estudio (ej. elegir plantilla 6 kW para prellenar estructura de ítems) — fase posterior. | Tras crear la propuesta base desde estudio, evaluar adicionales con contexto = datos del estudio + quote (cantidad paneles, tipo proyecto, metros si se agrega campo). AUTO → insertar ítems; SUGERIDO → mostrar en panel/banner. |
| **Propuesta base desde estudio (actual)** | No cambia: sigue siendo “ítems sugeridos” desde FvStudy (paneles, inversor, estructura, instalación, ingeniería). La plantilla es un **origen alternativo** de ítems cuando no hay estudio. | Los adicionales se evalúan **después** de tener una versión con ítems (desde estudio o desde plantilla); así no se enreda la lógica de creación inicial. |

### 3.2 Flujos resultantes (resumen)

- **Flujo A — Desde estudio (actual):** Cliente → Estudio FV → Crear cotización (con ítems sugeridos + matching) → [opcional: revisar adicionales sugeridos y agregar] → editar ítems / vista previa / PDF. **Sin cambios obligatorios**; adicionales como capa posterior.
- **Flujo B — Desde plantilla (nuevo):** Cliente → Nueva cotización desde plantilla (elegir plantilla 3/4/6 kW OnGrid) → se crea Quote + Version + ítems según plantilla (+ matching opcional) → [opcional: revisar adicionales] → editar / vista previa / PDF. No toca estudios.
- **Flujo C — Cotización vacía (actual):** Sigue igual; el usuario agrega ítems a mano o desde producto. Opcionalmente en el futuro se podría “aplicar plantilla” sobre una cotización vacía existente.

Con esto no se pierde el hilo: estudio y propuesta base siguen siendo el flujo principal cuando hay estudio; las plantillas son un atajo cuando no hay estudio.

---

## 4. Dónde aplicar plantillas y adicionales

| Origen de la cotización | Aplicar plantilla | Aplicar adicionales |
|-------------------------|-------------------|----------------------|
| **Cotización vacía** | Sí: “Crear desde plantilla” genera Quote + Version + ítems desde QuoteTemplate. | Sí: tras generar ítems, evaluar adicionales con contexto (valores por defecto o preguntados en un paso previo). |
| **Desde estudio** | No obligatorio; el estudio ya define estructura y cantidades. Opcionalmente en el futuro: “usar plantilla X como base” para alinear nombres/orden. | Sí: tras crear la propuesta base (desde estudio), evaluar adicionales con contexto = estudio + quote (paneles, tipo, metros si existe). |
| **Propuesta base ya generada (desde estudio)** | No volver a aplicar plantilla; la base ya está. | Sí: en cualquier momento se puede “Revisar adicionales” sobre la versión actual (recalcular condiciones con datos actuales de la versión/quote). |

Recomendación: **plantillas** solo para generar cotización cuando **no** hay estudio (cotización rápida). **Adicionales** sobre **cualquier** versión que ya tenga ítems (generada por plantilla o por estudio), para no duplicar lógica y mantener una sola “fuente de verdad” de ítems (QuoteItem).

---

## 5. Fases recomendadas para implementar sin enredar

### Fase 1 — Plantillas predeterminadas (solo modelo y “crear desde plantilla”)

- **Backend:** Modelo `QuoteTemplate` + `QuoteTemplateItem`; CRUD básico de plantillas (solo ADMIN o rol “Plantillas”); endpoint “aplicar plantilla” que reciba clientId, templateId, moneda y cree Quote + QuoteVersion + QuoteItems desde la plantilla (cantidades fijas o derivadas solo de potencia; sin matching en Fase 1 si se quiere simplificar, o con matching reutilizando lógica actual por itemType).
- **Frontend:** En “Nueva cotización”, opción “Desde plantilla” (selector de plantilla, cliente); al confirmar, llamar al nuevo endpoint y redirigir al detalle de la cotización creada.
- **No tocar:** Crear desde estudio; matching desde estudio; vista previa/PDF.

### Fase 2 — Adicionales: modelo y evaluación

- **Backend:** Modelo `QuoteAddOn`; CRUD de adicionales (ADMIN); servicio “evaluar adicionales” que reciba quoteVersionId (o quoteId + versionId) y contexto (metros, cantidad paneles, tipo proyecto), devuelva lista de adicionales que cumplen condición y su modo (AUTO vs SUGERIDO). Endpoint opcional “aplicar adicionales automáticos” que inserte QuoteItems para los que cumplan condición y modo AUTO.
- **Frontend:** Tras crear cotización (desde plantilla o desde estudio), si hay adicionales AUTO se pueden aplicar en el mismo flujo de creación (backend) o en un paso “Revisar adicionales”; los SUGERIDO se muestran en un panel/banner en el detalle de la cotización con “Agregar” por ítem.
- **Condiciones Fase 2:** Implementar 1–2 tipos (ej. METROS_CANALIZACION con umbral; CANTIDAD_PANELES) y el resto extensible después.

### Fase 3 — Integración y refinamiento

- **Crear desde plantilla + matching:** Reutilizar lógica de matching (paneles, inversor, estructura) usando targetPowerKwp y parámetros por defecto al generar ítems desde plantilla.
- **Adicionales en flujo “crear desde estudio”:** Tras crear la propuesta base, llamar a “evaluar adicionales” y aplicar AUTO; mostrar SUGERIDO en el detalle.
- **Ajustes de plantilla:** quantityFormula o reglas por itemType (paneles = f(potencia, Wp)); más plantillas (6 kW, híbrido, etc.).

### Fase 4 (opcional) — Aplicar plantilla sobre cotización existente

- Acción “Aplicar plantilla” sobre una cotización que ya existe (vacía o con ítems): reemplazar o fusionar ítems según regla (solo si versión vacía, o preguntar). Menor prioridad.

---

## 6. Aprovechar la planilla “Items Cotización Efora.xlsx”

La planilla **Efora** se usa como **referencia externa** de estructura comercial y no se integra como archivo en el repositorio. Sí se puede usar para:

- **Estructura de ítems:** Definir los `itemType` y el orden (sortOrder) de las plantillas para que coincidan con las filas típicas de Efora (paneles, inversor, estructura, instalación, ingeniería, canalización, otros). Así las plantillas “3 kW OnGrid”, “4 kW OnGrid”, “6 kW OnGrid” reflejan la misma estructura que se usa en esa planilla.
- **Nombres y descripciones:** Usar los textos de Efora como `productNameSnapshot` y `productDescriptionSnapshot` por defecto en QuoteTemplateItem y en QuoteAddOn, para que las cotizaciones generadas se lean igual que en el formato comercial actual.
- **Adicionales:** Si en Efora hay filas como “Canalización extra (sobre X m)” o ítems condicionales, modelarlos como QuoteAddOn con conditionType y conditionThreshold; el nombre y la unidad de cobro pueden copiarse de la planilla.
- **Potencia y cantidades:** Las tablas de Efora que relacionan kW con cantidad de paneles o con inversor pueden documentar las “reglas mínimas de ajuste” (quantityRule, quantityFormula o constantes) que implementamos en QuoteTemplateItem.

Recomendación operativa: exportar de la planilla Efora una lista de ítems base (nombre, tipo, unidad, orden) y condiciones de adicionales (texto y umbral) a un documento o tabla de referencia en el repo (ej. `docs/referencia-plantilla-efora.md` o CSV); el desarrollo usa esa referencia para poblar plantillas y adicionales en seed o en datos iniciales, sin depender del .xlsx en tiempo de ejecución.

---

## 7. Resumen

| Tema | Propuesta |
|------|-----------|
| **Modelo plantillas** | QuoteTemplate (nombre, systemType, targetPowerKwp, active) + QuoteTemplateItem (itemType, quantityRule, cantidad fija o derivada, snapshots, productId opcional). |
| **Modelo adicionales** | QuoteAddOn (nombre, conditionType, conditionThreshold, addMode AUTO/SUGERIDO, unit, unitPriceDefault, quantityRule, productId opcional, active). |
| **Integración** | Plantillas = origen de ítems cuando no hay estudio (“Crear desde plantilla”). Adicionales = capa que se evalúa después de tener ítems (desde plantilla o desde estudio). |
| **Dónde aplicar** | Plantillas: solo sobre cotización generada “desde plantilla” (cotización vacía de ítems). Adicionales: sobre cualquier versión con ítems (generada por plantilla o por estudio). |
| **Fases** | 1) Plantillas modelo + crear desde plantilla. 2) Adicionales modelo + evaluación y aplicación. 3) Matching en plantillas + adicionales en flujo estudio. 4) Opcional: aplicar plantilla sobre cotización existente. |
| **Efora** | Referencia externa para estructura de ítems, nombres, descripciones, reglas de cantidad y adicionales; documentar en repo y usar para seed/datos iniciales, sin leer .xlsx en ejecución. |

Con este diseño el sistema gana cotizaciones rápidas por plantilla y adicionales automáticos o sugeridos, manteniendo intacto el flujo Cliente → Estudio FV → Cotización y la propuesta base desde estudio con matching y vista previa/PDF.

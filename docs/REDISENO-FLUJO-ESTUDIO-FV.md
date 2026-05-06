# Rediseño: Flujo comercial y módulo Estudio FV

Documento de diseño funcional y técnico para reemplazar el flujo **Cotización → Cálculo FV** por **Cliente → Estudio FV → Cotización**, y convertir el módulo FV en un **Estudio FV** completo alineado con la planilla Excel de referencia.

**Estado:** Rediseño aprobado. Ajustes incorporados; plan de implementación por fases definido. No programar hasta ejecutar el plan.

---

## 1. Nuevo flujo comercial del sistema

### 1.1 Flujo actual (a reemplazar)

```
Dashboard → Cotizaciones → [Crear cotización o abrir existente] → Detalle cotización
  → (opcional) Cálculo FV (modal asociado a una versión) → Guardar en cotización
```

- El cálculo FV es **secundario** y **dependiente** de la cotización.
- No hay artefacto “estudio” independiente ni tabla mensual de 12 meses.
- El usuario puede no tener un estudio técnico antes de armar la cotización.

### 1.2 Flujo objetivo

```
Dashboard
  → Clientes (seleccionar o crear cliente)
  → Desde cliente: "Nuevo estudio FV" o listado "Estudios FV del cliente"
  → Crear / editar Estudio FV
    · Datos generales (nombre estudio, cliente ya fijado, mes de referencia, etc.)
    · Parámetros tarifarios y técnicos
    · Tabla mensual de 12 meses (consumo, generación, ahorro, pago estimado)
    · Resultados anuales y gráficos
  → Guardar estudio
  → Desde estudio: "Crear cotización desde este estudio"
  → Se crea una cotización nueva (o se asocia a una existente) con:
    · Mismo cliente
    · Resumen del estudio (potencia, ahorro, pago residual) disponible en cabecera y PDF
```

### 1.3 Cómo entra el usuario al proceso

- **Opción A (recomendada):** Entrada principal por **Clientes**.
  - En listado de clientes: acción “Ver estudios FV” o “Nuevo estudio FV” por cliente.
  - En detalle de cliente (si se implementa vista detalle): listado de estudios del cliente + “Nuevo estudio FV”.
- **Opción B:** Menú lateral con ítem **“Estudios FV”** que lleve a un listado global (filtrable por cliente).
- Ambas pueden coexistir: menú “Estudios FV” y, desde cliente, acceso directo a estudios de ese cliente.

### 1.4 Cómo pasa de cliente a estudio

- En **Clientes**: al elegir un cliente, se ofrece “Nuevo estudio FV” (y opcionalmente “Ver estudios”).
- “Nuevo estudio FV” abre la pantalla de creación de estudio con **cliente ya seleccionado** (y no editable o solo por permiso).
- Si la entrada es por el menú “Estudios FV”, en “Nuevo estudio” se debe **elegir cliente** en el formulario.

### 1.5 Cómo pasa de estudio a cotización

- En la pantalla de **detalle (o resumen) del Estudio FV** guardado:
  - Botón **“Crear cotización desde este estudio”**.
- Acción del sistema:
  1. Crear una nueva `Quote` con el mismo `clientId` del estudio, título sugerido (ej. “Cotización – [Nombre estudio]”), tipo de proyecto y moneda tomados del estudio si aplica.
  2. Crear al menos una `QuoteVersion` inicial.
  3. Asociar la cotización al estudio (ver sección 5: `Quote.sourceFvStudyId` o equivalente).
  4. Redirigir al usuario al detalle de la cotización recién creada.
- Opcional: “Asociar a cotización existente” (elegir quote existente del mismo cliente y vincular estudio como fuente).

### 1.6 Resumen de cambios respecto del flujo actual

| Aspecto | Actual | Nuevo |
|--------|--------|--------|
| Orden lógico | Cotización primero, cálculo FV opcional | Cliente → Estudio FV → Cotización |
| Artefacto central FV | QuoteFvCalculation (atado a quote/versión) | FvStudy (independiente, asociado a cliente) |
| Tabla mensual | No existe; solo promedios/anual | 12 meses obligatorios (consumo, generación, ahorro, pago) |
| Origen de la cotización | Manual (cliente + datos) | Puede nacer “desde un estudio” con datos y resumen prellenados |
| Navegación | FV dentro de cotización | Estudios FV desde Clientes (y/o menú) → luego cotización desde estudio |

---

## 2. Propuesta de modelo de datos

### 2.1 Opciones evaluadas

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| **A. Nueva entidad FvStudy** | Crear `FvStudy` (y tablas hijas para tabla mensual). Mantener `QuoteFvCalculation` solo para “resumen en cotización” o deprecarlo. | Estudios independientes de la cotización; cliente como eje; modelo claro. | Dos conceptos (estudio vs cálculo en quote); posible duplicación de datos si se quiere resumen en quote. |
| **B. Ampliar QuoteFvCalculation** | Hacer opcional `quoteId`; agregar `clientId`; agregar tabla mensual (ej. otra entidad o JSON). | Una sola entidad. | Mezcla “estudio” con “cálculo asociado a versión”; semántica confusa; quote siempre en el centro. |

### 2.2 Recomendación: nueva entidad **FvStudy**

- **FvStudy:** entidad principal del estudio FV.
  - Pertenece a un **cliente** (`clientId`).
  - **No** depende de ninguna cotización para existir.
  - Incluye: datos generales, parámetros tarifarios y técnicos, tipo de conexión, mes de referencia, cuenta y consumo de referencia, supuestos de cálculo (HSP, PR, versión método).
  - Resultados **agregados** a nivel estudio: potencia sistema, generación anual, ahorro anual, porcentaje ahorro, pago residual anual/total, etc.
- **FvStudyMonth:** tabla hija con exactamente **12 registros por estudio**. Campo **monthIndex** entero **1 a 12** (enero = 1, diciembre = 12). **Unicidad** por estudio + mes: `@@unique([fvStudyId, monthIndex])`. Detalle en sección 4.
- **Relación con Quote:**
  - En `Quote` se agrega campo opcional `sourceFvStudyId` (FK a `FvStudy`). Cuando la cotización se crea “desde” un estudio, se rellena este campo.
  - Opcional: mantener una tabla de “resumen FV por versión” (por ejemplo una versión ligera de lo que hoy es `QuoteFvCalculation`) que se **rellene a partir del estudio** al crear la cotización o al elegir “usar este estudio en esta versión”, para no duplicar toda la lógica de presentación en PDF/vista previa. Alternativa: en vista previa/PDF leer directamente del `FvStudy` enlazado vía `Quote.sourceFvStudyId` y mostrar un subconjunto de campos.

Con esto se logra:
- Estudios **independientes** de la cotización.
- Estudios **asociados a cliente**.
- **Crear cotización desde un estudio** y dejar el vínculo explícito (`sourceFvStudyId`).
- Reutilizar lógica de cálculo donde aplique (ver sección 6).

### 2.3 Estado del estudio FV

El estudio tendrá un campo **status** con los siguientes valores:

| Valor       | Descripción breve |
|------------|--------------------|
| **DRAFT**  | Borrador; en edición; puede modificarse libremente. |
| **VALIDADO** | Estudio revisado/validado; listo para usar como base de cotización. |
| **COTIZADO** | Ya se creó al menos una cotización desde este estudio. |
| **ARCHIVADO** | Estudio cerrado o sustituido por otro; solo lectura. |

- Transiciones y permisos por rol se definirán en implementación (ej. solo ciertos roles pueden pasar a VALIDADO o ARCHIVADO).
- Al **crear cotización desde estudio**, el estudio puede pasar a COTIZADO si se desea (o permanecer VALIDADO y marcar COTIZADO cuando exista al menos una Quote con `sourceFvStudyId = id`).

---

## 3. Estructura del Estudio FV

El estudio debe reflejar la planilla Excel y cubrir:

### 3.1 Datos generales

- Nombre o título del estudio (ej. “Estudio Casa García – Ene 2025”).
- Cliente (siempre presente; asignado al crear desde cliente o seleccionado en “Nuevo” desde menú).
- Fecha de creación / última modificación.
- Mes de referencia (1–12): mes de la cuenta y consumo de referencia.
- Cuenta mensual de referencia (monto).
- Consumo de referencia (kWh) — del mes de referencia; puede usarse para validar o prellenar la tabla.

### 3.2 Parámetros tarifarios

- Valor kWh consumo (moneda/kWh).
- Valor kWh inyección (moneda/kWh).
- Moneda (USD, CLP, etc.).

### 3.3 Parámetros técnicos

- Potencia del sistema (kWp) — puede ser entrada directa o resultado del cálculo según cobertura.
- Potencia por panel (Wp).
- Cobertura deseada (%).
- Tipo de proyecto (RESIDENCIAL, COMERCIAL, INDUSTRIAL).
- Supuestos de cálculo: HSP diario, performance ratio, versión del método (para trazabilidad).

### 3.4 Tipo de conexión

- **Monofásico / Trifásico** (campo **connectionType**, valores: `MONOFASICO`, `TRIFASICO`).
- Definido como **campo funcional futuro**, no solo decorativo: en el modelo y en la UI se trata como dato de negocio; la lógica de tarifas, límites de inyección o validaciones técnicas podrá usar `connectionType` en futuras iteraciones (catálogo de tarifas por tipo de conexión, límites monofásico/trifásico, etc.). En la primera implementación puede no haber impacto en fórmulas, pero el campo debe existir y persistirse.
- Impacto en modelo, UI y evolución: ver sección 7.

### 3.5 Tabla mensual (obligatoria)

- 12 registros (uno por mes): ver sección 4.
- Incluye: consumo mensual kWh, valor consumo, generación mensual kWh, valor generación, ahorro porcentual mensual, pago mensual estimado.

### 3.6 Resultados anuales

- Totales y promedios derivados de la tabla mensual:
  - Consumo anual kWh, generación anual kWh.
  - Ahorro anual (monto), porcentaje ahorro anual.
  - Pago total estimado anual (suma de 12 pagos mensuales).
- Potencia sistema (kWp), cantidad de paneles (si aplica).

### 3.7 Gráficos mensuales

- Generación vs consumo por mes (barras o líneas).
- Ahorro mensual (% o monto).
- Detalle económico: pago mensual estimado a lo largo del año (y opcionalmente cuenta actual si se tiene por mes).
- Estos se calculan o almacenan para visualización; no es estrictamente obligatorio persistir el gráfico, sino los datos que lo alimentan (tabla mensual + totales).

---

## 4. Tabla mensual del estudio

### 4.1 Modelo propuesto: tabla hija **FvStudyMonth**

Una entidad con 12 filas por estudio (una por mes del año de referencia).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | String (cuid) | PK |
| fvStudyId | String | FK FvStudy |
| monthIndex | Int | 1–12 (enero = 1, diciembre = 12) |
| consumptionKwh | Float | Consumo mensual kWh |
| consumptionValue | Float? | Valor consumo mensual (moneda) |
| generationKwh | Float | Generación mensual estimada kWh |
| generationValue | Float? | Valor generación (autoconsumo + inyección valorizada) |
| savingsPercent | Float? | Ahorro porcentual mensual |
| estimatedPayment | Float? | Pago mensual estimado (cuenta − ahorro) |

- **monthIndex:** entero de **1 a 12** (1 = enero, 12 = diciembre). Obligatorio.
- **Unicidad:** un estudio tiene como máximo un registro por mes. En Prisma: `@@unique([fvStudyId, monthIndex])`. No puede haber dos filas con el mismo `fvStudyId` y `monthIndex`.
- Al guardar el estudio, el backend recalcula o valida que existan exactamente 12 registros (uno por cada monthIndex 1..12).
- Los valores monetarios y porcentajes se pueden derivar en backend a partir de consumo/generación y tarifas; si la planilla permite edición manual por mes, se podrían permitir overrides (fase posterior).

### 4.2 Origen de los datos por mes

- **Consumo:** El usuario ingresa los 12 consumos mensuales (kWh). Es el insumo principal que diferencia el estudio del “solo promedio” actual.
- **Generación:** Se calcula por mes. En una primera versión puede ser `generacionAnualKwh / 12` (reparto uniforme); más adelante, factores mensuales de irradiación (HSP por mes) para reparto real.
- **Valor consumo, valor generación, ahorro %, pago estimado:** Calculados en backend a partir de tarifas (valor kWh consumo, valor kWh inyección) y lógica de autoconsumo/excedente por mes.

### 4.3 Flujo de guardado

1. Usuario completa datos generales, tarifarios, técnicos y **los 12 consumos mensuales** (obligatorio).
2. Backend calcula generación por mes (inicialmente anual/12 o con factores mensuales si se implementan).
3. Backend calcula por cada mes: valor consumo, valor generación, ahorro %, pago estimado.
4. Backend persiste `FvStudy` y los 12 `FvStudyMonth`.
5. Totales anuales y promedios se derivan de la tabla mensual (o se guardan denormalizados en `FvStudy` para consulta rápida).

---

## 5. Relación con cotización

### 5.1 Cómo un estudio crea una cotización

- Acción en UI: “Crear cotización desde este estudio”.
- Backend (o frontend con llamadas API):
  1. Crear `Quote` con:
     - `clientId` = `fvStudy.clientId`
     - `title` = sugerido por estudio (ej. “Cotización – [nombre estudio]”)
     - `projectType` = `fvStudy.tipoProyecto`
     - `currency` = `fvStudy.currency`
     - `sourceFvStudyId` = `fvStudy.id`
  2. Crear primera `QuoteVersion` (ej. versión 1, BORRADOR).
  3. Opcional: crear un “resumen FV” en esa versión (snapshot ligero o referencia al estudio) para que vista previa/PDF no dependan solo de leer el estudio completo.

- **Obligatorio:** La cotización se crea **sin ítems**. El resumen FV en vista previa/PDF se obtiene leyendo el `FvStudy` enlazado por `sourceFvStudyId`. No crear ítems automáticamente (ver Fase 4 del plan).

### 5.2 Cómo queda vinculada la cotización al estudio

- Campo en `Quote`: `sourceFvStudyId` (FK a `FvStudy`, opcional).
- Si existe: la cotización se creó a partir de ese estudio; en detalle de cotización y en PDF se puede mostrar “Basado en Estudio FV: [nombre]” y un resumen del estudio.

### 5.3 Qué información del estudio se muestra en cotización y PDF

- En **cabecera o bloque “Resumen FV”** de la cotización (y en vista previa/PDF):
  - Potencia del sistema (kWp).
  - Cantidad de paneles (si aplica).
  - Generación anual estimada (kWh).
  - Ahorro anual estimado (monto y/o %).
  - Pago residual estimado (anual o mensual promedio).
  - Texto tipo “Basado en Estudio FV: [nombre estudio]” (opcional).
- No es necesario volcar los 12 meses en el PDF de la cotización; el detalle mensual queda en la pantalla del Estudio FV. Si se desea, se puede ofrecer un “Anexo estudio FV” (tabla mensual + gráficos) como segunda página o documento aparte.

---

## 6. Reutilización de lo ya implementado

### 6.1 Qué se puede reutilizar

- **Lógica de cálculo “anual/promedio”:**
  - Resolución consumo anual vs mensual (`resolveConsumption`).
  - Cálculo de planta kWp a partir de cobertura, HSP, PR, potencia por panel.
  - Cantidad de paneles, generación anual, ahorro por autoconsumo + inyección, pago residual, porcentaje ahorro.
  - Todo ello en `fv-calculation.service.ts` (backend) y `lib/fv-calculation.ts` (frontend) sirve como **núcleo** para:
    - Calcular totales del estudio a partir de consumos mensuales (suma de consumos = consumo anual; generación anual con misma fórmula; luego reparto mensual de generación si se usa anual/12).
    - Rellenar resultados agregados del `FvStudy` y, si se mantiene, el resumen en cotización.
- **Componentes de presentación:**
  - Gráficos Recharts (generación vs consumo, pago actual vs con FV) se pueden reutilizar o adaptar para la **vista mensual** del estudio (datos por mes).
  - Componente de KPIs (kWp, paneles, ahorro anual, % ahorro, pago residual) útil tanto en detalle del estudio como en resumen en cotización/PDF.
- **Permisos y roles:** Misma matriz; se añade permiso “acceso/crear/editar estudios FV” por rol (ej. ADMIN, VENTAS, INGENIERIA con edición; LECTURA solo lectura).
- **Estilo y layout:** Cards, formularios, tablas y navegación existentes; nueva sección “Estudios FV” o flujo desde Clientes con el mismo look & feel.

### 6.2 Qué debe cambiar

- **Modelo de datos:**
  - Nueva entidad `FvStudy` (y `FvStudyMonth`).
  - En `Quote`, campo opcional `sourceFvStudyId`.
  - Decisión sobre `QuoteFvCalculation`: mantener solo para “resumen por versión” rellenado desde estudio, o eliminar y leer todo desde `FvStudy` cuando `Quote.sourceFvStudyId` esté definido.
- **Flujo de negocio:**
  - Estudios FV como primer ciudadano: pantallas de listado (por cliente o global), creación y edición de estudio con tabla de 12 meses.
  - Creación de cotización “desde estudio” (nuevo caso de uso) en lugar de “cálculo FV dentro de cotización”.
- **Cálculo:**
  - Entrada: 12 consumos mensuales (y opcionalmente 12 factores de generación si se implementan).
  - Salida: 12 filas con generación, ahorro, pago por mes; más totales anuales.
- **API:**
  - Nuevos endpoints: CRUD de `FvStudy` (y persistencia de `FvStudyMonth` junto con el estudio), “crear cotización desde estudio”.
  - Endpoints actuales de “cálculo FV por quote/versión” pueden mantenerse temporalmente para no romper la cotización existente y migrar después, o deprecarse y que el resumen en quote venga del estudio vinculado.

### 6.3 Migración sin perder lo construido

- **Estrategia recomendada:**
  1. **Fase 1:** Implementar `FvStudy` + `FvStudyMonth` y flujo Cliente → Estudio FV (crear/editar/listar) sin tocar aún la cotización.
  2. **Fase 2:** Añadir “Crear cotización desde estudio” y `Quote.sourceFvStudyId`; en vista previa/PDF de la cotización, si existe `sourceFvStudyId`, mostrar resumen leyendo del `FvStudy`.
  3. **Fase 3:** Decidir si se mantiene el “Cálculo FV” actual dentro del detalle de cotización como atajo (crear un estudio “rápido” desde la cotización y asociarlo) o se elimina y todo pasa por Estudios FV. Si se mantiene, puede crear un `FvStudy` en segundo plano y asociarlo a la quote.
- **Datos existentes:** Las cotizaciones que ya tienen `QuoteFvCalculation` pueden seguir mostrando ese resumen hasta que se migren o se reasocie un estudio. No es obligatorio migrar registros antiguos de `QuoteFvCalculation` a `FvStudy`; se puede tratar como histórico.

---

## 7. Impacto de monofásico / trifásico

### 7.1 Modelo de datos

- En `FvStudy` (o en parámetros del estudio): campo **connectionType** (string o enum), valores `MONOFASICO`, `TRIFASICO`.
- No es necesario en `FvStudyMonth`; el tipo de conexión es atributo del estudio completo.

### 7.2 UI

- En el formulario del Estudio FV: selector o radio “Tipo de conexión” con opciones Monofásico / Trifásico (y etiquetas claras).
- Puede mostrarse en resumen del estudio y, si se desea, en el bloque “Resumen FV” de la cotización/PDF (“Conexión: Monofásica”).

### 7.3 Lógica de precios o cálculo

- **Tarifas:** En algunos mercados el valor kWh o la estructura tarifaria difiere entre monofásico y trifásico. Si aplica:
  - Guardar tipo de conexión y usarlo para elegir o sugerir valor kWh consumo / inyección (por ejemplo, desde catálogo de tarifas por tipo de conexión en el futuro).
  - Por ahora puede ser solo informativo; los campos “valor kWh consumo” e “inyección” siguen siendo ingresados por el usuario y el cálculo de ahorro no cambia de fórmula.
- **Límites técnicos o de inyección:** Si en el futuro se consideran límites de inyección distintos (mono vs tri), el tipo de conexión podría afectar validaciones o mensajes; no es obligatorio en MVP del estudio.

### 7.4 Visualización del estudio

- Mostrar “Conexión: Monofásico” o “Trifásico” en la ficha del estudio y, si se incluye resumen en cotización/PDF, en ese bloque.
- No implica cambios en la tabla mensual ni en los gráficos salvo que se quiera etiquetar gráficos o anexos con el tipo de conexión.

---

## 8. Resumen ejecutivo

- **Flujo:** Cliente → Estudio FV (con tabla de 12 meses, parámetros tarifarios/técnicos, tipo de conexión) → desde estudio, “Crear cotización”.
- **Modelo:** Nueva entidad `FvStudy` (asociada a cliente) + tabla hija `FvStudyMonth` (12 meses). Quote con `sourceFvStudyId` opcional.
- **Estudio FV:** Alineado con la planilla Excel: datos generales, tarifas, técnica, monofásico/trifásico, tabla mensual obligatoria, totales y gráficos mensuales.
- **Reutilización:** Lógica actual de cálculo (kWp, paneles, ahorro, pago residual) y componentes de KPIs/gráficos se reutilizan o adaptan; nuevo flujo y nuevos modelos para estudios independientes.
- **Migración:** Introducir estudios primero; luego “crear cotización desde estudio” y resumen en PDF desde estudio; después decidir destino del cálculo FV actual dentro de la cotización.

Con este rediseño se unifica el flujo comercial (Cliente → Estudio FV → Cotización) y se eleva el módulo FV a un Estudio FV real con tabla mensual y tipo de conexión.

**Ajustes incorporados (aprobados):**
- Estado del estudio: DRAFT, VALIDADO, COTIZADO, ARCHIVADO (sección 2.3).
- FvStudyMonth: monthIndex 1 a 12; unicidad por estudio + mes explícita (sección 4.1).
- Crear cotización desde estudio: crear Quote, versión inicial, vincular sourceFvStudyId, llevar resumen FV, **no crear ítems automáticamente** (sección 5.1).
- QuoteFvCalculation convive temporalmente; flujo preferente es FvStudy (sección 2.2 y Fase 5 del plan).
- connectionType (MONOFASICO/TRIFASICO) definido como campo funcional futuro, no solo decorativo (secciones 3.4 y 7.3).

---

## 9. Plan de implementación por fases

Orden de ejecución: **1 → 2 → 3 → 4 → 5**. No programar hasta aprobar este plan.

---

### Fase 1: Modelo de datos y migraciones

**Objetivo:** Definir en Prisma las entidades FvStudy y FvStudyMonth, agregar sourceFvStudyId a Quote, y aplicar migración sin romper datos existentes.

**Archivos a tocar:**
- `apps/api/prisma/schema.prisma`

**Cambios:**
1. Crear modelo **FvStudy** con: id, clientId (FK Client), status (String: DRAFT, VALIDADO, COTIZADO, ARCHIVADO), nombre/título, referenceMonth (Int 1-12), referenceBillAmount, referenceConsumptionKwh, valorKwhConsumo, valorKwhInyeccion, currency, connectionType (String: MONOFASICO, TRIFASICO), tipoProyecto, potenciaSistemaKwp, potenciaPorPanelWp, coberturaDeseada, hspDailyUsed, performanceRatioUsed, calculationMethodVersion, cantidadPaneles, generacionAnualKwh, ahorroAnual, porcentajeAhorro, pagoResidualAnual (o equivalente), ownerId (FK User opcional), createdAt, updatedAt. Relación con Client, con User (owner), con FvStudyMonth (months), y con Quote (quotesSource).
2. Crear modelo **FvStudyMonth** con: id, fvStudyId (FK FvStudy), monthIndex (Int, 1-12), consumptionKwh, consumptionValue (Float?), generationKwh, generationValue (Float?), savingsPercent (Float?), estimatedPayment (Float?). Índice único @@unique([fvStudyId, monthIndex]). Relación con FvStudy.
3. En **Quote**: agregar sourceFvStudyId (String?, FK FvStudy, opcional). Relación inversa sourceFvStudy (FvStudy?).
4. En **Client**: relación fvStudies (FvStudy[]).

**Migración:**
- `npx prisma migrate dev --name add_fv_study_and_quote_source` (desde apps/api).
- Verificar que QuoteFvCalculation y el resto del schema no se modifican salvo lo indicado.

**Cómo probar:**
- `npx prisma validate`
- `npx prisma generate`
- Inspeccionar la base (SQLite): tablas FvStudy y FvStudyMonth creadas; columna sourceFvStudyId en Quote. Las cotizaciones existentes siguen sin sourceFvStudyId (null).

---

### Fase 2: Backend de estudios FV

**Objetivo:** API REST para CRUD de FvStudy y persistencia de los 12 FvStudyMonth; cálculo de generación/ahorro por mes y totales; permisos por rol.

**Archivos a crear/tocar:**
- `apps/api/src/modules/fv-study/` (nuevo módulo)
  - `fv-study.module.ts`
  - `fv-study.controller.ts` (endpoints listados abajo)
  - `fv-study.service.ts` (lógica de negocio, cálculo mensual y totales)
  - `dto/create-fv-study.dto.ts`, `dto/update-fv-study.dto.ts` (campos del estudio + array de 12 consumos o 12 meses)
  - Validación: 12 meses con monthIndex 1..12, consumos obligatorios
- `apps/api/src/app.module.ts` (importar FvStudyModule)
- Reutilizar lógica de `apps/api/src/modules/fv-calculation/fv-calculation.service.ts` para fórmulas (kWp, generación anual, ahorro) y adaptar para reparto mensual (generación mensual = anual/12 en v1).

**Endpoints propuestos:**

| Método | Ruta | Descripción | Permisos |
|--------|------|-------------|----------|
| GET | /api/fv-studies | Listado (filtros: clientId, status) | Ver estudios (ej. ADMIN, VENTAS, INGENIERIA, LECTURA) |
| GET | /api/fv-studies/:id | Detalle estudio + 12 meses | Idem |
| POST | /api/fv-studies | Crear estudio (body: datos generales + 12 consumos mensuales) | Crear (ADMIN, VENTAS?) |
| PATCH | /api/fv-studies/:id | Actualizar estudio (y recalcular meses/totales) | Editar (ADMIN, VENTAS?) |
| DELETE | /api/fv-studies/:id | Soft-delete o borrado (según regla) | Admin o dueño |
| GET | /api/clients/:id/fv-studies | Estudios de un cliente | Ver estudios |

**Lógica del servicio:**
- Al crear/actualizar: recibir 12 consumos (por monthIndex 1..12). Calcular generación por mes (v1: generacionAnualKwh/12). Calcular por mes: consumptionValue, generationValue, savingsPercent, estimatedPayment. Persistir FvStudy y 12 FvStudyMonth. Actualizar totales en FvStudy (generacionAnualKwh, ahorroAnual, etc.).

**Cómo probar:**
- Con API levantada: crear un estudio vía POST con clientId existente y 12 consumos; GET por id y ver 12 meses; PATCH y ver recálculo. Listar por clientId y por status.

---

### Fase 3: Frontend de estudios FV

**Objetivo:** Pantallas para listar estudios (global y por cliente), crear estudio, editar estudio, ver detalle con tabla mensual y gráficos. Navegación desde Clientes y/o menú lateral.

**Archivos a crear/tocar:**
- `apps/web/app/estudios-fv/` (o `estudios-fv/`)
  - `page.tsx` (listado con filtros clientId, status)
  - `nueva/page.tsx` (crear; selector de cliente si no viene de cliente)
  - `[id]/page.tsx` (detalle: datos del estudio, tabla 12 meses, gráficos, botón "Crear cotización desde este estudio")
  - `[id]/editar/page.tsx` (editar estudio y 12 consumos)
- `apps/web/app/clientes/` (ClientesList o detalle cliente): enlace "Nuevo estudio FV" (y opcional "Ver estudios") que lleve a nueva con clientId en query o a listado filtrado por cliente.
- `apps/web/components/layout/Sidebar.tsx`: ítem "Estudios FV" (visible según permiso).
- `apps/web/lib/api.ts`: tipos FvStudy, FvStudyMonth; funciones fetchFvStudies, fetchFvStudy(id), createFvStudy, updateFvStudy, fetchFvStudiesByClient(clientId).
- `apps/web/lib/useCan.ts`: recurso `fvStudy` con acciones access, read, create, edit (según matriz de roles).
- Componentes de formulario: datos generales, tarifarios, técnicos, connectionType (MONOFASICO/TRIFASICO), tabla de 12 meses (inputs consumo por mes). Reutilizar componentes de KPIs y gráficos (Recharts) adaptados a datos mensuales.

**Cómo probar:**
- Desde menú ir a Estudios FV; crear estudio eligiendo cliente e ingresando 12 consumos; guardar; ver detalle con tabla y gráficos. Desde listado de clientes, "Nuevo estudio FV" con cliente pre-seleccionado. Editar estudio y ver recálculo.

---

### Fase 4: Crear cotización desde estudio

**Objetivo:** Botón en detalle del estudio que llame a un endpoint (o composición de endpoints) que cree Quote + QuoteVersion inicial, asigne sourceFvStudyId, y redirija al detalle de la cotización. Vista previa/PDF de la cotización muestran resumen FV leyendo del FvStudy cuando sourceFvStudyId existe.

**Archivos a crear/tocar:**
- **Backend:** `apps/api/src/modules/fv-study/fv-study.controller.ts` (o quotes): endpoint POST `/api/fv-studies/:id/create-quote` que cree Quote (clientId, title, projectType, currency, sourceFvStudyId), cree QuoteVersion inicial (versión 1, BORRADOR, totales 0), devuelva la quote creada. No crear ítems.
- **Backend:** `apps/api/src/modules/quotes/` (o fv-study): endpoint GET que, dado quoteId, si tiene sourceFvStudyId devuelva resumen del FvStudy para cabecera/PDF (o el frontend llama GET /api/fv-studies/:id y toma lo necesario).
- **Frontend:** `apps/web/app/estudios-fv/[id]/page.tsx`: botón "Crear cotización desde este estudio" que llame al endpoint de creación, reciba quoteId y redirija a `/cotizaciones/[quoteId]`.
- **Frontend:** `apps/web/app/cotizaciones/[id]/CotizacionVistaPrevia.tsx` (y donde se muestre resumen FV): si `quote.sourceFvStudyId` existe, obtener resumen del FvStudy (GET /api/fv-studies/:sourceFvStudyId o datos ya incluidos en quote) y mostrar bloque "Resumen FV" con potencia, generación anual, ahorro anual, pago residual, texto "Basado en Estudio FV: [nombre]". Si no existe sourceFvStudyId, mantener comportamiento actual (resumen desde QuoteFvCalculation si existe para la versión).

**Cómo probar:**
- En detalle de un estudio, pulsar "Crear cotización desde este estudio"; ver que se crea cotización con mismo cliente, sin ítems, con sourceFvStudyId; abrir vista previa/PDF y ver resumen FV del estudio.

---

### Fase 5: Estrategia de convivencia o migración respecto a QuoteFvCalculation

**Objetivo:** Dejar explícito cómo convive el flujo antiguo (Cálculo FV en cotización) con el nuevo (Estudio FV → Cotización). Sin eliminar QuoteFvCalculation en esta fase.

**Decisiones a documentar e implementar:**
1. **Convivencia:** El módulo actual de "Cálculo FV" (modal en detalle de cotización, QuoteFvCalculation) se mantiene operativo. Los usuarios pueden seguir guardando un cálculo FV en una versión de cotización sin pasar por un Estudio FV. El **flujo preferente** y recomendado en UI es: Cliente → Estudio FV → Crear cotización.
2. **Prioridad de visualización:** En detalle de cotización y vista previa/PDF: si la quote tiene `sourceFvStudyId`, mostrar resumen desde FvStudy (y opcionalmente indicar "Cotización basada en Estudio FV"). Si no tiene sourceFvStudyId pero la versión tiene QuoteFvCalculation, mostrar resumen desde QuoteFvCalculation (comportamiento actual).
3. **Menú y navegación:** Promover en la UI el acceso a "Estudios FV" (desde Clientes y menú). El botón "Cálculo FV" en detalle de cotización puede conservarse con una nota tipo "Para un estudio completo con tabla mensual, use Estudios FV desde el cliente".
4. **Futuro:** En una fase posterior se puede: (a) deprecar el modal Cálculo FV en cotización y que "Cálculo FV" cree un FvStudy y lo asocie; (b) o eliminar QuoteFvCalculation y leer siempre desde FvStudy cuando exista sourceFvStudyId, manteniendo QuoteFvCalculation solo para cotizaciones antiguas sin estudio.

**Archivos a tocar:**
- Documentación (este documento o README): registrar la estrategia.
- Frontend: en pantalla de cotización o en tooltip/label del botón "Cálculo FV", texto que indique que el flujo recomendado es Estudio FV. Opcional: en listado de cotizaciones mostrar icono o badge cuando la cotización tiene sourceFvStudyId.

**Cómo probar:**
- Crear cotización "a mano" (sin estudio) y guardar Cálculo FV en una versión: sigue funcionando. Crear cotización desde estudio: resumen desde FvStudy. Ambos flujos coexisten.

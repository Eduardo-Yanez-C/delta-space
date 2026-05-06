# Fase 5 — Convivencia y transición: Estudio FV vs Cálculo FV en cotización

## Objetivo

Dejar claro en la UI y en la lógica que el **flujo preferente** es:

**Cliente → Estudio FV → Cotización**

manteniendo de forma temporal **QuoteFvCalculation** (cálculo FV dentro de cotización) para no romper lo existente.

---

## 1. Propuesta funcional de convivencia

### 1.1 Dos orígenes posibles del resumen FV

| Origen | Cuándo se usa | Dónde se muestra |
|--------|----------------|-------------------|
| **FvStudy** (estudio FV) | La cotización tiene `sourceFvStudyId` (fue creada “desde estudio”). | Detalle de cotización, vista previa y PDF. El resumen se obtiene del estudio vinculado. |
| **QuoteFvCalculation** (cálculo en cotización) | La cotización no tiene `sourceFvStudyId` y el usuario guardó un cálculo desde el modal “Cálculo FV” en una versión. | Detalle de cotización, vista previa y PDF. El resumen se obtiene del registro QuoteFvCalculation. |

Regla estricta: **nunca se muestran los dos resúmenes a la vez**. Siempre un solo origen por cotización/versión:

- Si existe `sourceFvStudyId` → se usa **solo** el estudio (en detalle y en vista previa/PDF).
- Si no existe `sourceFvStudyId` → se usa **solo** QuoteFvCalculation si existe para la versión.

### 1.2 Comportamiento por tipo de cotización

**Cotización creada desde estudio (`sourceFvStudyId` presente)**

- Resumen FV en detalle y en vista previa/PDF: datos del **FvStudy** (fetch del estudio cuando haga falta).
- El botón “Cálculo FV” del detalle **no** debe permitir “pisar” el origen: se deshabilita o se oculta, con texto/tooltip que explique que el resumen viene del estudio y que debe editarse el estudio si se quieren cambiar datos.
- Mensajes/labels: “Resumen FV (desde estudio)” y “Basado en Estudio FV: [título]” con enlace al estudio (ya implementado en cabecera).

**Cotización creada a mano (sin `sourceFvStudyId`)**

- Resumen FV: **QuoteFvCalculation** si existe para la versión actual (comportamiento actual).
- El botón “Cálculo FV” sigue activo: abrir modal, guardar/actualizar cálculo.
- Mensajes/labels: “Resumen FV (cálculo en cotización)” o “Resumen cálculo FV” y, opcionalmente, un texto breve que invite al flujo recomendado: “Para un estudio completo con 12 meses, use Estudios FV desde el cliente.”

### 1.3 Flujo recomendado visible en la UI

- **Dashboard:** Sin cambios mayores; el enlace a “Estudios FV” (si existe) ya orienta al flujo nuevo.
- **Sidebar:** Orden sugerido: Clientes, **Estudios FV**, Cotizaciones (Estudios FV antes de Cotizaciones refuerza “primero estudio, luego cotización”).
- **Listado de cotizaciones:** Badge o icono “Desde estudio” (o “Estudio FV”) en las filas con `sourceFvStudyId`, para distinguir de las cotizaciones “solo cálculo FV”.
- **Detalle de cotización:** Según tenga o no `sourceFvStudyId`, un único bloque de resumen FV con el origen bien indicado (estudio vs cálculo en cotización) y el botón “Cálculo FV” habilitado solo cuando no hay estudio.

---

## 2. Cambios de textos, labels y botones

### 2.1 Detalle de cotización (`CotizacionDetalleView`)

| Situación | Título del bloque | Contenido del bloque | Botón “Cálculo FV” |
|-----------|-------------------|----------------------|---------------------|
| Cotización **con** `sourceFvStudyId` | “Resumen FV (desde estudio)” | KPIs del estudio (planta kWp, paneles, ahorro anual, % ahorro, pago residual). Texto: “Basado en Estudio FV: [título]” con enlace al estudio. | **Oculto** o **deshabilitado** con tooltip: “El resumen FV proviene del estudio vinculado. Para modificar, edite el estudio.” |
| Cotización **sin** `sourceFvStudyId` | “Resumen FV (cálculo en cotización)” | Si hay QuoteFvCalculation: KPIs actuales. Si no: “Sin cálculo FV. Puede agregar uno con el botón inferior. Para un estudio completo con 12 meses, use Estudios FV desde el cliente.” | **Visible**: “Cálculo FV” o “Abrir cálculo FV” / “Ver detalle” según haya o no cálculo guardado. |

### 2.2 Vista previa / PDF

- Ya implementado: si hay `sourceFvStudyId` se usa solo el estudio; si no, solo QuoteFvCalculation.
- Textos a mantener o afinar:
  - Con estudio: “Basado en Estudio FV: [título del estudio]” en el bloque “Resumen fotovoltaico”.
  - Con cálculo: sin leyenda de estudio; opcional “Cálculo FV en cotización” si se quiere dejar explícito.

### 2.3 Modal “Cálculo FV” (`CalculoFvModal`)

- Título o pie del modal: texto breve tipo “Cálculo rápido en cotización. Para un estudio completo con tabla de 12 meses, use **Estudios FV** desde el cliente.”
- No cambiar la lógica de guardado; solo refuerzo de mensaje hacia el flujo preferente.

### 2.4 Listado de cotizaciones

- Columna o badge: “Desde estudio” / “Estudio FV” (o icono) cuando `quote.sourceFvStudyId` exista, para distinguir el origen sin abrir la cotización.

### 2.5 Nueva cotización (opcional)

- En “Nueva cotización” o en el listado: texto corto tipo “Recomendado: crear primero un Estudio FV desde el cliente y luego crear la cotización desde ese estudio.”

---

## 3. Archivos a tocar

### 3.1 Frontend

| Archivo | Cambio propuesto |
|---------|------------------|
| `app/cotizaciones/[id]/CotizacionDetalleView.tsx` | (1) Si `quote.sourceFvStudyId`: cargar estudio (`fetchFvStudy`) y mostrar sus KPIs en el bloque “Resumen FV”; título “Resumen FV (desde estudio)”; ocultar o deshabilitar botón “Cálculo FV” con tooltip. (2) Si no `sourceFvStudyId`: mantener fetch de `QuoteFvCalculation` y bloque actual; título “Resumen FV (cálculo en cotización)”; en estado vacío, mensaje que invite a usar Estudios FV para estudio completo. |
| `app/cotizaciones/[id]/CalculoFvModal.tsx` | Añadir una línea de texto (título o pie): “Cálculo rápido en cotización. Para estudio completo con 12 meses, use Estudios FV desde el cliente.” |
| `app/cotizaciones/CotizacionesList.tsx` | Incluir en la respuesta de listado `sourceFvStudyId` (o ya viene en quote) y mostrar badge/icono “Desde estudio” cuando exista. |
| `components/layout/Sidebar.tsx` | (Opcional) Ordenar ítems: Clientes, Estudios FV, Cotizaciones, para reforzar el flujo recomendado. |

### 3.2 Backend

- **Ningún cambio obligatorio** en esta fase. El listado de cotizaciones ya puede devolver `sourceFvStudyId` (y opcionalmente `sourceFvStudy: { id, title }`) si el endpoint de listado incluye esa relación; si no, el frontend puede usar solo `sourceFvStudyId` para el badge.

### 3.3 Documentación

| Archivo | Cambio |
|---------|--------|
| `docs/REDISENO-FLUJO-ESTUDIO-FV.md` o este doc | Actualizar la sección “Fase 5” con la estrategia final (convivencia, prioridad, mensajes y archivos tocados). |

---

## 4. Cuándo se usa FvStudy y cuándo QuoteFvCalculation

| Criterio | FvStudy | QuoteFvCalculation |
|----------|---------|---------------------|
| **Condición** | La cotización tiene `sourceFvStudyId`. | La cotización no tiene `sourceFvStudyId` y existe un registro QuoteFvCalculation para la versión (o la quote). |
| **Detalle de cotización** | Mostrar resumen del estudio (fetch por `sourceFvStudyId`). No mostrar modal “Cálculo FV” como origen del resumen. | Mostrar resumen del cálculo guardado; botón “Cálculo FV” para abrir/editar. |
| **Vista previa / PDF** | Usar solo datos del estudio (ya implementado). | Usar solo datos de QuoteFvCalculation (ya implementado). |
| **Origen del dato** | GET `/api/fv-studies/:id` (o resumen incluido en quote). | GET cálculo por quote/versión (existente). |

---

## 5. Cómo evitar confusión

1. **Un solo origen visible:** En detalle y en vista previa solo se muestra un bloque “Resumen FV”, con una sola fuente (estudio o cálculo), nunca ambos.
2. **Etiquetado del origen:** Siempre que se muestre el resumen FV, indicar el origen: “(desde estudio)” o “(cálculo en cotización)” y, si aplica, “Basado en Estudio FV: [título]” con enlace.
3. **Botón “Cálculo FV”:** Cuando la cotización viene de un estudio, no permitir que el usuario piense que puede “reemplazar” el resumen desde el modal; por eso se oculta o se deshabilita con explicación.
4. **Invitación al flujo nuevo:** En cotizaciones sin estudio y en el modal de Cálculo FV, un texto breve que recomiende usar Estudios FV para un estudio completo.
5. **Listado:** Badge “Desde estudio” en cotizaciones con `sourceFvStudyId` para que sea evidente qué cotizaciones siguen el flujo nuevo.

---

## 6. Cómo probar la transición sin romper el MVP

### 6.1 Cotización creada desde estudio

1. Crear un estudio FV y desde su detalle pulsar “Crear cotización desde este estudio”.
2. En el detalle de la cotización creada:
   - Ver “Basado en Estudio FV: [título]” con enlace al estudio.
   - Ver bloque “Resumen FV (desde estudio)” con los KPIs del estudio (no vacío).
   - Comprobar que el botón “Cálculo FV” no aparece o está deshabilitado con tooltip.
3. Abrir vista previa/PDF y comprobar que el resumen FV coincide con el estudio y que aparece “Basado en Estudio FV: …”.

### 6.2 Cotización creada a mano (sin estudio)

1. Crear una cotización desde “Nueva cotización” (sin pasar por estudio).
2. En el detalle:
   - No debe aparecer “Basado en Estudio FV”.
   - Bloque “Resumen FV (cálculo en cotización)”: si no hay cálculo, mensaje que invite a abrir “Cálculo FV” o a usar Estudios FV para estudio completo.
   - Pulsar “Cálculo FV”, guardar un cálculo y comprobar que el bloque muestra los KPIs y el botón “Ver detalle”/“Abrir cálculo FV” sigue disponible.
3. Vista previa/PDF: resumen FV debe ser el de QuoteFvCalculation (comportamiento actual).

### 6.3 Listado de cotizaciones

1. Con al menos una cotización desde estudio y una “a mano”, en el listado ver badge/icono “Desde estudio” solo en la primera.
2. Orden del menú (si se cambió): Clientes, Estudios FV, Cotizaciones.

### 6.4 Modal Cálculo FV

1. En una cotización sin estudio, abrir “Cálculo FV” y comprobar que aparece el texto que recomienda Estudios FV para estudio completo.
2. Comprobar que guardar cálculo sigue funcionando y que el resumen se actualiza en detalle y vista previa.

### 6.5 Regresión

- No eliminar ni desactivar QuoteFvCalculation en backend.
- Cotizaciones antiguas sin `sourceFvStudyId` deben seguir mostrando su cálculo FV si existe.
- No cambiar la prioridad en vista previa: con `sourceFvStudyId` → estudio; sin él → QuoteFvCalculation.

---

## 7. Resumen ejecutivo

- **Convivencia:** Se mantienen los dos orígenes (FvStudy y QuoteFvCalculation). La decisión es por cotización: si tiene `sourceFvStudyId`, solo estudio; si no, solo QuoteFvCalculation.
- **UI:** Un solo resumen FV por pantalla, siempre etiquetado según origen; botón “Cálculo FV” solo activo cuando la cotización no proviene de un estudio; mensajes que orienten al flujo Cliente → Estudio FV → Cotización.
- **Archivos principales:** `CotizacionDetalleView` (lógica según `sourceFvStudyId`, fetch de estudio, título del bloque y visibilidad del botón), `CalculoFvModal` (texto recomendando Estudios FV), `CotizacionesList` (badge “Desde estudio”), opcionalmente `Sidebar` (orden de ítems).
- **Pruebas:** Verificar ambos tipos de cotización (desde estudio vs a mano), vista previa/PDF, listado con badge y que no se rompa el flujo actual de QuoteFvCalculation.

---

## 8. Implementación realizada (ajustes aprobados)

- **Botón "Cálculo FV"** con `sourceFvStudyId`: visible pero deshabilitado, con texto de ayuda: "Esta cotización usa un Estudio FV vinculado. Edite el estudio para cambiar el resumen FV."
- **Señal visual de origen en detalle:** badges "Desde estudio" (ámbar) y "Desde cálculo rápido" (gris) en la cabecera de la cotización.
- **Mensaje en cotizaciones a mano sin resumen FV:** "Esta cotización no proviene de un estudio FV. Puede usar el cálculo rápido o crear un Estudio FV para un análisis más completo."
- **Sidebar:** Orden aplicado: Dashboard → Clientes → Estudios FV → Cotizaciones → Productos → Proveedores → Usuarios.
- **Listado:** Columna "Origen FV" con badge "Desde estudio" cuando aplica; "—" en el resto.

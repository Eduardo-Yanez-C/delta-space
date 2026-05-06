# Rediseño: Estudio FV e integración con Explorador Solar

Documento técnico y funcional para que el módulo **Estudio FV** deje de usar generación mensual plana (anual/12) y pase a obtener **generación mensual y anual** desde una fuente de recurso solar —prioritariamente el **Explorador Solar** (o API equivalente)— con arquitectura desacoplada y posibilidad de fallback manual/interno.

**Estado:** Propuesta de diseño. No implementar hasta aprobar y priorizar fases.

---

## 1. Objetivo y requisitos funcionales

### 1.1 Objetivo

- La **generación mensual y anual** del estudio FV no debe calcularse de forma plana (generación anual / 12).
- La generación debe provenir del **Explorador Solar** o de una **estructura equivalente** preparada para consumir esa fuente (API, archivo, etc.).
- El estudio debe poder guardar y mostrar **generación mensual por mes** (12 valores) y **generación anual**, combinados con consumo mensual real para obtener ahorro y pago estimado por mes.

### 1.2 Requisitos funcionales

1. **Nueva sección en el Estudio FV:** Recurso solar / Explorador Solar (ubicación, parámetros de instalación, origen del dato de generación).
2. **Persistencia:** Guardar generación mensual (12 meses) y generación anual en el estudio.
3. **Tabla mensual:** Debe combinar:
   - consumo mensual real (ya existe),
   - generación mensual estimada (de la fuente),
   - valor consumo,
   - valor generación,
   - ahorro %,
   - pago estimado.
4. **connectionType (MONOFASICO / TRIFASICO):** Sigue en el estudio como variable funcional futura (ya existe en el modelo; se mantiene y se documenta su uso futuro en tarifa/contrato).

### 1.3 Contexto Explorador Solar

- **Explorador Solar (Chile):** Base de datos de radiación solar (DGF UChile / Min. Energía), datos en grilla ~90 m, variables como GHI, DNI, DHI, temperatura. Útil para estimar producción según ubicación e inclinación/azimut.
- **API Min. Energía:** api.minenergia.cl ofrece datos de radiación y variables relacionadas; puede requerir registro.
- El sistema no debe quedar **atado a un único endpoint frágil**: se propone un **proveedor de recurso solar** abstraído y adaptadores (Explorador Solar, manual, interno).

---

## 2. Cambios al modelo de datos

### 2.1 Ampliación de `FvStudy`

Se agrega un bloque de **recurso solar** y **origen de la generación**:

| Campo nuevo (propuesto) | Tipo | Descripción |
|------------------------|------|-------------|
| **generationSource** | String | Origen del dato de generación: `INTERNAL` (anual/12 o fórmula HSP), `EXPLORADOR_SOLAR`, `MANUAL`, `EXTERNAL`. |
| **solarResourceProvider** | String? | Identificador del proveedor usado cuando generationSource es externo: ej. `explorador_solar`, `minenergia_api`, `pvsyst`, etc. |
| **latitude** | Float? | Latitud del punto de instalación (para llamada a API de recurso). |
| **longitude** | Float? | Longitud del punto de instalación. |
| **mountingType** | String? | Tipo de montaje: `TECHO`, `SUELO`, `INCLINADO_FIJO`, `SEGUIMIENTO`, etc. (valores a definir en dominio). |
| **tiltDegrees** | Float? | Inclinación de paneles en grados (0–90). |
| **azimuthDegrees** | Float? | Azimut en grados (ej. 0 = Norte, 180 = Sur en hemisferio sur). |
| **solarResourceRequestedAt** | DateTime? | Fecha/hora en que se solicitó el recurso al proveedor (para cache/auditoría). |
| **solarResourceMetadata** | String? | JSON con metadatos del proveedor: URL, parámetros de request, versión API, identificador de celda/grilla, etc. |

**Campos existentes que se mantienen y se usan:**

- `potenciaSistemaKwp`, `potenciaPorPanelWp`, `cantidadPaneles` — para dimensionar y para enviar a la API (potencia).
- `connectionType` — MONOFASICO / TRIFASICO (uso futuro en tarifa/contrato).
- `generacionAnualKwh` — puede venir de la fuente externa o seguir siendo calculada cuando la fuente es INTERNAL.

**Lógica:**

- Si `generationSource = INTERNAL`: generación anual se calcula como hoy (HSP × PR × potencia × 365); generación mensual = anual/12 (comportamiento actual de respaldo).
- Si `generationSource = EXPLORADOR_SOLAR` o `EXTERNAL`: generación mensual (y anual) proviene del proveedor; se persisten en `FvStudyMonth.generationKwh` y en `FvStudy.generacionAnualKwh` (suma o valor devuelto por la API).
- Si `generationSource = MANUAL`: el usuario (o un proceso) ingresó manualmente los 12 valores de generación mensual; `generacionAnualKwh` = suma de los 12 meses.

### 2.2 Ampliación de `FvStudyMonth`

La tabla mensual ya tiene `consumptionKwh`, `generationKwh`, `consumptionValue`, `generationValue`, `savingsPercent`, `estimatedPayment`. Cambios:

| Campo nuevo (propuesto) | Tipo | Descripción |
|------------------------|------|-------------|
| **generationSource** | String? | Origen del valor de generación de este mes: `INTERNAL`, `EXTERNAL`, `MANUAL`. Opcional; si es null, se infiere del estudio. Útil si en el futuro se permite mezcla (ej. algunos meses de API y otros manuales). |

**Enfoque recomendado:** No duplicar en cada mes el origen; el origen es a nivel estudio (`FvStudy.generationSource`). El campo `generationSource` en `FvStudyMonth` puede omitirse en una primera fase y añadirse solo si se necesita granularidad por mes.

**Persistencia de generación mensual:**

- **Ya existe** `FvStudyMonth.generationKwh`. Hoy se rellena con el mismo valor (anual/12) para todos los meses. Con el rediseño:
  - Cuando la fuente es **externa** (Explorador Solar u otro): cada `generationKwh` por mes se rellena con el valor devuelto por el proveedor.
  - Cuando la fuente es **INTERNAL**: se mantiene anual/12 por mes.
  - Cuando la fuente es **MANUAL**: cada mes tiene el valor ingresado por el usuario.

La **generación anual** se guarda en `FvStudy.generacionAnualKwh`: puede ser la suma de los 12 `generationKwh` de los meses, o el valor devuelto por la API si el proveedor entrega anual directamente (y se valida contra la suma).

### 2.3 Cómo guardar la fuente de la generación mensual

- **A nivel estudio:** `FvStudy.generationSource` indica el origen global (INTERNAL, EXPLORADOR_SOLAR, MANUAL, EXTERNAL).
- **A nivel proveedor:** `FvStudy.solarResourceProvider` identifica el adaptador (ej. `explorador_solar`). Opcionalmente `solarResourceMetadata` (JSON) guarda parámetros de la petición y respuesta (coordenadas enviadas, inclinación, azimut, potencia, fecha de consulta, id de celda, etc.) para trazabilidad y para no volver a llamar la API innecesariamente (cache por estudio).

### 2.4 Cómo guardar metadatos del Explorador Solar (o del origen)

- **solarResourceRequestedAt:** DateTime de la última consulta al recurso externo.
- **solarResourceMetadata:** String (JSON) con por ejemplo:
  - `provider`: `"explorador_solar"` o `"minenergia_api"`.
  - `request`: `{ "lat": -33.45, "lon": -70.67, "tilt": 25, "azimuth": 0, "capacityKwp": 5.5 }`.
  - `responseSummary`: `{ "annualKwh": 8500, "monthlyKwh": [ ... ] }` (opcional, para no depender solo de FvStudyMonth).
  - `apiVersion` o `endpoint` si aplica.
  - `cellId` o `gridId` si el proveedor devuelve un identificador de celda/grilla.

Así se puede auditar, depurar y en el futuro implementar cache (por ejemplo “mismo lat/lon/tilt/azimuth/potencia → reutilizar última respuesta”).

---

## 3. Estrategia de integración (arquitectura)

### 3.1 Objetivo de la arquitectura

- **No amarrar** el sistema a un endpoint único y frágil.
- Permitir **cambiar de proveedor** (Explorador Solar, otra API, archivo, mock) sin reescribir la lógica del estudio.
- Ofrecer **respaldo** cuando la API falle o no esté disponible: fuente interna (anual/12) o manual.

### 3.2 Componentes propuestos

```
┌─────────────────────────────────────────────────────────────────┐
│  Estudio FV (backend service)                                    │
│  - Orquesta creación/actualización del estudio                    │
│  - Decide qué fuente usar según parámetros y disponibilidad       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Solar Resource Provider (interfaz / contrato)                   │
│  - getMonthlyGeneration(params): Promise<MonthlyGenerationResult>│
│  - Params: lat, lon, tilt, azimuth, capacityKwp, mountingType?   │
│  - Result: { monthlyKwh: number[], annualKwh: number }            │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Adapter         │ │ Adapter         │ │ Adapter         │
│ Explorador      │ │ Internal        │ │ Manual          │
│ Solar           │ │ (HSP/12)        │ │ (user input     │
│ (API/MinEnergía)│ │                 │ │  12 months)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 3.3 Proveedor de recurso solar (interfaz)

- **Nombre sugerido:** `ISolarResourceProvider` o `SolarResourceService` (abstracción en backend).
- **Método principal:** `getMonthlyGeneration(params: SolarResourceParams): Promise<MonthlyGenerationResult>`.
- **Params:** latitud, longitud, inclinación, azimut, potencia sistema (kWp), tipo de montaje opcional, connectionType opcional (para futuro).
- **Result:** `{ monthlyKwh: number[] }` (12 elementos, índice 0 = enero) y opcionalmente `annualKwh: number` (si la API lo devuelve; si no, se calcula como suma).

### 3.4 Adapter del Explorador Solar

- **Rol:** Traducir la petición del estudio a la API del Explorador Solar (o api.minenergia.cl) y mapear la respuesta a `monthlyKwh` (y `annualKwh` si aplica).
- **Detalles a resolver en implementación:** URL del endpoint, autenticación, formato de request (coordenadas, inclinación, azimut, potencia), formato de respuesta (mensual/anual). Si la API devuelve irradiación (kWh/m²/día por mes), el adapter debe convertir a energía generada usando potencia y PR (o la fórmula que exponga la API).
- **Manejo de errores:** Timeout, 4xx/5xx, datos faltantes. En caso de error, el servicio de estudio puede caer a **fuente interna** (anual/12) o marcar el estudio como “pendiente de recurso” según regla de negocio.

### 3.5 Fuente manual o interna como respaldo

- **Interna (INTERNAL):** Comportamiento actual: generación anual = f(HSP, PR, potencia); generación mensual = anual/12. No requiere coordenadas ni llamada externa.
- **Manual (MANUAL):** El usuario (o un import) ingresa los 12 valores de generación mensual. El backend valida que sean 12 números y opcionalmente que la suma sea coherente con un rango esperado. No se llama a ningún proveedor.
- **Flujo sugerido:** Si el usuario eligió “Explorador Solar” pero la llamada falla, se puede: (a) dejar el estudio en error y pedir reintento, (b) ofrecer guardar con “INTERNAL” (anual/12) como respaldo temporal, o (c) ofrecer edición manual de los 12 meses. Esto se define en fase de implementación.

---

## 4. Datos mínimos que debe guardar el estudio

Resumen de datos que el estudio debe poder almacenar para soportar recurso solar y generación mensual real:

| Dato | Dónde guardar | Notas |
|------|----------------|-------|
| **Ubicación / coordenadas** | `FvStudy.latitude`, `FvStudy.longitude` | Necesarias para Explorador Solar (y otros proveedores). |
| **Tipo de montaje** | `FvStudy.mountingType` | TECHO, SUELO, INCLINADO_FIJO, SEGUIMIENTO, etc. |
| **Inclinación** | `FvStudy.tiltDegrees` | Grados (0–90). |
| **Azimut** | `FvStudy.azimuthDegrees` | Grados (ej. 0 = Norte). |
| **Potencia del sistema** | `FvStudy.potenciaSistemaKwp` | Ya existe. |
| **Potencia por panel** | `FvStudy.potenciaPorPanelWp` | Ya existe. |
| **connectionType** | `FvStudy.connectionType` | MONOFASICO / TRIFASICO (ya existe; variable funcional futura). |
| **Generación mensual por mes** | `FvStudyMonth.generationKwh` (12 registros) | Ya existe; se rellena desde la fuente elegida. |
| **Generación anual** | `FvStudy.generacionAnualKwh` | Ya existe; suma de los 12 meses o valor de la API. |
| **Origen del dato** | `FvStudy.generationSource`, `solarResourceProvider`, `solarResourceMetadata`, `solarResourceRequestedAt` | Ver sección 2. |

El resto de datos del estudio (consumo mensual, tarifas, ahorro, pago residual) sigue igual; solo cambia **de dónde sale** `generationKwh` en cada mes.

---

## 5. Cómo cambia la lógica del estudio

### 5.1 Hoy (comportamiento actual)

- Generación anual: `potenciaRealKwp * hspDaily * 365 * pr`.
- Generación mensual: **constante** `generacionAnualKwh / 12` para todos los meses.
- Por cada mes: con `consumptionKwh` y esa generación fija se calcula valor consumo, valor generación, ahorro %, pago estimado.

### 5.2 Después del rediseño

- **Ya no** se usa generación mensual = anual/12 cuando la fuente es Explorador Solar (o externa).
- **Flujo:**
  1. El estudio tiene (o el usuario ingresa) ubicación, inclinación, azimut, potencia, tipo de montaje, connectionType.
  2. Según `generationSource`:
     - **EXPLORADOR_SOLAR / EXTERNAL:** Se llama al proveedor de recurso solar con esos parámetros. El proveedor devuelve 12 valores de generación mensual (y opcionalmente anual). Se persisten en `FvStudyMonth.generationKwh` y `FvStudy.generacionAnualKwh`.
     - **INTERNAL:** Se calcula generación anual como hoy; generación mensual = anual/12; se persiste igual.
     - **MANUAL:** Los 12 valores de generación mensual vienen del request (usuario o import); generación anual = suma; se persisten.
  3. **Cálculo de ahorro y pago mes a mes:** Sin cambio respecto a hoy: con `consumptionKwh` y `generationKwh` por mes se calcula valor consumo, valor generación, ahorro %, pago estimado. La única diferencia es que `generationKwh` ya no es constante (anual/12) sino el valor por mes de la fuente.
- **Totales anuales:** ahorro anual y pago residual anual siguen siendo la suma de los 12 meses (no cambia la fórmula; solo la entrada de generación mensual).

### 5.3 connectionType (MONOFASICO / TRIFASICO)

- Se mantiene en el modelo y en la UI como variable funcional futura.
- En esta iteración puede enviarse al adaptador del Explorador Solar si la API lo requiere; si no, se guarda solo en el estudio para uso futuro (tarifas, contratos, límites de inyección, etc.).

---

## 6. Implementación en fases

### 6.1 Fase 0 (inicial): Sin romper lo actual

**Objetivo:** Introducir campos y flujo de “origen de generación” sin cambiar el comportamiento por defecto.

- **Modelo de datos:** Agregar en `FvStudy`: `generationSource` (default `INTERNAL`), `solarResourceProvider`, `latitude`, `longitude`, `mountingType`, `tiltDegrees`, `azimuthDegrees`, `solarResourceRequestedAt`, `solarResourceMetadata`. Migración sin datos existentes (todos quedan con generationSource = INTERNAL implícito o por defecto).
- **Backend:** En el servicio del estudio, si `generationSource` es null o INTERNAL, mantener exactamente la lógica actual (generación anual y mensual = anual/12). No llamar a ningún proveedor externo.
- **Frontend (opcional en esta fase):** Sección “Recurso solar” en el formulario del estudio en solo lectura o oculta; o visible con campos opcionales (lat, lon, tilt, azimuth, tipo montaje) que se guardan pero no se usan aún para cálculo. connectionType ya está; dejarlo visible y documentado.
- **Criterio de éxito:** Estudios existentes y nuevos siguen funcionando igual; el estudio puede guardar coordenadas y parámetros de instalación para la siguiente fase.

### 6.2 Fase 1: Integración del Explorador Solar (o proveedor externo)

**Objetivo:** Poder elegir “Explorador Solar” como fuente y obtener generación mensual real.

- **Backend:** Definir interfaz `ISolarResourceProvider` y resultado `MonthlyGenerationResult`. Implementar adapter para el Explorador Solar (o API Min. Energía): traducir lat/lon/tilt/azimuth/potencia a la petición de la API y mapear respuesta a 12 valores mensuales (y anual).
- **Flujo:** En creación o actualización del estudio, si el usuario eligió “Explorador Solar” y hay coordenadas y parámetros:
  - Llamar al adapter; si la respuesta es correcta, rellenar `FvStudyMonth.generationKwh` y `FvStudy.generacionAnualKwh`, setear `generationSource = EXPLORADOR_SOLAR`, guardar metadatos y `solarResourceRequestedAt`.
  - Si la llamada falla: según política (reintento, fallback a INTERNAL, o error con mensaje claro).
- **Frontend:** Sección “Recurso solar / Explorador Solar” en el formulario: activar opción “Usar Explorador Solar” (o “Obtener generación desde recurso solar”), campos lat/lon (o selector de dirección/mapa si se agrega más adelante), inclinación, azimut, tipo de montaje. Botón “Obtener generación” que llame al backend (endpoint que a su vez llama al proveedor y devuelve los 12 meses para previsualización) y luego guardar estudio con esa generación.
- **Datos mínimos:** Ubicación (lat/lon), inclinación, azimut, potencia del sistema, tipo de montaje; connectionType se mantiene. Generación mensual y anual quedan guardadas en estudio y meses.

### 6.3 Fase 2: Mejora de precisión mensual y respaldos

**Objetivo:** Fuente manual, cache y robustez.

- **Fuente MANUAL:** Permitir que el usuario ingrese o edite los 12 valores de generación mensual sin llamar a ninguna API. Útil cuando no hay conexión, la API falla o se quiere ajustar manualmente. `generationSource = MANUAL`; validar 12 números y actualizar `generacionAnualKwh` como suma.
- **Cache (opcional):** Para no saturar la API, cachear por (lat, lon, tilt, azimuth, potencia) con TTL. Si hay cache válido, reutilizar; si no, llamar al proveedor y guardar en cache. Los metadatos del estudio (`solarResourceRequestedAt`, `solarResourceMetadata`) ayudan a saber si hay que refrescar.
- **Re-cálculo de ahorro/pago:** Siempre que cambie la generación mensual (por fuente externa o manual), el backend debe recalcular valor consumo, valor generación, ahorro % y pago estimado por mes (y totales anuales) con la misma lógica actual, usando los nuevos `generationKwh` por mes.
- **UI:** En detalle del estudio, indicar claramente “Generación desde Explorador Solar” vs “Generación estimada (promedio anual/12)” vs “Generación manual”. Opción “Volver a obtener desde Explorador Solar” para refrescar datos.

---

## 7. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| **Origen de generación** | Campo `generationSource` en FvStudy: INTERNAL, EXPLORADOR_SOLAR, MANUAL, EXTERNAL. |
| **Generación mensual** | Se guarda en `FvStudyMonth.generationKwh`; ya no siempre anual/12; puede venir de API, manual o interno. |
| **Metadatos del recurso** | `solarResourceProvider`, `solarResourceRequestedAt`, `solarResourceMetadata` (JSON) en FvStudy. |
| **Parámetros de instalación** | latitude, longitude, mountingType, tiltDegrees, azimuthDegrees en FvStudy. |
| **Arquitectura** | Proveedor de recurso solar (interfaz) + adaptadores (Explorador Solar, interno, manual). |
| **connectionType** | Se mantiene en el estudio como variable funcional futura (MONOFASICO/TRIFASICO). |
| **Fases** | 0: campos y default INTERNAL sin romper; 1: adapter Explorador Solar e integración; 2: manual, cache y mejoras de precisión. |

---

*Documento de diseño. No programar hasta aprobar este rediseño y priorizar fases de implementación.*

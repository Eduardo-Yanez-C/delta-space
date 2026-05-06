# Fase intermedia: generación mensual real (INTERNAL + MANUAL)

Soportar generación mensual real en el Estudio FV sin depender aún de una API externa. Dos fuentes: **INTERNAL** (actual) y **MANUAL** (usuario ingresa 12 valores de generación).

---

## 1. Cambios al modelo de datos

**No se requieren cambios de schema.**

- **FvStudy:** Ya tiene `generationSource` (INTERNAL | MANUAL | …). Solo se amplía el uso: en Fase 0 solo se aceptaba INTERNAL; en esta fase se acepta también MANUAL.
- **FvStudyMonth:** Ya tiene `consumptionKwh`, `generationKwh`, `consumptionValue`, `generationValue`, `savingsPercent`, `estimatedPayment`. Con MANUAL, `generationKwh` por mes viene del usuario; el backend sigue calculando y persigiendo el resto (value, savings, payment).

Regla de negocio a nivel lógico:
- **INTERNAL:** `generationKwh` de cada mes = resultado del cálculo interno (anual/12).
- **MANUAL:** `generationKwh` de cada mes = valor enviado por el usuario; generación anual del estudio = suma de esos 12 valores.

---

## 2. Cambios al backend

### 2.1 Validación de `generationSource`

- En create/update: aceptar `generationSource === "MANUAL"` además de `"INTERNAL"`. Rechazar solo EXPLORADOR_SOLAR y EXTERNAL (con mensaje “no implementado en esta versión”).

### 2.2 Entrada mensual cuando hay MANUAL

- **FvStudyMonthInputDto:** Añadir campo opcional `generationKwh?: number`.
- **Regla:** Si `generationSource === "MANUAL"`:
  - Exigir que los 12 meses tengan `generationKwh` definido y ≥ 0.
  - Validar que no falte ningún `monthIndex` 1–12 y que no haya duplicados (igual que hoy para consumos).

Si `generationSource === "INTERNAL"`, `generationKwh` en el input se ignora; el backend calcula generación como hasta ahora.

### 2.3 Nueva rama de cálculo para MANUAL

- **Función nueva (o rama en la existente):** `calculateStudyResultsFromManualGeneration(monthsInput, params)` donde `monthsInput` incluye `consumptionKwh` y `generationKwh` por mes.
- **Cálculo por mes (misma lógica que hoy):**
  - `consumptionValue = consumptionKwh * valorKwhConsumo`
  - `autoconsumo = min(generationKwh, consumptionKwh)`
  - `excedente = max(0, generationKwh - consumptionKwh)`
  - `generationValue = autoconsumo * valorKwhConsumo + excedente * valorKwhInyeccion`
  - `estimatedPayment = max(0, consumptionValue - generationValue)`
  - `savingsPercent = consumptionValue > 0 ? (generationValue / consumptionValue) * 100 : 0`
- **Totales anuales:**
  - `generacionAnualKwh = sum(generationKwh)` de los 12 meses.
  - `ahorroAnual = sum(generationValue)` de los 12 meses.
  - `pagoResidualAnual = sum(estimatedPayment)` de los 12 meses.
  - `totalConsumptionValue = sum(consumptionValue)`; `porcentajeAhorro = totalConsumptionValue > 0 ? (ahorroAnual / totalConsumptionValue) * 100 : 0`.

### 2.4 Potencia y paneles cuando la fuente es MANUAL

- Con MANUAL no se dimensiona la planta por cobertura/consumo; la generación ya está dada. Aun así, para mantener KPIs coherentes en el estudio y en la UI:
  - **Opción A (recomendada):** Derivar “equivalente” de planta a partir de la generación anual:  
    `generacionAnualKwh = sum(manual generationKwh)` →  
    `potenciaRealKwp = generacionAnualKwh / (hspDaily * 365 * pr)` →  
    `cantidadPaneles = ceil((potenciaRealKwp * 1000) / potenciaPorPanelWp)`.  
    Persistir `potenciaSistemaKwp` y `cantidadPaneles` con estos valores para que el resumen del estudio siga mostrando planta y paneles de forma consistente.
- **Opción B:** Dejar que el usuario envíe opcionalmente `potenciaSistemaKwp` (y opcionalmente `cantidadPaneles`) cuando sea MANUAL; si no vienen, derivar como en A.

Recomendación: **Opción A** para no complicar el formulario; el backend siempre deriva planta/paneles desde la generación anual cuando la fuente es MANUAL.

### 2.5 Flujo create/update

- **Create:**
  - Si `generationSource` es INTERNAL (o no se envía): flujo actual (validar 12 consumos, `calculateStudyResults` con generación lineal, persistir estudio y 12 meses).
  - Si `generationSource` es MANUAL: validar 12 meses con `consumptionKwh` y `generationKwh`; llamar `calculateStudyResultsFromManualGeneration`; persistir estudio (incluyendo `generacionAnualKwh`, `ahorroAnual`, `porcentajeAhorro`, `pagoResidualAnual`, y `potenciaSistemaKwp`/`cantidadPaneles` derivados) y 12 meses.
- **Update:**
  - Si se envía `generationSource` y/o `months`:
    - Si el estudio queda en INTERNAL: validar 12 consumos (sin exigir `generationKwh`), recalcular con `calculateStudyResults`, actualizar estudio y reemplazar los 12 meses.
    - Si el estudio queda en MANUAL: validar 12 meses con consumos y generaciones, recalcular con `calculateStudyResultsFromManualGeneration`, actualizar estudio y reemplazar los 12 meses.
  - Si no se envían `months`, no tocar la tabla mensual (comportamiento actual).

### 2.6 Validaciones adicionales

- Para MANUAL: cada `generationKwh` ≥ 0 y finito.
- No exigir para MANUAL que la suma de generación tenga una relación especial con el consumo; el usuario puede cargar cualquier perfil de generación (ej. verano más alto que invierno).

---

## 3. Cambios al formulario del estudio

### 3.1 Origen de la generación

- **Selector de fuente:** En la sección “Recurso solar” (o en “Técnicos y conexión” / bloque de consumos), permitir elegir:
  - **Estimación interna (promedio anual/12)** → `generationSource = INTERNAL`
  - **Generación mensual manual** → `generationSource = MANUAL`
- Mientras no se implemente Explorador Solar, no mostrar EXPLORADOR_SOLAR ni EXTERNAL como opciones activas.

### 3.2 Comportamiento según fuente

- **INTERNAL (actual):**
  - Solo se muestran los 12 inputs de **consumo (kWh)**.
  - Texto de ayuda: “La generación se estima de forma lineal (anual/12) a partir de la planta calculada.”
  - No se muestran inputs de generación (o se muestran en solo lectura/deshabilitados con los valores que calcule el backend tras guardar).

- **MANUAL:**
  - Se muestran 12 filas con dos columnas editables: **Consumo (kWh)** y **Generación (kWh)**.
  - Etiqueta clara: “Ingrese consumo y generación estimada (kWh) por mes.”
  - Validación en frontend (opcional pero recomendable): números ≥ 0; los 12 meses completos antes de enviar.

### 3.3 Envío al backend

- En create/update, según la opción elegida:
  - **INTERNAL:** `generationSource: "INTERNAL"`, `months: [{ monthIndex, consumptionKwh }, ...]` (sin `generationKwh`).
  - **MANUAL:** `generationSource: "MANUAL"`, `months: [{ monthIndex, consumptionKwh, generationKwh }, ...]` con los 12 valores de generación.

### 3.4 Al cargar un estudio existente

- Si `generationSource === "MANUAL"`, rellenar los 12 consumos y los 12 `generationKwh` desde `study.months`.
- Si `generationSource === "INTERNAL"`, rellenar solo consumos; generación se puede mostrar en solo lectura desde `study.months[].generationKwh` después de cargar/guardar.

---

## 4. Cómo se vería la tabla mensual (consumo + generación)

La tabla mensual del estudio **no cambia de columnas**; solo el origen de `generationKwh`:

| Mes   | Consumo (kWh) | Valor consumo | Generación (kWh) | Valor generación | Ahorro % | Pago estimado |
|-------|----------------|----------------|-------------------|------------------|----------|----------------|
| Ene   | …              | …              | …                 | …                | …        | …              |
| …     | …              | …              | …                 | …                | …        | …              |
| Dic   | …              | …              | …                 | …                | …        | …              |

- **INTERNAL:** “Consumo” y “Generación” vienen del backend (consumo del usuario, generación = anual/12). Valor consumo, valor generación, ahorro % y pago estimado calculados por el backend.
- **MANUAL:** “Consumo” y “Generación” son los ingresados por el usuario (consumo + generación por mes). Valor consumo, valor generación, ahorro % y pago estimado siguen siendo calculados por el backend a partir de esos datos y de valorKwhConsumo/valorKwhInyeccion.

En el detalle del estudio, la misma tabla sirve para ambos orígenes; solo cambia si los datos de generación son calculados (INTERNAL) o ingresados (MANUAL). Opcional: una leyenda bajo la tabla, por ejemplo “Generación: estimación interna” vs “Generación: ingresada manualmente”.

---

## 5. Cómo conviven INTERNAL y MANUAL

- **Un estudio tiene una sola fuente por vez:** `generationSource` es INTERNAL o MANUAL en cada momento.
- **Crear estudio:** El usuario elige INTERNAL o MANUAL antes de guardar. Si elige MANUAL, debe completar los 12 consumos y los 12 valores de generación.
- **Editar estudio:** Puede cambiar de INTERNAL a MANUAL o de MANUAL a INTERNAL.
  - **INTERNAL → MANUAL:** Se pueden prellenar los 12 valores de generación con los actuales del estudio (los que hoy son anual/12), para que el usuario solo ajuste los que quiera.
  - **MANUAL → INTERNAL:** Se descartan los valores manuales de generación; el backend recalcula solo con consumos y parámetros (HSP, PR, cobertura, etc.).
- **Vista previa / PDF de cotización:** Si la cotización viene de un estudio, el resumen FV (potencia, paneles, ahorro anual, etc.) sigue leyendo del estudio; no hay cambio de contrato de datos: el estudio ya tiene generación anual, ahorro anual y pago residual calculados correctamente tanto para INTERNAL como para MANUAL.
- **Listado y detalle:** Se puede mostrar un badge o texto (“Interno” / “Manual”) según `generationSource` para que quede claro el origen de la generación.

---

## 6. Cómo probarlo sin romper el flujo actual

### 6.1 Estudios existentes (INTERNAL)

- Todos los estudios actuales tienen `generationSource = "INTERNAL"`.
- No cambiar la lógica cuando `generationSource === "INTERNAL"`: mismos validaciones, misma `calculateStudyResults`, mismo persistido. Crear y editar estudios con “Estimación interna” debe comportarse exactamente igual que antes.
- Verificar: crear estudio INTERNAL con 12 consumos → guardar → ver detalle y tabla mensual; editar y cambiar un consumo → guardar → comprobar que los totales y la generación mensual se recalculan igual que hoy.

### 6.2 Nuevo flujo MANUAL

- Crear estudio eligiendo “Generación mensual manual”; completar 12 consumos y 12 generaciones (por ejemplo, verano con más generación que invierno). Guardar.
  - Comprobar: generación anual = suma de los 12 valores; ahorro anual, porcentaje de ahorro y pago residual coherentes con la tabla mensual; planta/paneles derivados de la generación anual.
- Editar ese estudio: cambiar uno o más valores de generación o consumo; guardar. Comprobar que la tabla y los totales se actualizan.
- Cambiar el mismo estudio a “Estimación interna”: guardar (sin enviar generaciones). Comprobar que pasa a generación lineal (anual/12) y que los totales se recalculan con la lógica INTERNAL.

### 6.3 Cotización desde estudio

- Crear cotización desde un estudio INTERNAL: sin cambios; el resumen FV en la cotización debe seguir siendo el del estudio.
- Crear cotización desde un estudio MANUAL: el resumen FV (potencia, paneles, ahorro anual, pago residual) debe coincidir con los KPIs del estudio (ya calculados y guardados en el estudio). No romper la vista previa ni el PDF.

### 6.4 Validaciones

- MANUAL sin algún `generationKwh` o con valor negativo → 400 con mensaje claro.
- Envío de `generationSource: "EXPLORADOR_SOLAR"` → 400 “no implementado en esta versión”.

---

## 7. Resumen de decisiones

| Tema | Decisión |
|------|----------|
| Modelo | Sin cambios de schema; uso de `generationSource` y de `FvStudyMonth.generationKwh` según origen. |
| INTERNAL | Mantener lógica actual: generación anual por fórmula, generación mensual = anual/12. |
| MANUAL | Usuario envía 12 consumos + 12 generaciones; backend calcula valor, ahorro %, pago por mes y totales anuales; generación anual = suma de los 12 meses; planta/paneles derivados de esa generación anual para consistencia de KPIs. |
| Formulario | Selector INTERNAL/MANUAL; con MANUAL, segunda columna de inputs “Generación (kWh)” por mes. |
| Tabla mensual | Mismas columnas; solo cambia el origen de “Generación (kWh)” (calculado vs manual). |
| Convivencia | Un estudio tiene una sola fuente; se puede cambiar INTERNAL ↔ MANUAL al editar; al pasar a INTERNAL se recalculan generaciones desde consumos y parámetros. |
| Pruebas | No cambiar comportamiento INTERNAL; añadir casos MANUAL (crear, editar, cambiar fuente, cotización desde estudio). |

Con este diseño se puede implementar la fase intermedia (INTERNAL + MANUAL) sin tocar el modelo de datos y dejando listo el patrón para más adelante con EXPLORADOR_SOLAR (generación mensual desde API).

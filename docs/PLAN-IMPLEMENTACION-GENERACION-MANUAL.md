# Plan de implementación: generación mensual manual (INTERNAL + MANUAL)

Fase aprobada con los siguientes ajustes incorporados:

1. **INTERNAL → MANUAL:** Prellenar las 12 generaciones con los valores actualmente calculados, solo en frontend y sin persistir hasta guardar.
2. **MANUAL → INTERNAL:** Mostrar un aviso breve indicando que al guardar se reemplazarán las generaciones manuales por la estimación interna.
3. **Backend MANUAL:** Validar explícitamente: 12 meses completos, monthIndex 1–12, sin duplicados, generationKwh obligatorio y ≥ 0, consumptionKwh ≥ 0.
4. **Labels en frontend:** "Estimación interna" y "Generación mensual manual".

---

## 1. Archivos a tocar

| Archivo | Acción |
|---------|--------|
| `apps/api/src/modules/fv-study/dto/month-input.dto.ts` | Modificar: añadir `generationKwh?: number`. |
| `apps/api/src/modules/fv-study/fv-study.service.ts` | Modificar: validación MANUAL, `validateAndNormalizeMonthsForManual`, `calculateStudyResultsFromManualGeneration`, ramas create/update por `generationSource`. |
| `apps/web/lib/api.ts` | Modificar: tipos `CreateFvStudyInput.months` y `UpdateFvStudyInput.months` para incluir `generationKwh?: number`. |
| `apps/web/app/estudios-fv/constants.ts` | Modificar: labels "Estimación interna" y "Generación mensual manual" (solo INTERNAL y MANUAL activos). |
| `apps/web/app/estudios-fv/EstudioFvForm.tsx` | Modificar: estado con `generationSource`, `MonthRow` con `generationKwh`, selector de fuente, tabla con columna generación cuando MANUAL, prefill INTERNAL→MANUAL, aviso MANUAL→INTERNAL, envío según fuente. |
| `apps/web/app/estudios-fv/[id]/EstudioFvDetalleView.tsx` | Modificar (opcional): mostrar badge/texto "Estimación interna" vs "Generación mensual manual" si aporta claridad; el bloque "Recurso solar" ya muestra `GENERATION_SOURCE_LABELS`. |

No se tocan: schema Prisma, migraciones, controlador (ya recibe DTOs), listado de estudios (opcional añadir columna origen después).

---

## 2. Cambios en DTOs

### 2.1 `apps/api/src/modules/fv-study/dto/month-input.dto.ts`

- Añadir propiedad opcional: `generationKwh?: number`.
- Comentario: "Obligatorio cuando generationSource === MANUAL; ignorado cuando INTERNAL."

### 2.2 CreateFvStudyDto / UpdateFvStudyDto

- Ya tienen `generationSource?: string` y `months: FvStudyMonthInputDto[]`. No cambian de estructura; la validación de meses (incluido `generationKwh` para MANUAL) se hace en el servicio.

---

## 3. Cambios en backend

### 3.1 Constantes

- Definir `GENERATION_SOURCE_INTERNAL = "INTERNAL"` y `GENERATION_SOURCE_MANUAL = "MANUAL"`.
- En `validateSolarResource`: aceptar además `"MANUAL"`; rechazar solo `EXPLORADOR_SOLAR` y `EXTERNAL` con mensaje "no implementado en esta versión".

### 3.2 Validación de meses

- **Función actual `validateAndNormalizeMonths`:** Se mantiene para INTERNAL: exige 12 meses, monthIndex 1–12, sin duplicados, `consumptionKwh` ≥ 0. No exige `generationKwh` y no lo incluye en el objeto normalizado (el backend lo calcula).
- **Función nueva `validateAndNormalizeMonthsForManual`** (o rama dentro de una función unificada con un flag):
  - Exigir que `months` sea array de longitud 12.
  - Por cada elemento: `monthIndex` entero entre 1 y 12; sin duplicados.
  - Por cada elemento: `consumptionKwh` numérico, ≥ 0, finito.
  - Por cada elemento: `generationKwh` presente (no undefined/null), numérico, ≥ 0, finito.
  - Mensajes de error explícitos, por ejemplo:
    - "Debe enviar exactamente 12 meses (monthIndex 1 a 12) con consumptionKwh y generationKwh."
    - "Para MANUAL, generationKwh es obligatorio y debe ser >= 0 en cada mes."
    - "monthIndex duplicado: X."
    - "Falta monthIndex X."
  - Devolver array normalizado de 12 elementos con `monthIndex`, `consumptionKwh`, `generationKwh`.

### 3.3 Cálculo MANUAL

- **Función nueva `calculateStudyResultsFromManualGeneration`** (en `fv-study.service.ts` o en el mismo módulo):
  - Entrada: `monthsInput: { monthIndex, consumptionKwh, generationKwh }[]`, `params: { valorKwhConsumo, valorKwhInyeccion, potenciaPorPanelWp, hspDaily, pr, methodVersion }`.
  - Por mes: `consumptionValue`, `autoconsumo`, `excedente`, `generationValue`, `estimatedPayment`, `savingsPercent` (misma fórmula que hoy).
  - Totales: `generacionAnualKwh = sum(generationKwh)`, `ahorroAnual = sum(generationValue)`, `pagoResidualAnual = sum(estimatedPayment)`, `porcentajeAhorro` desde total consumo valor.
  - Derivar planta/paneles: `potenciaRealKwp = generacionAnualKwh / (hspDaily * 365 * pr)`, `cantidadPaneles = ceil((potenciaRealKwp * 1000) / potenciaPorPanelWp)`.
  - Retornar `StudyCalculationResult` con `monthlyResults` y totales.

### 3.4 Create

- Si `dto.generationSource === "MANUAL"`:
  - Llamar `validateAndNormalizeMonthsForManual(dto.months)`.
  - Llamar `calculateStudyResultsFromManualGeneration(...)`.
  - Persistir estudio con `generationSource: "MANUAL"` y los resultados; crear 12 `FvStudyMonth` con consumos y generaciones del resultado.
- Si no (INTERNAL o no enviado):
  - Flujo actual: `validateAndNormalizeMonths(dto.months)` (solo consumos), `calculateStudyResults`, persistir con `generationSource` por defecto INTERNAL.

### 3.5 Update

- Si se envían `dto.months`:
  - Si `dto.generationSource === "MANUAL"` o (estudio actual ya es MANUAL y no se cambia fuente): validar con `validateAndNormalizeMonthsForManual`, calcular con `calculateStudyResultsFromManualGeneration`, actualizar estudio y reemplazar 12 meses.
  - Si `dto.generationSource === "INTERNAL"` o (estudio actual es INTERNAL o se cambia a INTERNAL): validar con `validateAndNormalizeMonths` (solo consumos), calcular con `calculateStudyResults`, actualizar y reemplazar 12 meses.
- Determinar "fuente efectiva" después del update: si en el DTO viene `generationSource` usarla; si no, mantener la del estudio actual. Así se puede cambiar de MANUAL a INTERNAL enviando `generationSource: "INTERNAL"` y los 12 consumos (sin generationKwh).

### 3.6 Orden de validaciones en create/update

1. Cliente, referencia, conexión, etc. (como ahora).
2. `validateSolarResource(dto)`: acepta INTERNAL y MANUAL.
3. Si hay `dto.months`:
   - Si fuente efectiva es MANUAL → `validateAndNormalizeMonthsForManual(dto.months)`.
   - Si fuente efectiva es INTERNAL → `validateAndNormalizeMonths(dto.months)`.

---

## 4. Cambios en formulario y detalle

### 4.1 Constantes (`constants.ts`)

- Actualizar labels para uso en selector y detalle:
  - `INTERNAL`: **"Estimación interna"**
  - `MANUAL`: **"Generación mensual manual"**
- Opcional: mantener en el mismo objeto las entradas para EXPLORADOR_SOLAR y EXTERNAL como "próximamente" si se muestran en otro contexto; en el formulario solo se ofrecen las dos opciones activas.

### 4.2 Estado del formulario (`EstudioFvForm.tsx`)

- Añadir a `FormState`: `generationSource: "INTERNAL" | "MANUAL"` (string).
- Cambiar `MonthRow` a: `{ monthIndex: number; consumptionKwh: string; generationKwh: string }`.
- `defaultMonths`: 12 filas con `consumptionKwh: ""`, `generationKwh: ""`.
- En `toFormState(study, ...)`:
  - Si hay estudio: `generationSource = study.generationSource ?? "INTERNAL"`.
  - Meses: si estudio tiene `months`, mapear a `consumptionKwh` y `generationKwh` (para MANUAL rellenar desde `m.generationKwh`); si falta algún mes, completar hasta 12 con strings vacíos.
  - Si no hay estudio: `generationSource = "INTERNAL"`, meses por defecto.

### 4.3 Selector de origen de generación

- En la sección "Recurso solar", reemplazar el texto fijo "Origen de la generación: ..." por un **selector** (radio o select):
  - Opción 1: **"Estimación interna"** (`INTERNAL`).
  - Opción 2: **"Generación mensual manual"** (`MANUAL`).
- Al cambiar el selector:
  - **De INTERNAL a MANUAL:** Prellenar las 12 celdas de generación con los valores actualmente "calculados" en frontend. Para ello hace falta una función que, con los consumos actuales y parámetros del formulario (valorKwh, cobertura, HSP, PR, potencia panel, etc.), calcule en memoria la generación mensual (anual/12) igual que el backend para INTERNAL, y rellene `form.months[].generationKwh`. No se persiste; solo se actualiza el estado local. Si no se tienen todos los datos para calcular (ej. consumos vacíos), se puede prellenar con 0 o dejar los valores que ya tengan los meses si se recargaron desde un estudio INTERNAL (en ese caso, si el estudio tiene `months` con `generationKwh`, usarlos; si no, estimar anual/12 con los consumos actuales si hay suficiente datos, si no 0).
  - **De MANUAL a INTERNAL:** Mostrar un aviso breve (banner o texto debajo del selector): "Al guardar, las generaciones manuales se reemplazarán por la estimación interna (promedio anual/12)." El aviso visible mientras `generationSource === "INTERNAL"` y el usuario haya tenido antes MANUAL con datos, o simplemente mostrarlo siempre que se seleccione INTERNAL y existan valores en `generationKwh` en el estado (opción más simple: mostrar el aviso cuando la opción seleccionada es INTERNAL y hay al menos un mes con generationKwh no vacío).
- Detalle de prefill INTERNAL→MANUAL:
  - Opción A: En frontend replicar la fórmula del backend (consumo anual, cobertura, HSP, PR → planta kWp → generación anual → generación mensual = anual/12) y rellenar los 12 `generationKwh`. Requiere tener en el estado los parámetros necesarios (ya están en el form).
  - Opción B: Si estamos en edición y el estudio actual es INTERNAL y tiene `months` con `generationKwh` (calculados por backend), al cambiar a MANUAL copiar esos 12 valores a los inputs. Si estamos en creación o no hay meses cargados, calcular en frontend como en A o rellenar con 0.
  - Recomendación: Opción B en edición (copiar de `study.months`); en creación, al pasar a MANUAL calcular con la misma lógica que el backend (anual/12) a partir de consumos y parámetros del form, o dejar 0 si faltan datos.

### 4.4 Tabla de consumos mensuales

- Título/descripción según fuente:
  - INTERNAL: "Complete el consumo real (kWh) de cada mes. La generación se estimará internamente (promedio anual/12)."
  - MANUAL: "Complete consumo y generación estimada (kWh) por mes."
- Columnas:
  - Siempre: Mes, Consumo (kWh).
  - Si `generationSource === "MANUAL"`: columna adicional **Generación (kWh)** con input por fila.
  - Si `generationSource === "INTERNAL"`: no mostrar columna editable de generación (o mostrarla en solo lectura si se quiere mostrar la previsión después de guardar; en esta fase se puede omitir la columna en INTERNAL).
- Actualizar `updateMonth` para que acepte también `generationKwh` cuando sea MANUAL (por ejemplo `updateMonth(index, consumptionKwh?, generationKwh?)` o dos handlers).

### 4.5 Envío al backend

- Al hacer submit:
  - Si `form.generationSource === "INTERNAL"`: enviar `generationSource: "INTERNAL"`, `months: form.months.map(m => ({ monthIndex: m.monthIndex, consumptionKwh: parseNum(m.consumptionKwh, 0) }))` (sin `generationKwh`).
  - Si `form.generationSource === "MANUAL"`: enviar `generationSource: "MANUAL"`, `months: form.months.map(m => ({ monthIndex: m.monthIndex, consumptionKwh: parseNum(m.consumptionKwh, 0), generationKwh: parseNum(m.generationKwh, 0) }))`.
- Validación frontend opcional para MANUAL: los 12 meses con consumo y generación numéricos ≥ 0; si falta alguno, mostrar error antes de enviar.

### 4.6 Detalle del estudio (`EstudioFvDetalleView.tsx`)

- El bloque "Recurso solar" ya muestra el origen con `GENERATION_SOURCE_LABELS[study.generationSource]`. Basta con que los labels en `constants` sean "Estimación interna" y "Generación mensual manual" para INTERNAL y MANUAL.
- Opcional: en la cabecera del estudio, junto al badge de estado, un pequeño texto o badge "Estimación interna" / "Generación mensual manual" según `study.generationSource`. No obligatorio si el bloque Recurso solar ya lo deja claro.

---

## 5. Cómo manejar el cambio INTERNAL ↔ MANUAL en la UI

### 5.1 INTERNAL → MANUAL

1. Usuario tiene el formulario en "Estimación interna" con 12 consumos (y quizá ya guardó y tiene estudio con meses calculados).
2. Usuario cambia el selector a "Generación mensual manual".
3. **Acción:** Sin llamar al backend, en frontend:
   - Si es edición y `initial.months` tiene 12 registros con `generationKwh`, copiar `m.generationKwh` a cada fila del estado (como string).
   - Si es creación o no hay meses con generación, calcular generación anual con la misma lógica que el backend (consumo anual, cobertura, HSP, PR, potencia panel → planta → generación anual → generación mensual = anual/12) y rellenar los 12 inputs de generación. Si faltan datos (ej. consumos vacíos), rellenar con 0.
4. Mostrar la columna "Generación (kWh)" en la tabla y permitir editar.
5. No se persiste hasta que el usuario pulse Guardar.

### 5.2 MANUAL → INTERNAL

1. Usuario tiene "Generación mensual manual" con 12 consumos y 12 generaciones.
2. Usuario cambia el selector a "Estimación interna".
3. **Acción:** Mostrar aviso: "Al guardar, las generaciones manuales se reemplazarán por la estimación interna (promedio anual/12)." (Por ejemplo un `<p>` o banner con clase de info debajo del selector.)
4. Ocultar la columna "Generación (kWh)" (o dejarla en solo lectura vacía). Los valores de generación en el estado se pueden dejar o limpiar; al enviar INTERNAL el backend ignora `generationKwh`.
5. Al guardar, el backend usa solo consumos y recalcula con `calculateStudyResults`.

### 5.3 Persistencia del aviso

- El aviso "Al guardar, las generaciones manuales se reemplazarán por la estimación interna" se muestra cuando `generationSource === "INTERNAL"` y (por ejemplo) hay al menos un valor no vacío en `form.months[].generationKwh`, o siempre que la opción seleccionada sea INTERNAL en un formulario que tenía MANUAL (se puede simplificar mostrando el aviso siempre que `generationSource === "INTERNAL"` en modo edición, o solo cuando el estudio actual era MANUAL y el usuario acaba de cambiar a INTERNAL; la opción más simple es mostrarlo siempre que la opción activa sea INTERNAL, debajo del selector).

---

## 6. Cómo probar todo sin romper el flujo actual

### 6.1 Estudios existentes (INTERNAL)

- Listar estudios: sin cambios; todos siguen con `generationSource = "INTERNAL"`.
- Abrir estudio existente en detalle: KPIs y tabla mensual igual que antes.
- Editar estudio existente: formulario carga con "Estimación interna", solo 12 consumos; guardar sin cambiar nada: mismo comportamiento que antes.
- Crear estudio nuevo con "Estimación interna", 12 consumos, guardar: mismo resultado que antes (generación anual/12, mismos totales).

### 6.2 Nuevo flujo MANUAL

- Crear estudio: elegir "Generación mensual manual", completar 12 consumos y 12 generaciones (valores distintos por mes, ej. verano > invierno). Guardar.
  - Ver detalle: generación anual = suma de los 12; ahorro anual, porcentaje y pago residual coherentes con la tabla; planta/paneles derivados.
- Editar ese estudio: cambiar uno o más valores de generación o consumo; guardar. Comprobar que la tabla y los totales se actualizan.
- Mismo estudio: cambiar a "Estimación interna", ver aviso, guardar (solo consumos). Comprobar que pasa a generación lineal (anual/12) y totales recalculados.

### 6.3 Cambio INTERNAL → MANUAL en formulario

- Editar un estudio INTERNAL ya guardado. Cambiar selector a "Generación mensual manual". Comprobar que los 12 inputs de generación se prellenan con los valores actuales del estudio (los que el backend calculó como anual/12). Modificar alguno, guardar. Ver detalle y comprobar que los valores guardados son los enviados.
- Crear estudio nuevo, poner consumos, cambiar a "Generación mensual manual": comprobar que las generaciones se prellenan (cálculo frontend anual/12 o 0 si faltan datos). Completar y guardar; ver detalle correcto.

### 6.4 Validaciones backend

- MANUAL con un mes sin `generationKwh`: 400 con mensaje claro.
- MANUAL con `generationKwh` negativo: 400.
- MANUAL con menos de 12 meses o monthIndex duplicado: 400.
- INTERNAL con months sin `generationKwh`: sigue funcionando (se ignora generationKwh).
- Enviar `generationSource: "EXPLORADOR_SOLAR"`: 400 "no implementado".

### 6.5 Cotización desde estudio

- Crear cotización desde estudio INTERNAL: sin cambios; resumen FV en cotización = estudio.
- Crear cotización desde estudio MANUAL: resumen FV (potencia, paneles, ahorro anual, pago residual) = KPIs del estudio. Vista previa y PDF sin regresiones.

### 6.6 Labels

- En el formulario, el selector debe mostrar exactamente "Estimación interna" y "Generación mensual manual".
- En el detalle del estudio, el bloque Recurso solar (o cabecera) debe mostrar el mismo texto según `study.generationSource`.

---

## 7. Orden sugerido de implementación

1. **Backend:** Constantes INTERNAL/MANUAL, `validateSolarResource` aceptando MANUAL, `validateAndNormalizeMonthsForManual`, `calculateStudyResultsFromManualGeneration`, ramas en `create` y `update`.
2. **DTO:** Añadir `generationKwh?` en `FvStudyMonthInputDto`.
3. **Frontend tipos:** `CreateFvStudyInput.months` y `UpdateFvStudyInput.months` con `generationKwh?: number`.
4. **Constantes:** Labels "Estimación interna" y "Generación mensual manual".
5. **Formulario:** Estado con `generationSource` y `generationKwh` en meses; selector; tabla con columna generación cuando MANUAL; función de prefill al pasar a MANUAL; aviso al pasar a INTERNAL; envío según fuente.
6. **Detalle:** Revisar que el label de origen use las nuevas cadenas (ya usa `GENERATION_SOURCE_LABELS`).
7. **Pruebas manuales:** Seguir la sección 6.

Con este plan se puede implementar la fase de generación mensual manual sin romper el flujo actual y con los cuatro ajustes solicitados incorporados.

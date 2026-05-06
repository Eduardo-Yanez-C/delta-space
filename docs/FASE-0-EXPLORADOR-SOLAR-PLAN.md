# Fase 0 — Plan de implementación: Recurso solar en Estudio FV

Preparar el sistema para soportar una fuente externa de generación mensual (Explorador Solar u otro), **sin romper el flujo actual** y **sin integrar todavía** la API del Explorador Solar.

**Objetivo:** Modelo de datos, backend y frontend listos para `generationSource`, proveedor solar, coordenadas, geometría del sistema y metadatos del recurso solar, manteniendo la lógica actual cuando `generationSource = INTERNAL`.

---

## 1. Modelo de datos y migración

### 1.1 Campos exactos a agregar a `FvStudy`

Todos **opcionales (nullable)** para no romper estudios existentes y para que el flujo actual no exija su envío.

| Campo | Tipo Prisma | Nullable | Default | Descripción |
|-------|-------------|----------|---------|-------------|
| **generationSource** | String | Sí | `"INTERNAL"` | Origen del dato de generación: `INTERNAL`, `EXPLORADOR_SOLAR`, `MANUAL`, `EXTERNAL`. En Fase 0 solo se usa INTERNAL. |
| **solarResourceProvider** | String? | Sí | — | Identificador del proveedor cuando la fuente es externa (ej. `explorador_solar`). |
| **latitude** | Float? | Sí | — | Latitud del punto de instalación. |
| **longitude** | Float? | Sí | — | Longitud del punto de instalación. |
| **mountingType** | String? | Sí | — | Tipo de montaje: `TECHO`, `SUELO`, `INCLINADO_FIJO`, `SEGUIMIENTO`, etc. |
| **tiltDegrees** | Float? | Sí | — | Inclinación de paneles en grados (0–90). |
| **azimuthDegrees** | Float? | Sí | — | Azimut en grados (ej. 0 = Norte). |
| **solarResourceRequestedAt** | DateTime? | Sí | — | Fecha/hora de la última consulta al recurso externo. |
| **solarResourceMetadata** | String? | Sí | — | Metadatos del proveedor. **Solución temporal como string**; más adelante migrar a JSON estructurado cuando el motor o el uso lo permitan. |

En SQLite no hay tipo `Json` nativo; se usa `String` para `solarResourceMetadata`.

### 1.2 Default de `generationSource`

- En la migración: los registros existentes **no** tienen la columna; al agregar la columna con `@default("INTERNAL")` en Prisma, los estudios ya creados quedarán con valor `INTERNAL` tras la migración.
- En código: al crear un estudio nuevo sin enviar `generationSource`, el backend usará `"INTERNAL"` (o no enviar el campo en el create y dejar que Prisma aplique el default del schema).

### 1.3 ¿Se toca `FvStudyMonth`?

- **No en Fase 0.** La tabla mensual ya tiene `consumptionKwh`, `generationKwh`, `consumptionValue`, `generationValue`, `savingsPercent`, `estimatedPayment`. El origen de la generación es a nivel estudio (`FvStudy.generationSource`). No se agrega campo `generationSource` en `FvStudyMonth` en esta fase.

### 1.4 Compatibilidad con estudios existentes

- **Migración:** Solo agregar columnas nuevas, todas opcionales. `generationSource` con `@default("INTERNAL")` para que filas existentes y nuevas sin valor explícito queden como INTERNAL.
- **Lectura:** El servicio y la API deben devolver los nuevos campos (null o valor). El frontend puede ignorarlos hasta que se muestren en el formulario.
- **Escritura:** Create y Update aceptan los nuevos campos opcionales; si no se envían, se mantiene el comportamiento actual (cálculo interno). Estudios existentes al editarse pueden recibir por primera vez estos campos y guardarlos sin cambiar la lógica de cálculo si `generationSource` sigue siendo INTERNAL o null.

### 1.5 Archivos a modificar (modelo)

- `apps/api/prisma/schema.prisma`: agregar los 9 campos en el modelo `FvStudy`.
- Crear migración: `npx prisma migrate dev --name add_solar_resource_fields_to_fv_study`.

---

## 2. Backend

### 2.1 Respetar `generationSource` en el cálculo

- **Regla en Fase 0:** Si `generationSource` es `null`, ausente o `"INTERNAL"`, se ejecuta **exactamente** la lógica actual: `calculateStudyResults()` con generación mensual = anual/12. No se llama a ningún proveedor externo.
- **No implementar en Fase 0:** Lógica para `EXPLORADOR_SOLAR`, `MANUAL` ni `EXTERNAL`. Si por error llegara un valor distinto de INTERNAL, el backend puede: (a) rechazarlo en validación y devolver Bad Request, o (b) tratarlo como INTERNAL. Se recomienda (a): en Create y Update, si `generationSource` viene informado y no es `INTERNAL`, rechazar con mensaje tipo "En esta versión solo se admite generationSource INTERNAL".
- **Persistencia:** En create y update, si el cliente envía `latitude`, `longitude`, `tiltDegrees`, `azimuthDegrees`, `mountingType`, `solarResourceProvider`, `solarResourceRequestedAt`, `solarResourceMetadata`, se guardan en BD. Si no envía `generationSource`, no setearlo en el create (Prisma aplicará default "INTERNAL") o setear explícitamente `"INTERNAL"`.

### 2.2 Validaciones a agregar

- **generationSource:** Si se envía, solo aceptar `"INTERNAL"`. Cualquier otro valor → `BadRequestException` con mensaje claro.
- **latitude:** Si se envía, debe ser número entre -90 y 90.
- **longitude:** Si se envía, debe ser número entre -180 y 180.
- **tiltDegrees:** Si se envía, debe ser número entre 0 y 90.
- **azimuthDegrees:** Si se envía, debe ser número entre 0 y 360 (o -180 y 180 según convención; documentar).
- **mountingType:** Si se envía, aceptar una lista blanca (ej. `TECHO`, `SUELO`, `INCLINADO_FIJO`, `SEGUIMIENTO`, `OTRO`) o cualquier string corto; si se restringe, rechazar valores no permitidos.
- **solarResourceMetadata:** Si se envía, validar que sea string (y opcionalmente que sea JSON válido para evitar guardar basura).
- **solarResourceRequestedAt:** Si se envía, debe ser fecha válida (ISO string o timestamp); el backend puede convertir a Date.
- No exigir coordenadas ni geometría cuando `generationSource = INTERNAL`; son opcionales en Fase 0.

### 2.3 Mantener comportamiento actual cuando la fuente es INTERNAL

- En `create`: no cambiar la secuencia actual: validar meses, llamar a `calculateStudyResults()` con los mismos parámetros de siempre, crear `FvStudy` con los resultados y los nuevos campos opcionales (los que vengan en el DTO), crear los 12 `FvStudyMonth` con los `monthlyResults` calculados (generación mensual = anual/12). No condicional por `generationSource` en la rama de cálculo; en Fase 0 siempre se calcula igual.
- En `update`: si se envían `months` y/o parámetros que disparen recálculo, seguir usando `calculateStudyResults()` y actualizar estudio y meses igual que hoy. Los campos nuevos (lat, lon, tilt, azimuth, mountingType, provider, metadata, requestedAt) se actualizan si vienen en el DTO; `generationSource` si viene y es INTERNAL se guarda, si es otro valor se rechaza.
- `toResponse`: incluir en el objeto devuelto todos los campos nuevos del estudio (generationSource, solarResourceProvider, latitude, longitude, mountingType, tiltDegrees, azimuthDegrees, solarResourceRequestedAt, solarResourceMetadata) para que el frontend pueda mostrarlos y editarlos.

### 2.4 DTOs

- **CreateFvStudyDto:** Agregar propiedades opcionales: `generationSource?`, `solarResourceProvider?`, `latitude?`, `longitude?`, `mountingType?`, `tiltDegrees?`, `azimuthDegrees?`, `solarResourceRequestedAt?`, `solarResourceMetadata?`.
- **UpdateFvStudyDto:** Las mismas propiedades opcionales para actualización parcial.
- No cambiar la estructura de `months` ni de `FvStudyMonthInputDto`.

### 2.5 Archivos a modificar (backend)

- `apps/api/prisma/schema.prisma` — ya indicado.
- `apps/api/src/modules/fv-study/dto/create-fv-study.dto.ts` — agregar campos opcionales.
- `apps/api/src/modules/fv-study/dto/update-fv-study.dto.ts` — agregar campos opcionales.
- `apps/api/src/modules/fv-study/fv-study.service.ts`:
  - En `create`: validar generationSource si viene (solo INTERNAL); validar lat/lon/tilt/azimuth si vienen; añadir al `data` de `prisma.fvStudy.create` los nuevos campos cuando vengan en el DTO; no cambiar la llamada a `calculateStudyResults` ni la creación de meses.
  - En `update`: misma validación de generationSource y geometría; en `updateData` añadir los nuevos campos cuando vengan en el DTO; no cambiar la lógica de recálculo.
  - En `toResponse`: añadir los 9 campos al objeto retornado (y al tipo del parámetro `row`).
- Opcional: extraer función `validateSolarResourceInput(dto)` para no duplicar validaciones entre create y update.

---

## 3. Frontend

### 3.1 Campos nuevos en el formulario del estudio

Agregar una **sección "Recurso solar"** (o "Ubicación y geometría del sistema") con campos opcionales:

| Campo en formulario | Estado en form | Tipo input | Mapeo API |
|--------------------|----------------|------------|-----------|
| **Origen de la generación** | Solo lectura por ahora | Select o texto fijo | `generationSource` (mostrar "Estimación interna (promedio anual/12)" cuando sea INTERNAL) |
| **Latitud** | Editable | number, paso 0.000001 | `latitude` |
| **Longitud** | Editable | number, paso 0.000001 | `longitude` |
| **Tipo de montaje** | Editable | Select (TECHO, SUELO, INCLINADO_FIJO, SEGUIMIENTO, OTRO) | `mountingType` |
| **Inclinación (°)** | Editable | number 0–90 | `tiltDegrees` |
| **Azimut (°)** | Editable | number 0–360 | `azimuthDegrees` |
| **Proveedor de recurso** | Editable (por ahora vacío o deshabilitado) | Text o select | `solarResourceProvider` |

No mostrar en el formulario en Fase 0 (o mostrar en solo lectura): `solarResourceRequestedAt`, `solarResourceMetadata` (son de uso interno / futura integración).

### 3.2 Cómo se mostrará la sección "Recurso solar"

- **Ubicación:** Después de la sección de "Parámetros técnicos y conexión" (donde están potencia por panel, cobertura, tipo conexión, tipo proyecto) o antes de "Consumos mensuales".
- **Título:** "Recurso solar" o "Ubicación y geometría para recurso solar".
- **Texto de ayuda (UX importante):** Debajo del título o al pie de la sección, un párrafo breve:  
  *"Por ahora la generación mensual se calcula con una estimación interna (promedio anual/12). Puede completar ubicación e inclinación para preparar una futura integración con el Explorador Solar u otra fuente de recurso solar."*
- **Origen de la generación:** Mostrar como texto informativo o select deshabilitado: "Estimación interna (promedio anual/12)". No permitir cambiar a Explorador Solar todavía.
- **Resto de campos:** Inputs opcionales; si el usuario no los completa, el estudio se guarda igual (backend acepta null).

### 3.3 Qué queda visible pero no activo respecto al Explorador Solar

- **Visible:** Sección "Recurso solar", campos latitud, longitud, inclinación, azimut, tipo de montaje. Texto explicando que la generación sigue siendo interna y que estos datos preparan la futura integración.
- **No activo / no implementado:** Botón "Obtener generación desde Explorador Solar", selector de fuente "Explorador Solar", llamada a API externa, uso de coordenadas para cálculo. El select "Origen de la generación" solo muestra INTERNAL y no es editable (o no se muestra el select y solo el texto).

### 3.4 Archivos a modificar (frontend)

- `apps/web/lib/api.ts`: En tipos `FvStudy`, `CreateFvStudyInput`, `UpdateFvStudyInput` agregar: `generationSource?`, `solarResourceProvider?`, `latitude?`, `longitude?`, `mountingType?`, `tiltDegrees?`, `azimuthDegrees?`, `solarResourceRequestedAt?`, `solarResourceMetadata?`.
- `apps/web/app/estudios-fv/constants.ts`: Opcionalmente definir `MOUNTING_TYPE_OPTIONS`, `GENERATION_SOURCE_LABELS` (INTERNAL → "Estimación interna (promedio anual/12)").
- `apps/web/app/estudios-fv/EstudioFvForm.tsx`:
  - En `FormState` agregar: `latitude`, `longitude`, `mountingType`, `tiltDegrees`, `azimuthDegrees`, `solarResourceProvider` (como strings para inputs), y opcionalmente `generationSource` solo para mostrar.
  - En `toFormState`: leer del estudio los nuevos campos (o vacío en create).
  - En el JSX: nueva sección "Recurso solar" con los inputs anteriores y el texto de ayuda.
  - En `handleSubmit`: al armar el payload para create/update, incluir los nuevos campos (solo si tienen valor o enviar null/undefined según convenga al backend).
- `apps/web/app/estudios-fv/[id]/EstudioFvDetalleView.tsx`: Opcional en Fase 0: en el detalle del estudio, mostrar una línea o bloque "Recurso solar" con los valores guardados (lat, lon, tilt, azimut, tipo montaje, origen = Interno). Si no se muestra en Fase 0, no es obligatorio; puede dejarse para cuando la integración esté activa.

---

## 4. Persistencia y UX

### 4.1 Cómo se guardan latitud, longitud, tilt, azimut, mountingType y provider

- **Crear estudio:** El frontend envía en el body de `POST /api/fv-studies` los campos opcionales que el usuario haya completado (latitude, longitude, tiltDegrees, azimuthDegrees, mountingType, solarResourceProvider). No enviar `generationSource` o enviar `"INTERNAL"`. El backend valida rangos y lista blanca, luego en `prisma.fvStudy.create` incluye esos campos en `data`; los no enviados quedan null por defecto.
- **Editar estudio:** El frontend envía en `PATCH /api/fv-studies/:id` solo los campos que cambien (o todos los de la sección recurso solar). El backend actualiza con `updateData` los que vengan en el DTO. Si el usuario borra un valor (ej. deja latitud vacío), el frontend puede enviar `null` para ese campo y el backend debe persistir null.
- **Proveedor:** `solarResourceProvider` se guarda como string; en Fase 0 puede quedar vacío o null. No se usa aún para ninguna lógica.

### 4.2 Cómo se explica al usuario que el cálculo sigue siendo interno

- **En el formulario (crear/editar):** Texto de ayuda dentro de la sección "Recurso solar":  
  *"Por ahora la generación mensual se calcula con una estimación interna (promedio anual/12). Los datos de ubicación e inclinación quedarán guardados para una futura integración con el Explorador Solar u otra fuente de recurso solar."*
- **Opcional:** En la cabecera del bloque de resultados (KPIs o tabla mensual) del detalle del estudio, una línea discreta: "Generación estimada con método interno (promedio anual/12)." Así se refuerza que no viene de una API externa hasta que se implemente la Fase 1.

---

## 5. Pruebas

### 5.1 Cómo probar que no se rompe el flujo actual

1. **Crear estudio sin nuevos campos:** Crear un estudio como hoy (solo datos obligatorios + 12 consumos). Verificar que se crea correctamente, que los KPIs y la tabla mensual son los mismos que antes, y que la generación mensual es constante (anual/12).
2. **Editar estudio existente sin tocar recurso solar:** Abrir un estudio ya existente (creado antes de la migración), editar solo título o un consumo mensual, guardar. Verificar que no hay error y que los resultados se recalculan igual que antes. Verificar que en la respuesta del GET el estudio tiene `generationSource: "INTERNAL"` (o el default aplicado) y los campos nuevos en null o con valor por defecto.
3. **Crear estudio con todos los campos obligatorios de siempre:** Misma prueba que 1, asegurando que no se exige lat/lon/tilt para poder guardar.
4. **Listado y detalle:** Listar estudios y abrir detalle; no debe haber errores 500 ni campos faltantes que rompan la UI. Si el frontend ya muestra la sección "Recurso solar" en detalle, los estudios viejos deben verse con campos vacíos o "Estimación interna".

### 5.2 Cómo probar que los nuevos campos se guardan bien

1. **Crear estudio con recurso solar:** Completar latitud, longitud, inclinación, azimut, tipo de montaje (y opcionalmente proveedor). Guardar. Luego GET del estudio y verificar que los valores están en la respuesta (latitude, longitude, tiltDegrees, azimuthDegrees, mountingType, solarResourceProvider). Verificar que el cálculo sigue siendo el mismo (generación = anual/12) y que los KPIs no cambian por el hecho de tener coordenadas.
2. **Editar estudio y agregar recurso solar:** Estudio creado sin recurso solar; en edición completar lat, lon, tilt, azimut, tipo montaje. Guardar. GET y verificar que los valores persisten.
3. **Editar estudio y borrar recurso solar:** Estudio con coordenadas e inclinación; en edición vaciar latitud y longitud (y enviar null o no enviar). Guardar. GET y verificar que latitude y longitude son null; el resto de campos que no se tocaron siguen igual.
4. **Validaciones backend:** Enviar latitude = 100 o longitude = 200 → esperar 400. Enviar tiltDegrees = -10 o 95 → 400. Enviar generationSource = "EXPLORADOR_SOLAR" → 400 con mensaje de "solo INTERNAL admitido" (o el mensaje que se defina). Enviar mountingType con valor no permitido si hay lista blanca → 400.

### 5.3 Checklist de regresión

- [ ] Crear estudio (sin recurso solar) → OK, resultados iguales que antes.
- [ ] Editar estudio existente (sin recurso solar) → OK, recálculo correcto.
- [ ] Crear cotización desde estudio → OK (no depende de los nuevos campos).
- [ ] Vista previa/PDF de cotización con estudio origen → OK.
- [ ] Crear estudio con recurso solar completo → datos guardados, cálculo interno.
- [ ] GET estudio devuelve generationSource y campos nuevos.
- [ ] Validaciones de lat/lon/tilt/azimuth/generationSource rechazan valores inválidos.

---

## 6. Orden sugerido de implementación

1. **Schema y migración** — Agregar campos en Prisma y ejecutar migración.
2. **DTOs y validaciones backend** — Create/Update DTOs, validaciones en servicio (generationSource solo INTERNAL, rangos de lat/lon/tilt/azimuth, mountingType).
3. **Servicio: create/update/toResponse** — Persistir y devolver los nuevos campos sin cambiar la lógica de `calculateStudyResults`.
4. **API types y formulario frontend** — Tipos en `api.ts`, FormState y sección "Recurso solar" en EstudioFvForm, texto de ayuda, envío de campos en submit.
5. **Detalle del estudio (opcional)** — Mostrar recurso solar guardado en EstudioFvDetalleView.
6. **Pruebas manuales** — Seguir apartado 5.

---

*Documento de plan Fase 0. Implementar según este plan; no integrar aún la API del Explorador Solar.*

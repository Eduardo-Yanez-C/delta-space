# Checklist de validación funcional — Fase 2: Matching con catálogo

Cierre y validación de la Fase 2 antes de abrir nuevos frentes. No incluye gráficos en PDF ni plantillas predeterminadas.

**Contexto de prueba:** Usar el seed actual (paneles 430 W / 550 W, inversores Fronius 3.6 mono / 10 trifásico / Huawei 100K, estructuras K2 D-Dome / TopFix, precios vigentes según seed). Usuario con permiso para crear cotización desde estudio (ej. ADMIN o VENTAS).

---

## 1. Casos de match de paneles

| # | Caso | Pasos | Resultado esperado | ✓ |
|---|------|--------|---------------------|---|
| 1.1 | **Match por potencia dentro de tolerancia (±15%)** | Crear estudio FV con ~430 Wp por panel (ej. sistema que dé 430 Wp). Crear cotización desde estudio con ítems sugeridos. | Ítem 1 (paneles) con **“Desde catálogo”**, producto tipo 430 W (ej. Longi Hi-MO 6 430W si existe en catálogo), cantidad = cantidad de paneles del estudio, precio unitario y total coherentes. | |
| 1.2 | **Desempate por cercanía y precio** | Si hay varios paneles en rango (ej. 430 y 440 W), el elegido debe ser el más cercano a la potencia del estudio; si hay empate de distancia, el que tenga precio vigente. | Un solo producto seleccionado; ítem muestra nombre/descripción del producto elegido y precio. | |
| 1.3 | **Fuera de tolerancia → manual** | Estudio con potencia por panel muy distinta al catálogo (ej. 200 Wp o 700 Wp) donde ningún panel esté en ±15%. | Ítem paneles con **“Manual”**, texto genérico “Suministro de paneles fotovoltaicos” y descripción con cantidad/Wp del estudio, precio 0. | |
| 1.4 | **Categoría paneles inexistente** | (Solo si se puede simular: ej. slug distinto o sin categoría paneles.) Crear cotización desde estudio. | Ítem paneles manual con texto genérico. | |

---

## 2. Casos de match de inversor

| # | Caso | Pasos | Resultado esperado | ✓ |
|---|------|--------|---------------------|---|
| 2.1 | **Match por conexión y rango 80%–120%** | Estudio MONOFASICO, potencia sistema ej. 3–4 kW. Crear cotización desde estudio. | Ítem inversor **“Desde catálogo”** con inversor monofásico en rango (ej. Fronius Primo 3.6-1 si existe y tiene precio), cantidad 1. | |
| 2.2 | **Prioridad trifásico** | Estudio TRIFASICO, potencia sistema ej. 8–12 kW. Crear cotización desde estudio. | Ítem inversor **“Desde catálogo”** con inversor trifásico en rango (ej. Fronius Symo 10.0-3 si existe y tiene precio). | |
| 2.3 | **Sin match por conexión → segunda pasada** | Estudio TRIFASICO pero en catálogo solo inversores monofásicos en rango de potencia. | Si hay algún inversor en rango (aunque sea mono), puede elegirse en segunda pasada; si no hay ninguno en rango → ítem inversor **“Manual”**. | |
| 2.4 | **Potencia sistema fuera de rango** | Estudio con potencia sistema tal que ningún inversor del catálogo esté en 80%–120% (ej. 50 kW con solo inversores 3.6 y 10 kW). | Ítem inversor **“Manual”** con texto genérico. | |

---

## 3. Casos de match de estructura

| # | Caso | Pasos | Resultado esperado | ✓ |
|---|------|--------|---------------------|---|
| 3.1 | **Match por tipo de montaje** | Estudio con `mountingType` TECHO (o tipo que coincida con nombre/descripción de un producto, ej. “techo”, “cubierta”). Crear cotización desde estudio. | Ítem estructura **“Desde catálogo”** con producto que mencione techo/cubierta (ej. K2 TopFix o D-Dome según seed), si tiene precio vigente. | |
| 3.2 | **Sin coincidencia de montaje → manual** | Estudio con `mountingType` SUELO (o otro) y catálogo solo con estructuras de techo. | Ítem estructura **“Manual”**; no se elige un producto de techo. Texto genérico con tipo de montaje y cantidad de paneles. | |
| 3.3 | **Varios productos mismo montaje** | Si hay más de un producto que coincida en tipo de montaje, se elige uno (con precio vigente preferido). | Un solo ítem estructura; badge “Desde catálogo” si tiene precio. | |

---

## 4. Fallback manual (sin precio o sin match)

| # | Caso | Pasos | Resultado esperado | ✓ |
|---|------|--------|---------------------|---|
| 4.1 | **Producto candidato sin precio vigente** | Candidato que cumple match (panel/inversor/estructura) pero sin `ProductPrice` vigente (validFrom/validTo). | Ítem correspondiente **“Manual”** con texto genérico del estudio (no ítem con productId y precio 0). | |
| 4.2 | **Sin match en los tres** | Estudio que no haga match en paneles, ni inversor, ni estructura (potencia fuera de rango, sin inversor en rango, montaje sin coincidencia). | Tres ítems (paneles, inversor, estructura) **“Manual”** con textos genéricos; instalación e ingeniería también manuales. | |
| 4.3 | **Mezcla match + manual** | Estudio donde solo uno o dos tipos hagan match (ej. solo paneles, o solo inversor). | Ítems con match → “Desde catálogo”; resto → “Manual”. Total 5 ítems, orden 1–5. | |
| 4.4 | **createWithSuggestedItems: false** | Crear cotización desde estudio enviando en el body `createWithSuggestedItems: false` (o equivalente en la UI si existe). | Cotización con versión inicial **sin ítems** (comportamiento Fase 1). | |

---

## 5. Señal visual “Desde catálogo” / “Manual”

| # | Caso | Pasos | Resultado esperado | ✓ |
|---|------|--------|---------------------|---|
| 5.1 | **Columna Origen visible** | Abrir detalle de una cotización que tenga ítems (con o sin match). | Tabla de ítems tiene columna **“Origen”** con un valor en cada fila. | |
| 5.2 | **Badge “Desde catálogo”** | Cotización con al menos un ítem desde producto (productId no nulo). | Ese ítem muestra badge/texto **“Desde catálogo”** (estilo distintivo, ej. verde). | |
| 5.3 | **Badge “Manual”** | Ítems sin producto (productId nulo), incluidas instalación e ingeniería. | Cada uno muestra **“Manual”** (estilo distinto, ej. gris). No dejar ningún ítem sin etiqueta. | |
| 5.4 | **Consistencia al recargar** | Tras crear cotización desde estudio, recargar la página del detalle. | Los mismos ítems siguen mostrando “Desde catálogo” o “Manual” según corresponda. | |

---

## 6. Edición posterior de ítems y recálculo de totales

| # | Caso | Pasos | Resultado esperado | ✓ |
|---|------|--------|---------------------|---|
| 6.1 | **Editar ítem desde catálogo** | En cotización con ítem “Desde catálogo”, abrir Editar ítem y cambiar cantidad o precio (si el rol lo permite). Guardar. | Cambios guardados; total de línea y totales de versión se recalculan. | |
| 6.2 | **Editar ítem manual** | En ítem “Manual”, editar nombre, descripción, cantidad o precio. Guardar. | Cambios guardados; totales actualizados. | |
| 6.3 | **Eliminar ítem** | Eliminar un ítem (manual o desde catálogo). | Ítem desaparece; subtotal y total de la versión se recalculan. | |
| 6.4 | **Agregar ítem nuevo** | Agregar ítem desde producto o ítem manual después de crear la cotización desde estudio. | Nuevo ítem aparece en la tabla con su badge “Desde catálogo” o “Manual”; totales correctos. | |
| 6.5 | **Totales coherentes** | Cotización con ítems con precio: revisar subtotal, descuentos e IVA si aplican. | Subtotal = suma de totales de línea; total final coherente con parámetros de versión. | |

---

## Resumen de cierre

- **Sección 1 (Paneles):** _____ / 4
- **Sección 2 (Inversor):** _____ / 4
- **Sección 3 (Estructura):** _____ / 3
- **Sección 4 (Fallback manual):** _____ / 4
- **Sección 5 (Señal visual):** _____ / 4
- **Sección 6 (Edición y totales):** _____ / 5

**Fase 2 considerada cerrada cuando todas las casillas relevantes están validadas y no hay regresiones en el flujo Cliente → Estudio FV → Cotización.**

---

## Notas

- Los números de ítem (1–5) y el orden (paneles, inversor, estructura, instalación, ingeniería) se mantienen.
- La creación de cotización desde estudio sigue siendo una sola transacción (quote + versión + ítems + recálculo + actualización estado estudio).
- Si algún caso del checklist no es aplicable al entorno (ej. no se puede quitar la categoría paneles), anotar “N/A” y el motivo.

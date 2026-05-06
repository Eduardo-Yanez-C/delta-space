# Plan: Gráficos del estudio FV en vista previa / PDF de cotización

## Objetivo

Cuando la cotización tenga `sourceFvStudyId`, mostrar en la vista previa (y en impresión/PDF) además del bloque “Resumen fotovoltaico” los **gráficos del estudio**: Generación vs consumo por mes y Pago estimado por mes. Sin tocar plantillas ni API Explorador Solar.

## Reglas

1. **Con `sourceFvStudyId`:** Mostrar resumen FV numérico + gráficos del estudio.
2. **Sin `sourceFvStudyId`:** Comportamiento actual (resumen desde cálculo FV si existe; no agregar gráficos al cálculo rápido).
3. **Gráficos mínimos:** Generación vs consumo por mes; Pago estimado por mes.
4. **Pantalla e impresión/PDF:** Gráficos legibles y con buen aspecto en ambos.
5. **Reutilización:** Reutilizar componentes de gráficos del estudio (EstudioFvGraficos) donde sea posible.

---

## 1. Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| **`apps/web/app/cotizaciones/[id]/vista-previa/page.tsx`** | Al cargar el estudio (`fetchFvStudy`), conservar además del resumen los `months` del estudio. Pasar a `CotizacionVistaPrevia` una nueva prop opcional con los meses (y la moneda ya disponible en el resumen). |
| **`apps/web/app/cotizaciones/[id]/CotizacionVistaPrevia.tsx`** | Añadir props opcionales: `fvStudyMonths` (array de 12 meses con `monthIndex`, `generationKwh`, `consumptionKwh`, `estimatedPayment`) y reutilizar la lógica de gráficos. Si `showFvFromStudy && fvStudyMonths?.length`, renderizar una nueva sección “Gráficos del estudio” debajo del bloque “Resumen fotovoltaico” con los dos gráficos. |
| **`apps/web/app/estudios-fv/EstudioFvGraficos.tsx`** | Opción A: Exportar y usar tal cual desde la vista previa (recibe `months` y `currency`). Opción B: Extraer un componente compartido que reciba solo datos ya transformados (arrays para Recharts) y opcionalmente un prop `variant="preview"` para altura/tamaño fijo en impresión. Se recomienda **Opción A** primero: usar `EstudioFvGraficos` en la vista previa con los mismos `months`; si hace falta ajuste de tamaño para PDF, añadir un prop opcional `compact?: boolean` o `forPrint?: boolean` que reduzca altura. |
| **`apps/web/app/estudios-fv/constants.ts`** | Ya exporta `MESES_NOMBRES`; usado por EstudioFvGraficos. No hace falta tocar si los gráficos se reutilizan desde cotizaciones (el import en EstudioFvGraficos sigue siendo de `./constants`). |
| **`apps/web/app/globals.css`** o estilos de vista previa | Añadir reglas `@media print` para la sección de gráficos: evitar cortes feos (p. ej. `break-inside: avoid` en el contenedor de cada gráfico o de la sección), y si hace falta un ancho/alto fijo para Recharts en impresión, aplicarlo en el contenedor. |

**No tocar:** Backend, API Explorador Solar, plantillas de documento, flujo de cotizaciones sin estudio.

---

## 2. Reutilización de componentes de gráficos

- **EstudioFvGraficos** hoy recibe `{ months: FvStudyMonth[]; currency: string }` y construye internamente:
  - `dataGenVsConsumo`: por mes, `generacion` y `consumo` (desde `generationKwh`, `consumptionKwh`).
  - `dataPago`: por mes, `Pago estimado` (desde `estimatedPayment`).
- **Reutilización:** En la página de vista previa ya se hace `fetchFvStudy(quote.sourceFvStudyId)` y se obtiene el estudio completo, que incluye `months` (si el backend los devuelve en el detalle). Se pasará `study.months` y `study.currency` (o el del resumen) a `CotizacionVistaPrevia`. Dentro de esta, cuando `showFvFromStudy && fvStudyMonths?.length`, se renderizará la sección “Gráficos del estudio” y se usará **el mismo componente** `<EstudioFvGraficos months={fvStudyMonths} currency={currency} />`.
- **Ajuste opcional para impresión:** Si en impresión los gráficos quedan demasiado altos o se cortan, se puede añadir a `EstudioFvGraficos` un prop opcional `compact?: boolean`. Cuando `compact === true`, usar una altura fija menor (p. ej. `h-48` o `h-52` en lugar de `h-64`) y márgenes más pequeños, y que la vista previa pase `compact={true}` siempre, o solo cuando se detecte impresión (menos recomendable por complejidad). Alternativa: en la vista previa envolver los gráficos en un contenedor con clase que en `@media print` fije altura (p. ej. `print:h-[240px]`) y que `EstudioFvGraficos` reciba `className` o `height` para el `ResponsiveContainer`. La opción más simple es usar `EstudioFvGraficos` tal cual y, si hace falta, añadir un prop `heightChart?: number` (por defecto 256) para el `ResponsiveContainer` y que la vista previa pase 220 o 200 en impresión vía clase en el wrapper.

**Recomendación:** Usar `EstudioFvGraficos` sin cambios iniciales. Si en las pruebas de impresión los gráficos se cortan o ocupan demasiado, añadir un prop `chartHeight?: number` (por defecto 256) y en la vista previa pasar un valor algo menor (p. ej. 200) para que en pantalla y en PDF quepan bien.

---

## 3. Layout en vista previa / PDF

- **Orden del documento:** Encabezado → Datos cotización → Tabla de ítems → Resumen económico → **Resumen fotovoltaico** (KPIs) → **Gráficos del estudio** (solo si `sourceFvStudyId` y hay meses) → Condiciones y notas → Footer.
- **Sección “Gráficos del estudio”:**
  - Título: “Gráficos del estudio FV” o “Análisis mensual del estudio FV”.
  - Subtexto opcional: “Basado en Estudio FV: [título]” (ya existe en el resumen; puede repetirse o no).
  - Dos bloques en columna (uno debajo del otro): primero “Generación vs consumo (kWh/mes)”, luego “Pago estimado por mes (moneda)”.
  - En pantalla: mismo estilo que el resto del documento (espaciado, bordes suaves). En impresión: la sección completa con `break-inside: avoid` para intentar que no parta entre los dos gráficos; si no cabe en una página, el navegador puede cortar igual, pero se evita partir un gráfico por la mitad.

---

## 4. Tamaños y saltos de página

- **Pantalla:** Dejar que `EstudioFvGraficos` use su altura actual (`h-64` = 256px por gráfico). Si la vista previa tiene ancho contenido (`max-w-4xl`), los gráficos se adaptan por `ResponsiveContainer`.
- **Impresión/PDF:**
  - Aplicar `break-inside: avoid` al contenedor de la sección “Gráficos del estudio” o a cada gráfico, para reducir cortes en medio de un gráfico.
  - Si los SVGs de Recharts en impresión salen cortados o con altura excesiva, dar al contenedor de cada gráfico una altura fija en print (p. ej. `print:h-[200px]` o `print:min-h-[180px] print:max-h-[220px]`) y asegurar que el `ResponsiveContainer` de Recharts use `height="100%"` dentro de ese contenedor.
  - No forzar saltos de página adicionales (evitar `page-break-before` a menos que sea estrictamente necesario); priorizar que los gráficos se vean completos.
- **Recharts en print:** Recharts genera SVG; en la mayoría de navegadores el SVG se imprime bien si el contenedor tiene dimensiones definidas. Si en algún navegador el gráfico no se dibuja en la impresión, comprobar que el contenedor tenga `width` y `height` explícitos en el contexto de `@media print` (p. ej. contenedor con `width: 100%` y `height: 200px`).

---

## 5. Cómo probar

1. **Cotización con estudio**
   - Crear un estudio FV con 12 meses cargados (consumo y generación).
   - Crear cotización desde ese estudio.
   - Ir a Vista previa de la cotización.
   - Verificar: bloque “Resumen fotovoltaico” con KPIs; debajo, sección “Gráficos del estudio FV” con dos gráficos (Generación vs consumo; Pago estimado por mes).
   - Imprimir (o “Guardar como PDF”) y comprobar que los dos gráficos se ven completos y legibles en el PDF.
2. **Cotización sin estudio**
   - Cotización creada a mano (sin `sourceFvStudyId`).
   - Vista previa: no debe aparecer la sección de gráficos; si hay cálculo FV, solo el resumen numérico actual.
3. **Cotización con estudio pero sin meses**
   - Caso borde: estudio sin meses en la respuesta (o array vacío). No mostrar la sección de gráficos; solo el resumen FV numérico.
4. **Regresión**
   - Vista previa de una cotización con cálculo rápido (sin estudio): sin cambios.
   - Detalle del estudio FV: los gráficos siguen igual (EstudioFvGraficos sin cambios de contrato).

---

## 6. Resumen de datos y props

- **vista-previa/page.tsx:** Ya obtiene `study` con `fetchFvStudy`. Construir `fvSummaryFromStudy` como ahora y además pasar `fvStudyMonths = study.months ?? []` y `currency` (de `study.currency` o del resumen) a `CotizacionVistaPrevia`.
- **CotizacionVistaPrevia:** Nuevas props opcionales: `fvStudyMonths?: FvStudyMonth[] | null`, y reutilizar `currency` de `quote.currency` o de `fvSummaryFromStudy.currency`. Si `showFvFromStudy && fvStudyMonths && fvStudyMonths.length > 0`, renderizar la sección con `<EstudioFvGraficos months={fvStudyMonths} currency={currency} />`.
- **Tipos:** Usar `FvStudyMonth` de `lib/api.ts` en la vista previa; no hace falta un tipo nuevo.

---

## 7. Orden sugerido de implementación

1. En **vista-previa/page.tsx**: al armar el estado cuando existe `sourceFvStudyId`, guardar también `study.months` en un estado (o pasar directamente al componente) y pasar a `CotizacionVistaPrevia` las props `fvStudyMonths` y la moneda.
2. En **CotizacionVistaPrevia**: añadir las props, importar `EstudioFvGraficos` y, cuando corresponda, renderizar la sección “Gráficos del estudio FV” con los dos gráficos.
3. Probar en pantalla: cotización con estudio → se ven resumen + gráficos.
4. Ajustar estilos de impresión en **globals.css** (o en el componente): `break-inside: avoid` y, si hace falta, altura fija para los contenedores de gráficos en `@media print`.
5. Probar impresión/PDF y ajustar altura o márgenes si los gráficos se cortan.
6. (Opcional) Si se requiere tamaño distinto en vista previa, añadir a `EstudioFvGraficos` el prop `chartHeight` y usarlo en la vista previa.

Con esto la vista previa y el PDF de la cotización incluyen los gráficos del estudio cuando la cotización proviene de un Estudio FV, sin tocar plantillas ni Explorador Solar.

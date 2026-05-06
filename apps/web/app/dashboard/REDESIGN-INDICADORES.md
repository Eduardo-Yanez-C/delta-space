# Rediseño: Bloque Indicadores externos (Chile)

## 1. Diagnóstico breve — por qué se ve simple

- **Paleta plana**: Todo en tonos sky (sky-50, sky-100, sky-200, sky-600). Poca jerarquía y sensación genérica.
- **Sin profundidad**: Bordes finos y casi sin sombra; las cards no se separan del fondo.
- **Tipografía pequeña**: Títulos `text-sm`, labels `text-xs`; el bloque no destaca.
- **Charts técnicos**:
  - **Eje Y cortado**: `margin: { left: -16 }` y `width={36}` en YAxis dejan poco espacio; los ticks se cortan o se solapan.
  - **Invalid Date**: `formatPointLabel` usa `fecha + "T12:00:00"`. Si la API envía fecha ya en ISO (`"2025-03-01T00:00:00.000Z"`), queda `"2025-03-01T00:00:00.000ZT12:00:00"` → `Invalid Date`.
  - **Layout apretado**: `bottom: 0` y poca altura (120px) hacen que el eje X y los labels queden pegados o cortados.
- **Tabs genéricos**: Botones sky planos; no transmiten “premium”.
- **Sin color semántico**: Los tres indicadores se ven iguales; no hay identidad visual por indicador.

---

## 2. Propuesta de rediseño concreta

### Contenedor principal
- Fondo: `bg-white` con `border border-slate-200/80` y `shadow-sm`.
- Padding: `p-6` (o `px-6 py-5`).
- Título: `text-base font-semibold text-slate-900` (o `text-lg`).
- Subtítulo: `text-xs text-slate-500 tracking-wide` o similar; más aire bajo el título.

### Cards de valor actual
- Cada card: `rounded-xl`, `border border-slate-200`, `bg-white`, `shadow-sm`, `p-4`.
- Borde izquierdo o icono con color por indicador (sin ser chillón):
  - **Dólar**: acento verde/emerald (ej. `border-l-4 border-emerald-500` o `bg-emerald-50/50`).
  - **UF**: acento azul/slate (ej. `border-l-4 border-slate-600`).
  - **IPC**: acento violeta (ej. `border-l-4 border-violet-500`).
- Valor: `text-xl font-semibold text-slate-900` (o `text-2xl` en desktop).
- Label: `text-xs font-medium uppercase tracking-wider text-slate-500`.

### Tabs (Semanal / Mensual / Anual)
- Contenedor: `flex gap-1 p-1 rounded-xl bg-slate-100/80` (estilo “pill group”).
- Inactivo: `px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200/60`.
- Activo: `bg-white text-slate-900 shadow-sm` (o `bg-slate-800 text-white` si se prefiere más contraste).

### Mini gráficos
- Contenedor por chart: card igual que las de valor (`rounded-xl`, `border`, `shadow-sm`), `p-4`, altura ~140–160px.
- **Eje Y**:
  - `domain={['auto', 'auto']}` o calcular min/max con margen (ej. `domain={[min * 0.98, max * 1.02]}`).
  - `width={44}` (o 48) y `margin={{ left: 44, right: 16, top: 12, bottom: 28 }}` para que no se corte y los números entren.
- **Eje X**:
  - Formateo de fechas robusto: función que reciba `fecha` (string ISO o solo fecha), parsee con `new Date(...)` usando solo la parte de fecha si incluye "T", y formatee con `toLocaleDateString('es-CL', ...)` según período (semanal/mensual/anual). Nunca concatenar `"T12:00:00"` a una cadena que ya sea ISO completa.
- **Línea**: `strokeWidth={2}`, color por indicador (emerald-600, slate-600, violet-600) o un único slate-700.
- **Tooltip**: `contentStyle` con `borderRadius`, `boxShadow`; `labelFormatter` mostrando la fecha ya formateada (ej. “Mar 2025” o “01/03” según período).

### Footer (actualizado / fuente)
- `text-xs text-slate-400`; separador sutil; mismo contenido que ahora.

### Responsividad
- Grid de cards y de charts: `grid-cols-1 sm:grid-cols-3`; en móvil apilar. Mantener padding y márgenes proporcionales.

---

## 3. Archivos a tocar

| Archivo | Cambios |
|--------|---------|
| `web/app/dashboard/DashboardIndicadoresExternos.tsx` | Todo el rediseño: estilos del bloque, cards, tabs, mini charts; corrección de `formatPointLabel` y parsing de fechas; márgenes y domain del LineChart; YAxis width; Tooltip. |
| *(opcional)* `web/app/globals.css` | Solo si se añaden variables CSS para colores de indicadores (no imprescindible). |

No tocar: `page.tsx` (dashboard), API, ni backend. Solo componente de indicadores y, si se usa, un helper de formato de fecha reutilizable.

---

## 4. Correcciones técnicas obligatorias

1. **Eje Y no cortado**: `margin.left` ≥ 40, `YAxis width={44}` (o 48), y `domain={['auto', 'auto']}` para que Recharts calcule bien el rango.
2. **Invalid Date en eje X**: Parsear `fecha` de forma segura (extraer parte fecha si es ISO; usar `new Date(part)` o `new Date(fecha)` si ya es válido); luego formatear con `toLocaleDateString`.
3. **Márgenes del chart**: `margin={{ top: 12, right: 16, left: 44, bottom: 28 }}` (o similar) para que ticks y labels queden visibles.
4. **Tooltip y labels**: Tooltip con `labelFormatter` que muestre la fecha ya formateada; revisar que los ticks del XAxis usen la misma función de formato.
5. **Responsivo**: `ResponsiveContainer` con `minHeight`; que el grid de charts se adapte sin overflow.

---

## 5. Verificación rápida

- [ ] Eje Y visible por completo (números no cortados).
- [ ] Eje X sin “Invalid Date”; etiquetas legibles (ej. “mar 2025”, “01/03”, “2024”).
- [ ] Tooltip con fecha correcta y valor formateado.
- [ ] Cards de valor y bloque con aspecto más premium (sombra, bordes, jerarquía).
- [ ] Tabs claros y accesibles.
- [ ] En móvil y desktop, sin cortes ni solapamientos.

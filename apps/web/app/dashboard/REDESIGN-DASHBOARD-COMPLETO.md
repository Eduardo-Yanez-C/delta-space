# Rediseño visual del dashboard completo

## 1. Diagnóstico — por qué el dashboard general aún se ve simple

- **Fondo y contenedor**: `bg-slate-50` plano en AppLayout; el main solo tiene `p-6`. No hay sensación de “capa” ni de contenedor con identidad.
- **Sidebar**: `bg-slate-900` con `border-r border-slate-200` (el borde claro choca con el fondo oscuro). Items con `rounded-lg`, activo `bg-amber-500/20 text-amber-400`; hover `bg-slate-800`. Falta profundidad (sombra sutil), el logo/marca es un cuadrado amber sin refinamiento, y el pie (“v1.0”) es muy básico.
- **Header**: `h-14`, `border-b border-slate-200`, `bg-white/95`. Título `text-lg`; todo muy plano. El botón “Cerrar sesión” es gris genérico.
- **Títulos del dashboard**: En page.tsx el hero es `<h2 className="text-lg font-semibold">` y las secciones usan `<h3 className="text-sm font-medium text-slate-700">`. Poca jerarquía; todo del mismo “peso” visual.
- **Cards de acceso rápido**: Clase `.card` (rounded-xl, border-slate-200, shadow-sm) es mínima. Las CTAs principales repiten `border-amber-300 bg-amber-50/50`; el resto solo cambia a hover. Iconos en cajas amber-100/200; sin elevación ni hover más premium (scale, sombra, borde más definido).
- **Secciones (KPIs, tablas, gráficos)**: Misma `.card`; títulos dentro de las cards en `text-sm font-medium`. No hay wrapper de sección con fondo o borde que agrupe visualmente; el bloque de indicadores externos ya está más trabajado y “desentona” con el resto.
- **Colores**: Amber solo en sidebar activo y en links/CTAs. El resto es slate neutro sin acentos; no hay paleta ejecutiva clara.
- **Profundidad**: Casi no hay sombras (solo shadow-sm en .card). No hay sensación de capas ni de “superficies” distintas.

---

## 2. Propuesta visual concreta

### AppLayout / contenedor principal
- Fondo del main: mantener `bg-slate-50` pero con un tono ligeramente más cálido o neutro si se prefiere (ej. `bg-slate-50` o `bg-slate-100/50`).
- Main: `p-6` o `p-8`; opcional `max-w-7xl mx-auto` para centrar en pantallas grandes y dar margen.

### Sidebar
- Fondo: `bg-slate-900` (mantener) con borde derecho más coherente: `border-r border-slate-800` (o sin borde y usar sombra: `shadow-xl`).
- Logo/marca: contenedor con `rounded-xl`, algo de padding; icono + texto con `font-semibold tracking-tight`; opcional `text-slate-100` para el nombre.
- Nav items: más padding (`px-3 py-2.5` → `px-3 py-3`), `rounded-xl`; estado activo: `bg-slate-800 text-white` con `border-l-2 border-amber-500` o un acento sutil; hover: `bg-slate-800/80 text-slate-200`.
- Pie del sidebar: `border-t border-slate-800`, texto `text-slate-500` más pequeño; opcional “Cotización FV” en una línea.

### Header
- Altura: mantener `h-14` o subir a `h-16` con `py-4`.
- Fondo: `bg-white` con `border-b border-slate-200/80` y `shadow-sm` para separar del contenido.
- Título: `text-xl font-semibold text-slate-900` (o `text-lg` si se prefiere no competir con el contenido).
- Subtítulo: `text-sm text-slate-500`.
- Botón “Cerrar sesión”: `rounded-lg`, estilo secundario pero refinado (borde slate, hover bg-slate-50); o texto + icono para que se sienta más “app”.

### Dashboard (page.tsx): jerarquía y secciones
- Hero: contenedor con margen inferior claro. Título: `text-2xl font-bold text-slate-900` (o `text-xl`). Subtítulo: `text-sm text-slate-600` con algo de `tracking-wide` si encaja.
- Secciones: cada bloque (Indicadores, Tendencias, Seguimiento rápido, Acceso rápido) envuelto en un contenedor con título de sección consistente:
  - Título de sección: `text-sm font-semibold uppercase tracking-wider text-slate-500` (o `text-base font-semibold text-slate-800`) para jerarquía clara.
  - Opcional: línea o espacio que separe visualmente (border-t o mt con pt).
- Error/loading: mantener mensajes pero con estilos de “card” alineados (rounded-xl, sombra, padding).

### Cards de acceso rápido
- Base: `rounded-xl border border-slate-200 bg-white shadow-sm` y **hover: `shadow-md border-slate-300`** (y opcional `transition-all duration-200`).
- CTAs principales (Nueva cotización, Desde plantilla, Nuevo estudio): mantener acento amber pero más refinado: `border-l-4 border-l-amber-500` (o borde izquierdo sutil), `bg-amber-50/30` o `bg-white` con hover `bg-amber-50/50`; icono en contenedor `rounded-xl bg-amber-100` (no cuadrado duro).
- Cards secundarias (Clientes, Productos, etc.): borde gris, hover con `bg-slate-50` y `shadow-md`; iconos en `rounded-xl bg-slate-100 text-slate-600`.
- Tipografía: títulos `font-semibold text-slate-900`; descripción `text-sm text-slate-600`.
- Focus: mantener `focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2` para accesibilidad.

### KPIs y tablas/gráficos
- KPIs: cards con la misma base premium (rounded-xl, shadow-sm, borde sutil); opcional `border-l-4 border-l-slate-300` o un color muy sutil por tipo de KPI para dar identidad sin recargar.
- Tablas: cabecera de card con `bg-slate-50/80` y título `font-semibold`; bordes internos suaves.
- Gráficos: cards igual que el resto; títulos de chart `text-sm font-semibold text-slate-800`.

### Integración con el bloque de indicadores
- El bloque de indicadores ya usa `rounded-xl border border-slate-200/80 bg-white shadow-sm`. Ajustar si hace falta el `border` o `shadow` para que sea el mismo token que el resto de cards del dashboard (misma `.card` o mismas clases) para cohesión.

### Colores y tokens
- Definir mentalmente (o en globals): “surface” = white + shadow-sm + border-slate-200; “surface-hover” = shadow-md, border-slate-300; “accent” = amber-500 para CTAs y activo sidebar; “muted” = slate-500 para subtítulos y labels.
- Evitar más de un par de acentos (amber + quizá un azul/slate para links secundarios) para no recargar.

### Resumen de dirección
- Look refinado: más sombras suaves, bordes coherentes, más espacio donde haga falta.
- Jerarquía: título de página grande y claro; títulos de sección consistentes y legibles.
- Cards con profundidad: shadow-sm por defecto, shadow-md en hover en acceso rápido.
- Sidebar y header más “producto”: estados activo/hover claros, logo y pie más cuidados.
- Mantener corporativo/serio: sin ilustraciones ni colores chillones.

---

## 3. Archivos a tocar

| Archivo | Cambios |
|--------|---------|
| `web/components/layout/Sidebar.tsx` | Fondo, borde, logo, ítems nav (padding, activo con borde o bg, hover), pie. |
| `web/components/layout/Header.tsx` | Altura opcional, sombra, título/subtítulo más grandes o refinados, botón cerrar sesión. |
| `web/components/layout/AppLayout.tsx` | Fondo del main, padding, opcional max-width del contenido. |
| `web/app/page.tsx` | Hero (título y subtítulo), contenedores de sección, títulos de sección, cards de acceso rápido (clases, hover, iconos), mensajes error/loading. |
| `web/app/dashboard/DashboardKpis.tsx` | Ajustar clases de las cards KPI para alinearlas al nuevo look (card, sombra, opcional borde izquierdo). |
| `web/app/dashboard/DashboardTablas.tsx` | Ajustar card de sección y cabecera de tabla para consistencia. |
| `web/app/dashboard/DashboardGraficos.tsx` | Ajustar cards de gráficos (misma base visual). |
| `web/app/globals.css` | Opcional: refinar `.card` (sombra, borde) o añadir una clase `.card-hover` para acceso rápido. |

No tocar: lógica de datos, rutas, permisos, ni el contenido del bloque de indicadores externos (solo asegurar que comparta el mismo lenguaje visual).

---

## 4. Orden sugerido de implementación

1. **globals.css**: Refinar `.card` y opcional `.card-hover`.
2. **Sidebar.tsx**: Estilo completo (fondo, borde/sombra, logo, nav, pie).
3. **Header.tsx**: Ajustes de altura, sombra, tipografía y botón.
4. **AppLayout.tsx**: Fondo y padding (y max-width si se usa).
5. **page.tsx**: Hero, secciones, cards de acceso rápido y mensajes.
6. **DashboardKpis, DashboardTablas, DashboardGraficos**: Ajustes de cards y títulos para cohesión.

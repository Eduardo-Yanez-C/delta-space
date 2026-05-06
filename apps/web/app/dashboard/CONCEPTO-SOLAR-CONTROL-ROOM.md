# Concepto visual: Solar Intelligence / Premium Energy Control Room

## 1. Concepto visual concreto

**Idea central:** El dashboard no es un “backoffice de cotizaciones”, sino un **centro de control de energía solar**: un panel ejecutivo donde se monitorea negocio, indicadores y acciones clave. La interfaz debe sentirse como el puente de mando de un software de alto nivel para gestión solar: oscuro donde ancla la navegación, contenido en capas con contraste claro, y acentos que evocan **energía, precisión y control** sin ser ruidosos.

**Metáfora:** Sala de control con:
- **Zona de anclaje (sidebar):** fondo muy oscuro, casi negro-azulado, con un único acento “encendido” (dorado/ámbar suave o cyan/ámbar) que marca “sistema activo”.
- **Zona de trabajo (main):** fondo que no es blanco puro sino un gris muy frío o un degradado sutil (slate-100 → blanco o azul muy tenue), para que las **cards floten** con más profundidad.
- **Puntos focales:** hero, KPIs y cards de acceso con **borde o barra de acento + sombra suave**, y en elementos clave (logo, CTAs principales) un **glow muy contenido** (box-shadow con color del acento, baja opacidad).
- **Jerarquía:** el hero es el “título del panel”; las secciones tienen títulos en mayúsculas, pequeños y con color secundario; las cards principales (acceso rápido, KPIs) tienen más peso visual que las tablas secundarias.

**No hacer:** Gráficos tipo “neón”, fondos con ruido, muchos colores. Mantener **máximo 2 colores de acento** (ej. dorado/ámbar + cyan o azul eléctrico muy suave) y el resto escala de grises/neutros.

---

## 2. Emoción que debe transmitir

| Sensación | Cómo lograrla |
|-----------|----------------|
| **Control** | Sidebar oscuro estable, contenido ordenado en secciones claras, números grandes y legibles en KPIs. |
| **Energía / electricidad inteligente** | Acento dorado o ámbar suave (sol) + opcionalmente un toque cyan/azul (electricidad) en iconos o estados hover; glow muy sutil en logo o botón principal. |
| **Premium / alto nivel** | Espaciado generoso, tipografía clara, bordes redondeados consistentes, sombras suaves (no duras), gradientes solo sutiles. |
| **Seriedad ejecutiva** | Sin ilustraciones infantiles; iconografía simple y reconocible; paleta contenida. |
| **Memorable** | La combinación **fondo oscuro sidebar + acento cálido (dorado) + cards con profundidad** debe ser reconocible de un vistazo. |

**En una frase:** “Entro al panel y sé que esto es el centro de control de un negocio solar serio.”

---

## 3. Paleta propuesta

### Base y fondos
- **Sidebar:** `#0a0e17` (casi negro con tinte azul) o `slate-950` con overlay sutil azul vía `background-image` lineal. Borde derecho `slate-800/80`.
- **Fondo main (body):** No `#fff`. Usar un gradiente muy sutil vertical: `from-slate-100 to-white` o `from-[#f1f5f9] to-white`, para dar profundidad sin distraer.
- **Cards:** Fondo `white` con `border border-slate-200/90`, `shadow-sm` y en cards “primarias” (acceso rápido principales, hero) una `shadow` un poco mayor + borde izquierdo o superior en color acento.

### Acento principal (energía / sol)
- **Primario:** Dorado/ámbar suave ya en theme: `primary-500` (#f5d037) para botones, logo, ítem activo sidebar, borde de cards principales.
- **Glow (muy controlado):** En logo del sidebar y en el botón “Nueva cotización” (o primer CTA):  
  `box-shadow: 0 0 20px -2px rgba(245, 208, 55, 0.35)` (primary-500 con baja opacidad).  
  Una sola vez por vista, no en todas las cards.

### Acento secundario (opcional, electricidad)
- **Cyan/azul eléctrico suave:** Solo para hover en iconos o para un detalle pequeño (ej. “live” en indicadores). Ej: `#0ea5e9` (sky-500) al 60% en hover. Si se prefiere mantener una sola voz cromática, se puede omitir y quedarse solo con primary.

### Neutros y texto
- **Títulos principales:** `text-slate-900` (hero, títulos de card).
- **Secundario:** `text-slate-600`.
- **Terciario / labels:** `text-slate-500`, `uppercase tracking-wider` en títulos de sección.
- **En sidebar:** texto ítems `text-slate-400`, activo `text-white`; footer `text-slate-500`.

### Contraste
- Cards sobre fondo con gradiente: ya hay más separación visual que “blanco sobre blanco”.
- Bordes de cards: `slate-200/90`; en hover (card-hover): `border-slate-300`, `shadow-md`, opcional `bg-slate-50/50`.
- Cards principales (las 3 de acceso rápido “Nueva cotización”, “Desde plantilla”, “Nuevo estudio FV”): borde izquierdo `border-l-4 border-l-primary-500`, fondo ligeramente tintado opcional `bg-gradient-to-br from-white to-primary-50/30` y sombra `shadow-md`.

---

## 4. Componentes a cambiar (lista concreta)

| Componente | Cambio |
|------------|--------|
| **Body / AppLayout** | Fondo con gradiente sutil `bg-gradient-to-b from-slate-100 to-white` (o similar). |
| **Sidebar** | Fondo `bg-[#0a0e17]` o `slate-950`; borde `border-slate-800/80`; logo con `shadow` glow primary (baja opacidad); ítem activo `border-l-primary-500` + `bg-slate-800/80`; hover idem. |
| **Header** | Mantener limpio; opcional barra inferior más suave o mismo borde. Sin glow. |
| **Hero (page.tsx)** | Bloque tipo “panel title”: fondo con gradiente muy sutil `from-slate-50 to-white` o card ligera; título más grande o con letter-spacing; subtítulo `text-slate-600`; opcional línea o barra lateral en `primary-500` (1–2px). |
| **Cards de acceso rápido** | Primarias (Nueva cotización, Desde plantilla, Nuevo estudio FV): `border-l-4 border-l-primary-500`, `shadow-md`, opcional `bg-gradient-to-br from-white to-primary-50/20`; icono en contenedor con `bg-primary-100` y ligero glow en hover. Secundarias: card estándar con `card-hover`, sin gradiente. |
| **KPI cards (DashboardKpis)** | De “card plana” a “card con profundidad”: `shadow-md`, borde `slate-200/90`; opcional en la primera KPI o en todas una barra superior fina `border-t-2 border-t-primary-500/80` para dar jerarquía. |
| **Indicadores externos (bloque)** | Contenedor con `shadow-md` y borde; cards internas (Dólar, UF, IPC) mantener emerald/slate/violet para semántica; asegurar que el bloque no sea blanco plano (sombra + posible fondo `slate-50/30` interno). |
| **DashboardTablas** | Headers de sección con fondo `slate-50/80`; links mantienen `text-primary-700`; botones primary con glow muy sutil opcional. |
| **.globals.css** | `.card`: sombra por defecto `shadow-md` en lugar de `shadow-sm` para más profundidad; `.card-hover`: hover con `shadow-lg` y `border-primary-200/50` o solo `border-slate-300`. Añadir clase `.glow-accent` para el box-shadow del logo/CTA si se usa en varios sitios. |

---

## 5. Mock textual / dirección clara

### Hero
- **Ahora:** “Dashboard ejecutivo” + subtítulo en una sola línea.
- **Objetivo:** “Dashboard ejecutivo” como título principal (igual o un poco más grande), con una barra vertical de 3–4px en `primary-500` a la izquierda del título (o debajo del título como línea inferior). Subtítulo con un poco más de espacio. El bloque hero puede ser una “mini card” con fondo `white` o `slate-50/50`, padding generoso, y `shadow-sm` para que se sienta como el “encabezado del panel”.

### Sidebar
- Fondo oscuro sólido `#0a0e17` (o slate-950).
- Logo: icono en contenedor `bg-primary-500` con `box-shadow: 0 0 18px -2px rgba(245,208,55,0.4)`.
- Nav: ítem activo con `border-l-2 border-l-primary-500` y `bg-slate-800/90`; hover `bg-slate-800/70`; texto inactivo `text-slate-400`.

### Cards de acceso rápido
- **Primarias (3):** Fondo con gradiente muy sutil `from-white to-primary-50/20`, `border-l-4 border-l-primary-500`, `shadow-md`, hover `shadow-lg` y `border-slate-300`. Icono en `rounded-xl bg-primary-100`, icon color `text-primary-700`. Sin glow en cada card para no recargar.
- **Secundarias:** Card blanca estándar, `shadow-md`, hover `shadow-lg`, icono en `bg-slate-100`, `text-slate-600`.

### KPIs
- Cada KPI: card con `shadow-md`, `border border-slate-200/90`. Opcional: primera card (o todas) con `border-t-2 border-t-primary-500/70` para un toque de “energía” sin repetir el mismo estilo que las cards de acceso.

### Fondos
- **AppLayout (main area):** `bg-gradient-to-b from-slate-100 to-white` (o `min-h-screen` con ese gradiente).
- **Secciones:** Sin fondo extra; el contraste lo dan las cards con sombra sobre el gradiente.

### Glow
- **Único uso explícito:** logo del sidebar. Opcional: botón “Nueva cotización” en el hero si en el futuro se pone un CTA ahí. No aplicar glow a todas las cards ni a todos los botones.

### Resumen de implementación (orden sugerido)
1. **globals.css:** gradiente body (o en AppLayout), `.card` con `shadow-md`, `.card-hover` con `shadow-lg` en hover, opcional `.glow-accent`.
2. **AppLayout:** fondo con gradiente.
3. **Sidebar:** color de fondo, glow en logo, estados activo/hover ya con primary.
4. **page.tsx:** hero con barra de acento y/o mini card; cards de acceso rápido con gradiente sutil y sombra en las 3 primarias.
5. **DashboardKpis:** sombra y opcional barra superior primary en las cards.
6. **DashboardIndicadoresExternos / DashboardTablas:** ajustes de sombra y borde para cohesión; sin cambiar semántica de colores (emerald, violet, etc.) en indicadores.
7. **Header:** solo si hace falta un detalle mínimo (borde más suave).

---

## 6. Checklist pre-implementación

- [ ] Aprobación del concepto “Solar intelligence / control room”.
- [ ] Aprobación de paleta: base oscura sidebar, gradiente sutil main, acento primary (dorado), glow solo en logo (y opcional 1 CTA).
- [ ] Aprobación de componentes listados (hero, cards, KPIs, sidebar, fondos).
- [ ] Decisión: ¿añadir acento secundario cyan en hovers o mantener solo primary?

Con esto se puede pasar a implementación sin cambiar estructura ni lógica, solo estilos y clases Tailwind (y un posible gradiente en body/AppLayout).

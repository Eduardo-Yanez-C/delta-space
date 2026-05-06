# Diseño técnico: modo oscuro (dark mode)

## 1. Enfoque general

- **Tailwind:** Estrategia `darkMode: 'class'`. Cuando el elemento raíz (`<html>`) tiene la clase `dark`, todas las variantes `dark:*` se aplican.
- **Estado:** Valor `"light"` | `"dark"` guardado en `localStorage` bajo la clave `theme`.
- **Sincronización:** Un script inline que se ejecuta **antes** del primer pintado lee `localStorage` y añade o quita la clase `dark` en `document.documentElement`. Así se evita el parpadeo (flash) al cargar.
- **React:** Un `ThemeProvider` (client) expone el tema actual y una función `setTheme` / `toggleTheme`. Al cambiar el tema: actualizar `localStorage`, añadir o quitar la clase en `document.documentElement` y actualizar el estado para re-renderizar el botón (icono activo).

---

## 2. Dónde guardar el estado

| Dónde | Uso |
|-------|-----|
| **localStorage** (`theme`: `"light"` \| `"dark"`) | Persistencia entre recargas y sesiones. |
| **DOM** | Clase `dark` en `document.documentElement` para que Tailwind aplique las reglas. |
| **React** | Contexto `ThemeContext` con `theme` y `setTheme` para el botón del header y cualquier componente que necesite leer el tema. |

El script anti-flash solo lee `localStorage` y escribe en el DOM; no usa React. El provider, al montar, lee el estado actual del DOM (o de `localStorage`) para inicializar el contexto sin desincronía.

---

## 3. Evitar flash al cargar

**Problema:** Si el tema se aplica solo después de que React hidrate, la primera pintada será en modo claro y luego saltará a oscuro (o al revés).

**Solución:** Un **script inline** en el primer contenido del `<body>` (antes de cualquier otro contenido) que:

1. Lee `localStorage.getItem('theme')`.
2. Si es `'dark'`, hace `document.documentElement.classList.add('dark')`.
3. Si no, hace `document.documentElement.classList.remove('dark')`.

Ese script se incluye en el HTML enviado por el servidor (p. ej. en el layout raíz con `dangerouslySetInnerHTML`) y se ejecuta durante el parsing del documento, antes de que se pinte el cuerpo y antes de que cargue React. Así la primera pintada ya tiene la clase correcta en `<html>`.

No usar `useEffect` ni cargar el tema desde un chunk de JS: llegaría tarde y produciría flash.

---

## 4. Componentes y archivos a tocar

### 4.1 Infraestructura

- **tailwind.config.js**  
  Añadir `darkMode: 'class'`.

- **app/layout.tsx**  
  - Inyectar el script anti-flash al inicio del `<body>`.  
  - Envolver la app (o al menos la parte que contiene el Header) con `ThemeProvider`.

- **app/globals.css**  
  Añadir variantes `dark:` para:
  - `body`: fondo y texto.
  - `.btn-primary`, `.btn-secondary`, `.input-field`, `.card`, `.card-hover` (y opcionalmente `.glow-accent` si se desea suavizar en oscuro).

### 4.2 Contexto y botón

- **lib/theme-context.tsx** (nuevo)  
  - `ThemeProvider`: al montar, lee `document.documentElement.classList.contains('dark')` (o `localStorage`) y establece `theme` en el estado.  
  - `setTheme('light' | 'dark')`: escribe en `localStorage`, añade/quita `dark` en `document.documentElement`, actualiza el estado.  
  - Exportar `useTheme(): { theme, setTheme, toggleTheme }`.

- **components/layout/Header.tsx**  
  Añadir botón/toggle (icono sol/luna) que llame a `toggleTheme` y muestre el icono según el tema actual.

### 4.3 Layout y navegación

- **components/layout/AppLayout.tsx**  
  Fondo del área principal y, si aplica, del contenedor: variantes `dark:` (p. ej. gradiente o color sólido oscuro).

- **components/layout/Sidebar.tsx**  
  En modo oscuro el sidebar ya es oscuro; ajustar bordes y textos con `dark:` para que sigan legibles y coherentes (p. ej. bordes más suaves, texto secundario `dark:text-slate-400`).

### 4.4 Dashboard

- **app/page.tsx**  
  Hero, bloques de error y cards: fondos, bordes y textos con `dark:`.

- **app/dashboard/DashboardKpis.tsx**  
  Cards KPI: fondo, borde, barra de acento y texto en oscuro.

- **app/dashboard/DashboardTablas.tsx**  
  Secciones, tablas, cabeceras, filas, enlaces y badges: variantes `dark:`.

- **app/dashboard/DashboardIndicadoresExternos.tsx**  
  Contenedor, cards de indicadores y tabs: fondos, bordes y texto en oscuro.

- **app/dashboard/DashboardGraficos.tsx**  
  Cards de gráficos y ejes/etiquetas si se usan colores de texto/fondo: variantes `dark:`.

### 4.5 Componentes compartidos

- **components/ui/Modal.tsx**  
  Overlay y panel: fondo y borde en oscuro; título y botón cerrar con `dark:`.

### 4.6 Resto de la app (por módulo)

Añadir variantes `dark:` de forma sistemática en:

- Listados (tablas, cards): Productos, Proveedores, Clientes, Usuarios, Cotizaciones, Estudios FV, Plantillas.
- Formularios: inputs, labels, mensajes de error/éxito, bordes.
- Detalles y vistas previas: fondos, textos, bordes.
- Modales específicos (cotización, estudio FV, plantillas, etc.): mismos criterios que `Modal.tsx`.
- Páginas de login y acceso restringido.

Se puede ir componente a componente: en cada uno, para cada clase que defina fondo, borde o color de texto, añadir la correspondiente `dark:...`.

---

## 5. Criterios de estilo en modo oscuro

- **Fondos:** Sustituir blancos por `dark:bg-slate-800` o `dark:bg-slate-900`; fondos de página por `dark:bg-slate-900` o gradiente oscuro.
- **Texto:** Primario `dark:text-slate-100`; secundario `dark:text-slate-300` o `dark:text-slate-400`.
- **Bordes:** `dark:border-slate-600` o `dark:border-slate-700` en lugar de slate-200.
- **Acento (primary):** Mantener primary-500 para botones y acentos; en fondos suaves usar `dark:bg-primary-500/10` o similar para no saturar.
- **Cards/Tablas:** Fondo `dark:bg-slate-800`, borde `dark:border-slate-700`, texto como arriba.
- **Inputs:** Fondo `dark:bg-slate-800`, borde `dark:border-slate-600`, placeholder y texto con variantes `dark:`.
- **Estados vacíos y alertas:** Misma lógica: fondo y borde con variantes oscuras; mensajes de error/éxito con contraste suficiente.

---

## 6. Orden de implementación sugerido

1. **Config y script:** `darkMode: 'class'`, script en layout, `ThemeProvider` y `useTheme`.
2. **Header:** Botón de alternar tema.
3. **globals.css:** Body y clases globales (botones, input, card).
4. **AppLayout y Sidebar:** Área principal y navegación.
5. **Dashboard:** page, KPIs, Tablas, Indicadores, Gráficos.
6. **Modal (UI):** Overlay y panel.
7. **Resto:** Formularios, listados, modales específicos y páginas sueltas (login, acceso restringido) en pasadas sucesivas.

Con esto se tiene una base correcta para tema claro/oscuro sin parches y sin flash al cargar.

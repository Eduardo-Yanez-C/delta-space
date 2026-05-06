# Propuesta de paleta premium — Dashboard

## 1. Paleta concreta

| Uso | Actual | Propuesto | Notas |
|-----|--------|-----------|--------|
| **Sidebar fondo** | `bg-slate-900` | `bg-slate-950` | Ya existe en theme: `#0c1222` — azul petróleo / slate profundo. |
| **Sidebar borde** | `border-slate-800` | `border-slate-800` | Mantener; cohesión con el fondo. |
| **Sidebar logo** | `bg-amber-500` | `bg-primary-500` | Dorado suave del theme (`#f5d037`). |
| **Sidebar ítem activo** | `border-amber-500` | `border-primary-500` | Mismo acento. |
| **Sidebar ítem inactivo** | `text-slate-300` | `text-slate-400` | Legible pero no duro. |
| **Sidebar hover** | `hover:bg-slate-800/90` | Igual | Sin cambio. |
| **Acento global (CTAs, links, focus)** | `amber-500/600/700` | `primary-500/600` | Dorado suave ya definido en `tailwind.config.js`. |
| **Cards de acceso (borde e iconos)** | `border-l-amber-500`, `bg-amber-100`, `text-amber-700` | `border-l-primary-500`, `bg-primary-100`, `text-primary-700` | Mismo tono premium. |
| **Botón principal** | `bg-amber-500` | `bg-primary-500` | `.btn-primary` en globals. |
| **Focus (inputs, links, anillos)** | `amber-500` | `primary-500` | Consistencia. |
| **Fondo de página** | `bg-slate-50` | `bg-slate-50` | Sin cambio; ya suave. |
| **Superficies (cards)** | `bg-white` | `bg-white` | Sin cambio. |
| **Textos secundarios** | `text-slate-500/600` | `text-slate-500/600` | Sin cambio. |
| **Alertas / avisos** | `amber-50`, `amber-200`, `amber-800` | `primary-50`, `primary-200`, `primary-800` | Tono coherente con el acento. |

El theme ya define `primary` (50–900) con tonos dorados/ámbar suaves; se usa como único acento en lugar de `amber`.

---

## 2. Sensación que transmite

- **Base oscura (slate-950)**: Seriedad, tecnología, “azul petróleo” asociado a ingeniería y energía.
- **Acento dorado (primary)**: Premium, solar/energía sin ser naranja chillón; confianza y valor.
- **Blancos y slate suaves**: Limpieza y claridad; contraste legible sin dureza.
- **Resultado**: Dashboard ejecutivo, moderno y refinado; evita la sensación “negro + naranja + blanco” genérica.

---

## 3. Archivos a tocar

| Archivo | Cambios |
|--------|---------|
| `web/app/globals.css` | `.btn-primary`, `.input-field` focus: `amber` → `primary`. |
| `web/components/layout/Sidebar.tsx` | `bg-slate-900` → `bg-slate-950`; logo y activo: `amber` → `primary`. |
| `web/components/layout/Header.tsx` | Solo si hubiera amber (revisar); botón secundario puede quedar igual. |
| `web/app/page.tsx` | Cards de acceso: `amber` → `primary` (borde, iconos, focus-visible). Alert/error si usa amber. |
| `web/app/dashboard/DashboardTablas.tsx` | Links y botones amber → primary; badges amber → primary. |
| `web/app/dashboard/DashboardIndicadoresExternos.tsx` | Sin cambio de paleta (usa emerald/slate/violet por indicador). |
| Resto de la app (productos, cotizaciones, etc.) | Opcional en esta fase: reemplazar `amber` por `primary` en links y focus para cohesión global. |

En esta entrega se priorizan: **globals, Sidebar, page.tsx (dashboard), DashboardTablas**. El resto de rutas se pueden ir migrando a `primary` en una segunda pasada si se desea.

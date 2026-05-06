# RFC — Módulo Conversaciones (V1)

**Estado:** aprobado para implementación por fases.  
**Audiencia:** backend, frontend, producto.  
**Alcance:** comunicación interna entre usuarios registrados; **sin** Slack completo, **sin** WebSockets en V1, **sin** tareas/pendientes hasta V2.

---

## 1. Entidades (modelo ER)

```
User (existente)
  ↑
  │ 1:N
ConversationMember ─────┐
  │                     │
  │ N:1                 │ N:1
  └──────────► Conversation ◄────┘
                     │
                     │ 1:N
                     ▼
                  Message
```

| Entidad | Campos principales | Notas |
|---------|-------------------|--------|
| **Conversation** | `id`, `type` (`DIRECT` \| `GROUP`), `title` (nullable; en `DIRECT` puede ser null o derivado), `createdById` → User, `createdAt`, `updatedAt` (última actividad; actualizar al insertar mensaje) | `DIRECT`: exactamente **2** miembros activos; regla de unicidad: un par de usuarios → **una** conversación reutilizable (índice único lógico o resolución en servicio). |
| **ConversationMember** | `id`, `conversationId`, `userId`, `joinedAt`, `leftAt` (nullable), `lastReadMessageId` (nullable FK → Message) **o** `lastReadAt` (timestamp) | Solo **miembros** con `leftAt` null ven la conversación. Preferencia: **`lastReadMessageId`** para cursor de lectura inequívoco; alternativa: `lastReadAt` + consistencia con timestamps de mensajes. |
| **Message** | `id`, `conversationId`, `authorId` → User, `body` (texto), `createdAt`, `editedAt` (nullable) | Sin adjuntos en V1. V1-C: columnas opcionales `metadata` JSON (menciones y `quoteIds`) o tablas hijas — ver §6. |

**Índices recomendados:** `(conversationId, createdAt)` en Message; `(userId, conversationId)` único en miembros activos donde aplique.

---

## 2. Endpoints REST mínimos

Prefijo API: `/api` (Nest global). Prefijo recurso sugerido: `/api/conversations`.

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/conversations` | Lista conversaciones del usuario actual (miembro activo). Incluye resumen: último mensaje, `unreadCount` o flag, `updatedAt`. Query opcional: `cursor`, `limit`. |
| `POST` | `/conversations` | Crear: body `{ type, title?, memberUserIds[] }`. `DIRECT`: exactamente otro `userId` en miembros (además del autor). |
| `GET` | `/conversations/:id` | Detalle + miembros (solo si el usuario es miembro). |
| `GET` | `/conversations/:id/messages` | Mensajes paginados **hacia atrás** (más recientes primero o cursor `before`/`after` según convención elegida). |
| `POST` | `/conversations/:id/messages` | Enviar mensaje: `{ body }`. V1-C: `{ body, metadata? }` con menciones/refs validadas. |
| `POST` | `/conversations/:id/read` | Marcar leído hasta un mensaje (body: `{ lastReadMessageId }` o `{ readAt }`). Actualiza miembro. |

**Autenticación:** JWT en todas las rutas. **Autorización:** comprobar membresía activa en cada operación sobre `:id`.

**V1-C (extensiones):**

- Antes de persistir referencias a cotización: validar **misma regla que el resto del API** para leer esa cotización (p. ej. mismo criterio que `GET /quotes/:id`).
- Listado de usuarios para `@`: reutilizar endpoint existente de usuarios si hay uno acotado, o `GET /conversations/mention-users?q=` mínimo.

---

## 3. Rutas web mínimas (Next.js)

| Ruta | Uso |
|------|-----|
| `/conversaciones` | **Pantalla principal** del módulo: lista de conversaciones + panel de hilo (layout tipo inbox). |
| `/conversaciones/[id]` | *(Opcional si se prefiere URL profunda; si no, estado en query o solo `/conversaciones` con selección.)* Deep link a conversación concreta. |

**Sidebar:** entrada fija **“Conversaciones”** → `/conversaciones`.

**V1-B:** la burbuja **no** añade rutas nuevas obligatorias; es un **dock** global que reutiliza los mismos datos/endpoints.

---

## 4. Alcance exacto — V1-A

- Modelo de datos y migración Prisma (o equivalente) para **Conversation**, **ConversationMember**, **Message**.
- **Conversación directa** entre dos usuarios (regla de unicidad del par).
- **Grupo** (`type: GROUP`) con título y miembros iniciales; solo creador o política mínima acordada para añadir miembros (documentar en servicio).
- **Mensajes de texto** únicamente (sin archivos).
- **No leídos:** por miembro (`lastReadMessageId` / `lastReadAt`); cálculo de conteo o flag en listado.
- **Polling** (sin WebSocket) según §7.
- **Ruta** `/conversaciones` con UI lista + hilo + composer.
- **Sidebar:** ítem “Conversaciones”.
- **No** burbuja flotante todavía.
- **No** menciones ni referencias a cotizaciones.

---

## 5. Alcance exacto — V1-B

- **Burbuja flotante** a la derecha, montada en el layout principal (p. ej. `AppLayout`), **sin** sustituir `/conversaciones`.
- Estados: **oculta**, **visible minimizada**, **visible expandida** (desplegable).
- **Movible** (drag) con posición persistida (p. ej. `localStorage`).
- **Acceso rápido:** lista compacta de **últimas N conversaciones** (mismos datos que `GET /conversations` con `limit`) + abrir una sin dejar la pantalla actual como “módulo completo” (panel lateral o overlay reducido).
- Misma autenticación y mismos endpoints que V1-A.
- **No** menciones ni cotizaciones (siguen fuera hasta V1-C).

---

## 6. Alcance exacto — V1-C

- **Menciones `@usuario`:** persistencia recomendada: `metadata` en Message o tabla `MessageMention` (`messageId`, `mentionedUserId`). Autocompletado desde usuarios permitidos.
- **Referencias a cotizaciones:** `quoteId` (o lista) en `metadata`; validación **obligatoria** de permiso de lectura de cotización antes de guardar.
- **Render:** enlace simple a `/cotizaciones/[id]` (o ruta real del proyecto) solo si el usuario puede ver esa cotización; si no, mensaje de error al enviar o ocultar enlace según política (recomendado: **rechazar envío** si no hay permiso).
- **No** tareas, **no** adjuntos, **no** reacciones, **no** hilos.

---

## 7. Estrategia polling + cursor

**Objetivo:** reducir carga y evitar full refreshes innecesarios.

**Listado de conversaciones (`GET /conversations`):**

- Query: `sinceUpdatedAt` (ISO) **o** `afterConversationCursor` (id + timestamp codificado).
- Respuesta: solo conversaciones con `updatedAt > since` o primera carga completa paginada.
- Cliente: intervalo **15–30 s** cuando la pestaña está visible; **pausar** o alargar intervalo en pestaña oculta (`document.visibilityState`).

**Mensajes en hilo (`GET /conversations/:id/messages`):**

- Paginación: `limit` + `beforeMessageId` (mensajes más antiguos al hacer scroll) **o** `afterMessageId` (nuevos desde último fetch).
- Tras enviar `POST .../messages`, actualizar UI optimista + refetch corto opcional.

**Marcar leído:**

- `POST .../read` al abrir conversación o al enfocar el panel; evita no leídos falsos.

**Sin WebSocket** en V1; el diseño de cursores permite migrar después a push sin romper el contrato de listados.

---

## 8. Riesgos y validación

### Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Alcance tipo Slack | Ceñirse a tablas y endpoints de este RFC; V2 explícito para pendientes. |
| Burbuja tapa UI crítica | `z-index` acorde; minimizar por defecto; `no-print`; no expandir en impresión. |
| Fugas entre conversaciones | Comprobar membresía en **cada** handler por `conversationId`. |
| Referencias a cotizaciones sin permiso | Validar en servidor contra reglas de Quote existentes; no confiar en el cliente. |
| DM duplicados | Unicidad (par userA/userB) en servicio + índice/constraint si es posible. |
| Rendimiento con muchos mensajes | Paginación estricta en `messages`; no cargar historial completo. |

### Criterios de validación

- Solo miembros activos listan y abren una conversación; otro usuario recibe 403 en `GET`/`POST` por id.
- V1-A: DM + grupo + mensajes + no leídos + `/conversaciones` + polling funcional.
- V1-B: Burbuja no reemplaza la página principal; mismos datos; estados oculto/minimizado/expandido + movimiento persistido.
- V1-C: Menciones y `quoteId` con enlace; envío bloqueado o coherente si no hay permiso sobre la cotización.
- No hay adjuntos, WebSocket, reacciones, hilos ni tareas en el código entregado de V1.

---

## Referencias internas

- Layout y sidebar: `apps/web/components/layout/Sidebar.tsx`, `AppLayout.tsx`.
- Permisos cotización: alinear con guards/servicio de quotes existente.

---

*RFC conversaciones V1 — recorte explícito; V2 pendientes/actividades fuera de alcance.*

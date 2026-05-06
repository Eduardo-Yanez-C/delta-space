# Frontend web interno

## Acceso por navegador en la red

Los usuarios abren un navegador en su PC de oficina y visitan una URL **solo alcanzable dentro de la red de la empresa**, por ejemplo:

- `https://cotizaciones.empresa.local`
- o `http://192.168.1.50:3000` (menos deseable en producción por falta de HTTPS y memorización).

El frontend es el **mismo** stack Next.js (o build estático exportado) que el proyecto ya usa; cambia **dónde** se sirve y **a qué URL de API** apunta el cliente.

---

## Dominio interno vs IP

| Opción | Ventaja | Nota |
|--------|---------|------|
| **DNS interno** | Certificados TLS coherentes, URLs estables | Requiere DNS empresarial o entrada en hosts |
| **Solo IP** | Rápido para prueba | Difícil renovar certificados; menos profesional |

Recomendación: **nombre interno + HTTPS** (certificado interno o CA empresa).

---

## Relación con el backend interno

- En build de producción, la variable pública (ej. `NEXT_PUBLIC_API_URL`) debe apuntar al **origen del API** tal como lo ve el navegador del usuario:
  - Mismo host: `https://cotizaciones.empresa.local/api` si el proxy enruta.
  - Host dedicado API: `https://api-cotizaciones.empresa.local` (CORS configurado en backend).

- **No** hardcodear `localhost` en builds que irán a usuarios finales en LAN.

---

## App desktop (Electron / portable) — rol futuro

Opciones estratégicas (decisión de producto pendiente):

1. **Deprecar** el cliente desktop para el modo empresa on-premise: todo es web.
2. **Wrapper** que solo abre una ventana con WebView apuntando a la URL interna (misma experiencia que el navegador).
3. **Coexistencia** temporal: desktop para offline/portable legacy; web para servidor central.

Esta documentación **no** impone la opción; el despliegue on-premise **prioriza web**.

---

## Qué no es

- No es “instalar Node en cada PC del usuario” para el flujo estándar on-premise.
- No es abrir el portable desde `\\servidor\compartido\...`.

---

## Referencias

- `backend-interno.md`, `seguridad-y-red.md`, `variables-entorno-ejemplo.md`.

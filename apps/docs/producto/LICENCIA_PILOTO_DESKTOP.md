# Licencia desktop — piloto (5 días, por equipo, UI y reloj)

## Campo que define la expiración (firma HMAC)

| Campo en el JSON firmado (`payload`) | Uso |
|----------------------------------------|-----|
| **`validUntil`** | Fecha/hora límite en **ISO 8601** (ej. `2026-03-26T02:59:59.999Z`). Es el único origen para saber si la licencia sigue vigente y para calcular **días restantes** (`wholeDaysRemaining`: días completos hasta ese instante, según reloj del sistema sujeto a las reglas del ancla). |
| **`installationId`** | UUID v4 (o compatible con regex del repo) del equipo. Debe coincidir con el ID generado por la app en `userData/installation/installation.json`. Si no coincide, la licencia **no se aplica** ni valida en ese PC. |

Otros campos firmados habituales: `licenseId`, `licenseType`, `issuedAt`, `issuedTo`, `note`, `v`, `kind: "renewal"`.

---

## Cómo generar una licencia de 5 días para un `installationId`

1. En el equipo piloto, abrir la app (pantalla de licencia si aplica) y copiar el **ID de instalación** mostrado, o leerlo vía logs / `installation/installation.json`.
2. En la máquina de emisión (mismo secreto HMAC que el build):

```powershell
cd apps\desktop
$env:LICENSE_HMAC_SECRET = "mismo-secreto-que-el-build"
node scripts/generate-license.js `
  --id LIC-PILOT-001 `
  --installation-id "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" `
  --calendar-days 5 `
  --type INTERNAL `
  --out licencia-piloto.json
```

- **`--calendar-days 5`:** la licencia vence el **fin del día civil** tras sumar 5 días al día de generación (hora local 23:59:59.999).
- Alternativa fija: `--until YYYY-MM-DD` (fin de ese día local).
- Sin `LICENSE_HMAC_SECRET` coherente, la app rechazará la firma.

3. Entregar `licencia-piloto.json` al usuario; en la app: **Seleccionar licencia** y reiniciar.

---

## Dónde se muestra el estado / “contador”

| Ubicación | Comportamiento |
|-----------|----------------|
| **Barra bajo el título de la app (layout principal)** | Componente `DesktopLicenseBanner` en `apps/web/components/layout/DesktopLicenseBanner.tsx`, **solo** si `__DESKTOP__.license.getUiStatus()` indica `embedded: true` y `level: "active"`. |
| Texto | **Activa:** `Licencia activa, vence en X días` (X desde `validUntil` firmado). |
| **Advertencia (≤3 días)** | Misma barra con estilo ámbar + chip *“Quedan 3 días o menos — renueve pronto”*. |
| **Expirada / inválida / reloj** | No se muestra esta barra: el **main** de Electron bloquea y muestra `license-blocked.html` con el mensaje correspondiente. |

Actualización de la barra: al montar el layout y **cada 60 s** (reconsulta al proceso principal).

---

## Protección básica contra manipulación del reloj

| Archivo | Rol |
|---------|-----|
| `apps/desktop/license/clock-anchor.js` | Persiste `license/clock-anchor-v1.json` con `lastSeenAtMs` firmado (HMAC). |
| Regla | Si `Date.now()` **retrocede** más de **2 minutos** respecto a `lastSeenAtMs` guardado → `clock_rewind_suspected` → licencia tratada como no válida (misma categoría que bloqueo). |
| Actualización | Tras cada validación **OK** (arranque y cada refresco de UI de licencia), se hace `touchAnchor` con `max(lastSeen, now)`. |

Esto no sustituye un servidor de tiempo ni NTP; solo mitiga cambios bruscos hacia atrás en el reloj local.

---

## Archivos / código tocados (referencia)

| Ruta | Cambio |
|------|--------|
| `apps/desktop/license/state.js` | `installationId` en apply + almacenamiento; `validateStoredState(ctx)` con chequeo de equipo; `wholeDaysRemaining`; `validateExternalLicenseFile(parsed, installationId)`. |
| `apps/desktop/license/clock-anchor.js` | **Nuevo** — ancla de tiempo firmada. |
| `apps/desktop/main.js` | Reloj + `installationId` en validación de arranque; IPC `license:getUiStatus`; apply con `installationId`; mensajes ampliados. |
| `apps/desktop/preload.js` | `license.getUiStatus` → IPC. |
| `apps/desktop/scripts/generate-license.js` | `--installation-id` obligatorio; `--calendar-days`; payload con `installationId`. |
| `apps/web/components/layout/DesktopLicenseBanner.tsx` | **Nuevo** — barra de estado. |
| `apps/web/components/layout/AppLayout.tsx` | Inserta `DesktopLicenseBanner` encima del `Header`. |
| `apps/docs/producto/LICENCIA_PILOTO_DESKTOP.md` | Este documento. |

**Nota:** licencias **antiguas** guardadas en runtime **sin** `installationId` en el payload siguen validando hasta que se emita una nueva licencia por equipo (recomendado para el piloto).

---

*Última actualización: piloto desktop 5 días + binding + UI + ancla de reloj.*

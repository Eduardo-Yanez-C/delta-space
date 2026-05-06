# Licencia (app de escritorio / portable)

## Resumen comercial

- Cada licencia de **renovación** es un **archivo** (`.json` o `.lic`) firmado por el administrador. El vendedor **no escribe** códigos a mano: **selecciona el archivo** en la pantalla de bloqueo.
- Cada archivo incluye un **`licenseId` visible** (ej. `LIC-TRIAL-0001`, `LIC-COMM-2026-0042`) para control interno, facturación y saber qué archivo se entregó a cada vendedor.
- **No hay prueba automática** en el primer arranque: sin archivo de licencia válido aplicado, la app muestra **Licencia requerida** y no entra al login.
- Las **pruebas comerciales** (p. ej. 5 días hábiles) se emiten como **archivo** con `generate-license.js` (recomendado `--type TRIAL_EXTENSION` y `--business-days 5`).

## Comportamiento técnico

- **Solo aplica** cuando la app está **empaquetada** (`app.isPackaged`). En `electron .` contra localhost **no** se aplica (desarrollo).
- **Primer arranque / sin estado**: si **no** existe `license/runtime-v1.json` (o está corrupto), **no** se crea trial; la app queda en pantalla de licencia hasta cargar un archivo firmado.
- **Estado válido**: tras aplicar licencia, `runtime-v1.json` guarda `mode: "renewal"` con `validUntil`. Mientras no venza, arranque normal (backend + Next + login).
- **Compatibilidad**: instalaciones que aún tengan `mode: "trial"` en disco siguen funcionando hasta que `trialEndsAt` venza; las nuevas no reciben trial automático.
- **Bloqueo**: sin licencia, licencia vencida o firma inválida → solo pantalla de licencia (no arranca API/Next embebidos para uso normal).
- **Archivos de licencia**: JSON firmado (HMAC-SHA256) con `scripts/generate-license.js` y el mismo `LICENSE_HMAC_SECRET` que la app.

## Formato del archivo de licencia (canónico)

El archivo es un JSON con dos claves de nivel superior:

```json
{
  "payload": { ... },
  "sig": "hex HMAC-SHA256 del payload"
}
```

### Payload mínimo (entrada / archivo emitido)

| Campo | Obligatorio | Descripción |
|--------|-------------|-------------|
| `v` | Sí | Versión del esquema (actualmente `1`). |
| `kind` | Sí | Debe ser `"renewal"` para archivos externos. |
| `licenseId` | Sí | Identificador visible y trazable, p. ej. `LIC-TRIAL-0003`. Patrón: `LIC-` + sufijo alfanumérico (ver código: `LICENSE_ID_PATTERN`). |
| `licenseType` | Sí* | `COMMERCIAL`, `TRIAL_EXTENSION`, `INTERNAL`, `PARTNER`. *Si falta, se asume `COMMERCIAL` al validar (recomendado emitirlo siempre). |
| `validUntil` | Sí | Fecha/hora ISO hasta la cual la licencia es válida. |
| `issuedAt` | Recomendado | Momento de emisión (ISO). |
| `issuedTo` | No | Texto libre: vendedor, razón social, correo, etc. (control comercial). |
| `note` | No | Nota interna o comentario. |

La **firma** `sig` se calcula sobre el objeto `payload` serializado con claves ordenadas alfabéticamente (mismo algoritmo que el estado local).

### Tras aplicar en la app (almacenado en `runtime-v1.json`)

El payload guardado usa `mode: "renewal"` y conserva `licenseId`, `licenseType`, `issuedTo`, `validUntil`, etc., con una nueva firma del estado local.

## Ubicación de datos

- Directorio: `app.getPath("userData")` (p. ej. Windows: `%AppData%\<nombreApp>\`).
- Archivo de estado: `license/runtime-v1.json` (payload + firma).
- El nombre de la carpeta userData depende del `name` en `package.json` del proyecto desktop (actualmente `desktop`).

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `LICENSE_HMAC_SECRET` | Secreto compartido para firmar estado local y archivos `.json`/`.lic` de renovación. **Definir en CI** para releases; el valor por defecto en código es solo para desarrollo. |
| `ELECTRON_SKIP_LICENSE=1` | Solo empaquetado: **omite** la verificación (pruebas internas; no usar en entrega a clientes). |

## Flujo para el vendedor (real)

1. El administrador genera el archivo con `generate-license.js` (mismo secreto que la app), p. ej. prueba 5 días hábiles o fecha fija.
2. Se entrega el archivo al vendedor (correo, USB, carpeta compartida, etc.).
3. En un **PC nuevo**, el vendedor abre la app y ve de inmediato **Licencia requerida** → **Seleccionar licencia**.
4. Elige el archivo recibido (`.json` o `.lic`).
5. La app valida firma, fechas y `licenseId`; si todo es correcto, muestra confirmación con el **número de licencia** y **reinicia**.
6. Tras el reinicio, la licencia es válida y puede acceder al **login** / uso normal.

## Pantalla de licencia (contenido esperado)

- Título: **Licencia requerida**.
- Texto: indicación de seleccionar el **archivo** entregado por el administrador (sin escribir códigos).
- Ayuda: formatos **.json** y **.lic**.
- Botón **Seleccionar licencia** (diálogo de archivo).
- Botón **Salir**.
- Motivo del bloqueo (sin licencia, trial antiguo vencido, licencia vencida, etc.) y, si aplica, **referencia** de la última licencia conocida en el equipo (`licenseId`).

## Probar pantalla de licencia (desarrollo / QA)

- **Equipo sin licencia**: con la app cerrada, elimine o renombre `%APPDATA%\<app>\license\runtime-v1.json` y abra el portable → debe pedir licencia.
- **Solo si aún existe estado `mode: trial` (legado)**: `simulate-trial-expired.js` para forzar vencimiento de ese trial.

## Generar licencia de renovación o de prueba

```bash
cd apps/desktop
set LICENSE_HMAC_SECRET=tu-secreto-alineado-con-la-app
node scripts/generate-license.js --id LIC-COMM-2026-0042 --until 2026-12-31 --type COMMERCIAL --to "Vendedor / razón social" --out renovacion.json
```

**Prueba de 5 días hábiles** (misma regla calendario lun–vie que antes usaba el trial automático):

```bash
node scripts/generate-license.js --id LIC-TRIAL-0001 --business-days 5 --type TRIAL_EXTENSION --to "Vendedor X" --out prueba-5-habiles.json
```

Parámetros:

- **`--id`** (obligatorio): identificador visible, ej. `LIC-TRIAL-0001`.
- **`--until`**: fecha fin `YYYY-MM-DD` (fin de día local). **O bien** `--business-days N` (1–365), no ambos.
- **`--type`**: `COMMERCIAL` | `TRIAL_EXTENSION` | `INTERNAL` | `PARTNER` (por defecto `COMMERCIAL`).
- **`--to`**: opcional, texto para `issuedTo`.
- **`--nota`**: opcional.
- **`--out`**: ruta del archivo; si se omite, imprime JSON por stdout.

Entregar el archivo al usuario; en la pantalla de bloqueo: **Seleccionar licencia**. La app reinicia y valida la firma.

### Ejemplo en repo

`examples/renovacion-prueba-interna.json` — generado con el secreto de desarrollo por defecto; solo válido si la app usa el mismo `LICENSE_HMAC_SECRET`.

## Empaquetado: Next standalone y `node_modules`

- `server.js` del standalone hace `process.chdir(__dirname)` en `resources/standalone/apps/web` y luego `require('next')`. Node resuelve el paquete subiendo directorios hasta `resources/standalone/node_modules/next`.
- **electron-builder** al copiar `extraResources` desde `../web/.next/standalone` suele **excluir `node_modules`** por filtros internos, dejando un portable sin `next` → error `Cannot find module 'next'` y `Servidor Next exit code=1` en `backend.log`.
- El script **`scripts/ensure-standalone-in-dist.js`** se ejecuta al final de `npm run build` del workspace desktop (`electron-builder && …`) y **reemplaza** `dist/win-unpacked/resources/standalone` con una copia **completa** del árbol `apps/web/.next/standalone` (incluido `node_modules`). Así la carpeta portable se puede **copiar a otra ruta** sin depender de rutas del proyecto original.
- Validación rápida: `npm run validate-standalone:dist --workspace=desktop` debe reportar OK para `node_modules/next/package.json`.

## Límites de seguridad (MVP)

- El secreto HMAC va en el binario / entorno; un usuario avanzado puede intentar extraerlo o parchear el exe.
- No hay enlace obligatorio a máquina ni anti-manipulación de reloj en esta versión.
- El API Nest embebido en `127.0.0.1:4000` no valida licencia por petición; el bloqueo es a nivel **shell** Electron. Endurecer: middleware en API leyendo el mismo estado (opcional).

## Mejoras opcionales

- Firma asimétrica (clave privada solo en tu máquina de emisión).
- Vincular estado a `machineId` / hash de hardware.
- Detección de retroceso de reloj (con cuidado con falsos positivos).
- Validación de licencia también en el backend embebido.

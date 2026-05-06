# Checklist — aceptación manual ejecutable desktop (cierre Fase 1)

**Contexto:** Fase 1 = *cerrada técnicamente / pendiente aceptación usuario*.  
**Qué probar:** carpeta empaquetada (ej. `apps/desktop/dist/win-unpacked/` o `dist/Aplicacion de traslado/`) — ejecutar **`Cotizaciones PFV Avanzada.exe`**.

**Credenciales tras seed:** si es primera instalación en el PC, el seed crea usuario `eduardo.yanez.concha@gmail.com` / `admin123` (solo si el arranque llegó a completar migraciones + seed).

---

## Checklist (marcar SÍ / NO / N/A)

| # | Ítem | SÍ | NO | N/A |
|---|------|----|----|-----|
| 1 | **Arranque:** la app abre sin error crítico; tras licencia OK aparece la ventana principal (no pantalla en blanco prolongada). | ☐ | ☐ | ☐ |
| 2 | **Licencia:** si no hay licencia, se ve pantalla de bloqueo con **ID de instalación**; al cargar archivo válido (o si ya había licencia) la app **reinicia** y entra al flujo normal. | ☐ | ☐ | ☐ |
| 3 | **Login:** inicio de sesión con usuario/contraseña válidos → entra al dashboard/home. | ☐ | ☐ | ☐ |
| 4 | **Cliente:** crear un cliente nuevo (mínimo: nombre + tipo); aparece en listado. | ☐ | ☐ | ☐ |
| 5 | **Cotización:** crear cotización asociada al cliente (título + tipo proyecto). | ☐ | ☐ | ☐ |
| 6 | **Guardar / reabrir:** salir de la cotización y **volver a abrirla** desde listado; datos coherentes. | ☐ | ☐ | ☐ |
| 7 | **Company profile:** abrir **Datos de empresa** (o ruta equivalente), editar al menos un campo y **guardar**; al recargar persiste. | ☐ | ☐ | ☐ |
| 8 | **Logo (si aplica):** subir imagen; `hasLogo` / vista previa coherente (si la pantalla lo muestra). | ☐ | ☐ | ☐ |
| 9 | **FV (si aplica):** crear o abrir un **estudio FV** y completar un flujo mínimo (guardar borrador o validar según uso real). | ☐ | ☐ | ☐ |

**Notas breves (fallos, capturas, versión build):**  
_…_

---

## Criterio de cierre

### Fase 1 **cerrada** (sin observaciones bloqueantes)

- Todos los ítems **1–7** marcados **SÍ**.
- Ítems **8–9:** **SÍ** o **N/A** explícito (si el piloto no incluye logo ni FV, documentar N/A).
- Sin bloqueo que impida trabajo diario (crashes al arranque, login imposible, datos que no persisten).

### Fase 1 **cerrada con observaciones**

- **1–7** todos **SÍ**, pero **8** u **9** en **NO** → *Fase 1 cerrada con observaciones* (funcionalidad core OK; registrar incidencia para parche o Fase 1.1).
- O **un solo** ítem entre **4–7** en **NO** pero con **workaround** documentado y fecha de corrección → *cerrada con observaciones*.

### Fase 1 **no cerrada** (seguir en piloto)

- Cualquier **NO** en **1, 2 o 3** (arranque, licencia, login).
- **NO** en **6** (no persiste / no reabre cotización).
- Más de un **NO** en **4–7**.

---

*Última alineación: MVP1 desktop — sin Hub, sin Fase 2 licencia JWT.*

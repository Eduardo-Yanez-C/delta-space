# Cotizaciones PFV Avanzada — Versión escritorio

App de escritorio (Electron) que reutiliza el frontend de `apps/web` (Next.js en modo standalone).

**MVP 1 (oficial):** desktop + Nest embebido + SQLite + licencia fuerte — ver **`apps/docs/producto/mvp1-desktop-tecnico.md`**.  
Visión largo plazo (incl. sync): `apps/docs/producto/arquitectura-escritorio-licenciamiento-central.md`.

## Desarrollo

Desde la raíz del monorepo:

```bash
npm run dev:desktop
```

Se levantan API, web y Electron. La ventana de Electron carga `http://localhost:3000`.

## Build del ejecutable

Desde la raíz:

```bash
npm run build:desktop
```

1. Se construye la app web en modo **standalone** (`BUILD_DESKTOP=1`), generando `apps/web/.next/standalone`.
2. Se copian `.next/static` y `public` al standalone (`prepare-standalone`).
3. Se descarga Node.js portable para la plataforma y se deja en `apps/desktop/node-portable/win32-x64/` (`download-node`).
4. Se empaqueta Electron con `electron-builder` en una carpeta nueva `dist/electron-out-<timestamp>/win-unpacked` (evita bloqueos de Windows sobre builds anteriores).
5. Se sincroniza el standalone completo y se genera la **carpeta oficial de traslado:** `apps/desktop/dist/Cotizaciones-PFV-Portable/` con `Cotizaciones PFV Avanzada.exe`. Ver **`DESKTOP_TRASLADO.md`** y `dist/LLEVAR-ESTA-CARPETA.txt`.

En producción la app arranca el servidor Next embebido (puerto 31337) usando el **Node portable empaquetado** en `resources/node/`. El usuario final **no necesita** tener Node.js instalado en el equipo.

## API en la versión escritorio

- **Empaquetado (`npm run build:desktop`):** se incluye el **backend Nest** en `resources/backend` (script `prepare-embedded-backend`). Arranca en **127.0.0.1:4000** y usa **SQLite** en el perfil de usuario (`database.sqlite`). Detalle: `apps/docs/producto/mvp1-desktop-tecnico.md`.
- **Desarrollo (`npm run dev:desktop`):** suele usarse API en `localhost:4000` vía `npm run dev:api` y web en `3000`; el ejecutable final no depende de tener Node global instalado.

## Cómo probar el ejecutable sin afectar la web

1. **Web:** `npm run dev` o `npm run build` + `npm run start --workspace=web` siguen igual; no usan `BUILD_DESKTOP`.
2. **Desktop:** `npm run build:desktop` solo genera standalone cuando se ejecuta ese script. El build normal de web no usa `output: 'standalone'`.
3. Para probar el ejecutable tras `build:desktop`: abrir `apps/desktop/dist/Cotizaciones-PFV-Portable/Cotizaciones PFV Avanzada.exe` (toda la carpeta portable). No hace falta tener Node instalado en el equipo.

## Configuración de empaquetado

- **Nombre:** Cotizaciones PFV Avanzada  
- **appId:** `cl.pvquoting.desktop`  
- **Windows:** target `dir` → artefacto intermedio bajo `dist/electron-out-*/win-unpacked`; **traslado:** solo `dist/Cotizaciones-PFV-Portable/`.  
- **macOS:** DMG.  
- **Linux:** AppImage.

## Validar que el ejecutable no depende de Node en el PATH

Para comprobar que el .exe ya no requiere Node instalado en el equipo:

1. **Tras el build:** comprobar que existe `apps/desktop/dist/Cotizaciones-PFV-Portable/resources/node/node.exe`.
2. **En una máquina sin Node (o con Node fuera del PATH):**
   - Copiar la carpeta completa `dist/Cotizaciones-PFV-Portable` a ese equipo (o a una VM / otro usuario sin Node).
   - Asegurarse de que `node` no esté en el PATH (o desinstalar Node).
   - Ejecutar `Cotizaciones PFV Avanzada.exe`.
   - La ventana debe abrir y la app cargar (login, navegación). Si la API es remota, no hace falta levantar nada más; si es local, la API debe estar corriendo en ese equipo o en una URL accesible.
3. **Prueba rápida en el mismo equipo:** renombrar o mover temporalmente el ejecutable `node` del PATH (o usar un terminal donde `node` no esté disponible) y ejecutar de nuevo `Cotizaciones PFV Avanzada.exe` desde `dist/Cotizaciones-PFV-Portable`. Debe seguir funcionando.

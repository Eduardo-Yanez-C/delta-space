# Plan técnico: Node portable empaquetado en el ejecutable

## Objetivo

Eliminar la dependencia de que el usuario final tenga Node.js instalado. La app de escritorio seguirá arrancando el servidor Next (standalone) desde el ejecutable, pero usando un Node portable incluido en el instalador.

- **Web:** sin cambios.
- **Desarrollo:** sin cambios (sigue usando `node` del PATH y `http://localhost:3000`).
- **Producción empaquetada:** el main de Electron arranca el servidor Next con el Node que va dentro de `resources`, no con el `node` del sistema.

---

## 1. Dónde ubicar el Node portable dentro del proyecto / build

### 1.1 Ubicación en el repo (solo para descarga / cache)

- **Carpeta propuesta:** `apps/desktop/node-portable/` (o `apps/desktop/scripts/node-portable/` si se prefiere dejar los binarios fuera del árbol versionado).
- **Contenido:** no se versionan los binarios de Node. Esa carpeta se usa como **destino de descarga** cuando corre el script que obtiene Node para la plataforma actual (o para las plataformas objetivo en CI).
- **Alternativa:** carpeta de cache fuera del repo, por ejemplo `apps/desktop/.cache/node-portable/`, y que el script de build la rellene antes de llamar a electron-builder.

### 1.2 Estructura por plataforma

Tras descargar y descomprimir el build oficial de Node (nodejs.org):

- **Windows (win32, x64):**
  - Descargar: `node-vX.Y.Z-win-x64.zip` (build oficial).
  - Descomprimir y tomar solo el ejecutable necesario: `node.exe` (y opcionalmente la carpeta que lo acompaña si el runtime lo requiere; en la práctica el zip de Node para Windows trae `node.exe` en la raíz).
  - Destino final en el build: por ejemplo `node-portable/win32-x64/node.exe` (o `node-portable/win32-x64/` con todo el contenido mínimo necesario del zip).

- **macOS / Linux (si se empaquetan después):**
  - Análogo: `node-portable/darwin-x64/` o `node-portable/linux-x64/` con el binario `node` (y dependencias mínimas si hace falta).

Para la **primera implementación** se puede restringir a **solo Windows x64** y dejar la estructura lista para añadir más plataformas después.

### 1.3 Dónde “queda” el Node en el instalador

- electron-builder copia recursos vía `extraResources`.
- Se configurará algo tipo: `from: "node-portable/win32-x64"` → `to: "node"` (o nombre equivalente).
- En el equipo del usuario, en runtime, la app verá por ejemplo:
  - **Windows:** `process.resourcesPath + "/node/node.exe"`.
  - **macOS:** `process.resourcesPath + "/node/bin/node"` (según cómo se empaquete el binario de Node para esa plataforma).

La ubicación en proyecto/build es entonces: **carpeta `node-portable/<platform>/`** rellenada por un script previo al `electron-builder`, y esa carpeta (o su contenido) es la que se incluye en `extraResources`.

---

## 2. Cómo incluirlo en electron-builder

### 2.1 Condición de inclusión

- El Node portable **solo** debe incluirse cuando se va a empaquetar para esa plataforma.
- Si se usa una sola config para varias plataformas, se puede:
  - Tener en `extraResources` una entrada condicional por plataforma (electron-builder permite array de recursos con distintas `from`/`to` según `platform`), o
  - Tener un script de build que, según la plataforma, prepare la carpeta `node-portable/<platform>/` y luego ejecute electron-builder (que siempre incluye, por ejemplo, `node-portable/win32-x64` → `node` en Windows).

### 2.2 Configuración concreta (idea)

- En `apps/desktop/package.json`, en el bloque `"build"`:
  - Añadir en `extraResources` una entrada que copie la carpeta del Node portable a `resources/node` (o el nombre elegido).
  - Ejemplo conceptual:
    - `from`: `"node-portable/win32-x64"` (o la ruta que deje el script de descarga).
    - `to`: `"node"`.
  - Asegurar que el script que descarga Node se ejecute **antes** de `electron-builder` (por ejemplo desde `build:desktop` en raíz o desde un script `prebuild` en desktop).

### 2.3 Orden del build

1. Build de Next (standalone) con `BUILD_DESKTOP=1`.
2. `prepare-standalone` (copiar static + public al standalone).
3. **Nuevo:** script que descarga/descomprime Node para la plataforma y deja los archivos en `node-portable/<platform>/`.
4. `electron-builder`, que ya verá esa carpeta y la empaquetará en `resources/node`.

---

## 3. Cambios exactos en `main.js`

### 3.1 Resolver la ruta del Node empaquetado

- **Solo cuando** `app.isPackaged === true`:
  - En lugar de usar el string `"node"` en el `spawn`, construir la ruta al ejecutable de Node incluido en recursos.
  - Ejemplo (Windows):  
    `path.join(process.resourcesPath, "node", "node.exe")`.
  - Ejemplo (macOS/Linux, cuando se implemente):  
    `path.join(process.resourcesPath, "node", "bin", "node")` o la ruta que deje el zip de Node en esa plataforma.
- Comprobar que el archivo exista (`fs.existsSync`) antes de arrancar el servidor; si no existe, mostrar un mensaje de error claro y no llamar a `spawn("node", ...)` como fallback (para no depender del Node del sistema).

### 3.2 Spawn del servidor Next

- Reemplazar:
  - `spawn("node", [path.relative(standaloneDir, serverJs)], { cwd: standaloneDir, env: { ... } })`
- Por algo equivalente a:
  - `spawn(nodePath, [path.relative(standaloneDir, serverJs)], { cwd: standaloneDir, env: { ... } })`
- Donde `nodePath`:
  - En desarrollo: no se usa (la ventana carga `http://localhost:3000` y el servidor lo corre el usuario con `npm run dev`).
  - En producción empaquetada: la ruta al `node.exe` (o `node`) dentro de `process.resourcesPath`, como arriba.

### 3.3 Sin cambios en el resto

- Lógica de `waitForServer`, creación de ventana, cierre del proceso al salir, manejo de `activate` (macOS), etc., se mantiene igual.
- El único cambio es el primer argumento del `spawn` cuando la app está empaquetada.

---

## 4. Cómo mantener el comportamiento actual en desarrollo

- **Condición en main.js:** si `!app.isPackaged`, no se usa ninguna ruta a Node ni se arranca ningún servidor desde Electron; solo se hace `createWindow(DEV_URL)` con `DEV_URL = "http://localhost:3000"`.
- El script `dev:desktop` (raíz) sigue igual: levanta API, web (Next dev) y Electron; Electron abre `http://localhost:3000`. No se toca ese flujo.
- En desarrollo no se descarga ni se usa la carpeta `node-portable`; solo existe para el build de producción (cuando se ejecuta `build:desktop` o el script equivalente que llame a electron-builder).

Con esto el comportamiento en desarrollo se mantiene sin cambios.

---

## 5. Cómo manejar la URL de la API remota

- La URL de la API es la que ya usa el frontend: `NEXT_PUBLIC_API_URL` (build time) en `apps/web/lib/api.ts`, con fallback a `http://localhost:4000/api`.
- **Sin cambios de implementación obligatorios** para este plan:
  - Para “escritorio + API remota”: en el build se define `NEXT_PUBLIC_API_URL=https://tu-api.ejemplo.com/api` (o la que corresponda) antes de ejecutar el build de web (y luego el de desktop). El ejecutable llevará esa URL embebida.
  - Para “escritorio + API local”: se puede seguir construyendo con `NEXT_PUBLIC_API_URL=http://localhost:4000/api` (o sin setearla, usando el default).
- Opcional a futuro: archivo de configuración (p. ej. `config.json` junto al ejecutable) o variable de entorno que el frontend lea en runtime para la URL de la API; eso quedaría fuera del alcance de este plan y no es necesario para “primera versión usable = API remota + Node portable”.

Resumen: **no hace falta tocar la lógica de la URL de la API** para cerrar este plan; solo documentar que el build para “API remota” debe fijar `NEXT_PUBLIC_API_URL` en ese paso.

---

## 6. Scripts nuevos que harían falta

### 6.1 Script de descarga de Node portable

- **Ubicación sugerida:** `apps/desktop/scripts/download-node-portable.js` (o `.cjs` si hace falta).
- **Responsabilidad:**
  - Detectar plataforma (e.g. `process.platform`, `process.arch`) o recibirla por argumento (para CI: build Windows desde cualquier host).
  - Definir versión de Node a usar (ej. 20 LTS o la que sea compatible con el standalone de Next).
  - Descargar el zip/tarball oficial de Node para esa plataforma desde nodejs.org (o mirror).
  - Descomprimir y dejar en `apps/desktop/node-portable/<platform>/` solo lo necesario (como mínimo el binario `node` / `node.exe`).
- **Invocación:** desde un script npm en `apps/desktop`, por ejemplo `"download-node": "node scripts/download-node-portable.js"`.

### 6.2 Integración en el build

- **Opción A – desde raíz:**  
  En el script `build:desktop` del `package.json` raíz, después de `prepare-standalone` y antes de `npm run build --workspace=desktop`, ejecutar el script de descarga de Node para la plataforma actual (o la target), por ejemplo:  
  `npm run download-node --workspace=desktop`.
- **Opción B – desde desktop:**  
  En `apps/desktop`, un script tipo `"prebuild": "node scripts/download-node-portable.js"` que se ejecute antes de `electron-builder` cuando se hace `npm run build` en desktop. Así, quien ejecute `build:desktop` desde raíz (que a su vez llama a `build` de desktop) dispara la descarga automáticamente.

Recomendación: **Opción B** (prebuild en desktop) o un paso explícito `download-node` dentro de `build:desktop` en raíz, para que el flujo “build:desktop” siga siendo un solo comando y siempre deje listo el Node portable antes de empaquetar.

### 6.3 Resumen de scripts

| Script | Dónde | Qué hace |
|--------|--------|----------|
| `download-node-portable.js` | `apps/desktop/scripts/` | Descarga y descomprime Node para la plataforma (o la target) en `node-portable/<platform>/`. |
| `download-node` (npm) | `apps/desktop` | Ejecuta el script anterior. |
| `prebuild` (opcional) | `apps/desktop` | Ejecuta `download-node` antes de `build`, para que `electron-builder` siempre tenga Node disponible. |
| `build:desktop` (raíz) | Sin cambio de nombre | Incluye implícitamente la descarga de Node (vía prebuild o paso explícito) antes de electron-builder. |

---

## 7. Cómo probar que el ejecutable ya no depende de Node instalado

### 7.1 Comprobar que el Node empaquetado se usa

- En `main.js`, en modo empaquetado, se puede loguear (o mostrar en un mensaje de depuración) la ruta de `nodePath` que se usa en el `spawn`. Esa ruta debe ser dentro de `process.resourcesPath` (p. ej. `.../resources/node/node.exe`), no `/usr/bin/node` ni el `node` del PATH.

### 7.2 Prueba en una máquina sin Node (o con Node quitado del PATH)

- En un equipo donde Node **no** esté instalado (o donde se haya quitado Node del PATH y no exista `node` en una ruta estándar):
  1. Copiar la carpeta `dist/win-unpacked` (o el instalador si se vuelve a usar NSIS/portable) a ese equipo.
  2. Ejecutar `Cotizaciones PFV Avanzada.exe`.
  3. Comprobar que la ventana abre y la app carga (login, navegación). La API puede ser remota (URL configurada en build) para no depender de nada local.
- Si la app arranca y funciona en esa máquina, el ejecutable ya no depende de Node instalado en el equipo.

### 7.3 Prueba rápida en la máquina de desarrollo

- Renombrar o mover temporalmente el `node` del PATH (o usar un entorno donde `node` no esté disponible) y ejecutar de nuevo `Cotizaciones PFV Avanzada.exe` desde `dist/win-unpacked`. Debe seguir funcionando.

### 7.4 Checklist de validación

- [ ] Build `build:desktop` termina sin error y la carpeta `node-portable/` (o la que se use) existe y contiene el binario de Node.
- [ ] En `dist/win-unpacked/resources/` existe la carpeta `node` con `node.exe` (Windows).
- [ ] Al abrir la app empaquetada, el servidor Next arranca y la ventana carga la UI.
- [ ] En un equipo sin Node en el PATH (o con Node desinstalado), el mismo ejecutable arranca y la app responde.
- [ ] El flujo `dev:desktop` sigue funcionando igual (Next dev + Electron a localhost:3000).

---

## Orden sugerido de implementación

1. Añadir script `download-node-portable.js` y script npm `download-node` en desktop; probar que deja Node en `node-portable/win32-x64/` (o la ruta elegida).
2. Configurar `extraResources` en electron-builder para incluir esa carpeta como `resources/node`.
3. Modificar `main.js` para usar `process.resourcesPath + "/node/..."` cuando `app.isPackaged`, manteniendo el uso de `localhost:3000` en desarrollo.
4. Integrar la descarga en el flujo de build (prebuild o paso explícito en `build:desktop`).
5. Ejecutar `build:desktop`, instalar o copiar el resultado a una máquina sin Node (o sin Node en PATH) y validar según el apartado 7.

Con esto se cierra el plan técnico para tener un ejecutable autónomo (Node portable empaquetado), manteniendo la web y el desarrollo intactos y reutilizando el standalone actual de Next.

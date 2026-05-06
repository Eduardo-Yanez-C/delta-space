# Plan técnico: versión web + versión escritorio

## Objetivo
Tener dos formas de uso (web y escritorio) reutilizando `apps/api` y `apps/web`, sin duplicar lógica ni crear un sistema aparte.

---

## 1. Electron vs otras opciones

| Opción      | Ventajas                                      | Desventajas                                      |
|------------|-----------------------------------------------|--------------------------------------------------|
| **Electron** | Maduro, mismo stack (Chromium), mucha documentación con Next.js, un solo lenguaje (JS/TS). | Peso del binario (~150 MB+), mayor uso de RAM.   |
| **Tauri**  | Binarios pequeños, menos RAM, WebView del sistema. | Requiere Rust; empaquetar Next + API es más elaborado; ecosistema menor para Next. |
| **NW.js**  | Similar a Electron.                           | Menor adopción que Electron.                     |

**Recomendación: Electron.**  
- Encaja con el stack actual (Node, Next, React).  
- Patrón habitual: ventana que carga la misma app web (por URL o por archivos estáticos).  
- No hace falta reescribir nada; la app de escritorio es un “contenedor” que muestra `apps/web`.  
- Si en el futuro el tamaño del instalador es crítico, se puede valorar Tauri.

---

## 2. Estructura en el monorepo

Mantener workspaces actuales y añadir una app más:

```
apps/
  api/        # Backend (sin cambios)
  web/        # Frontend Next.js (sin cambios de lógica)
  desktop/    # Nueva: shell Electron que carga la web
```

- **api** y **web**: se dejan como están.  
- **desktop**: nuevo proyecto mínimo (main process de Electron + config de empaquetado). No contiene copia del frontend; solo invoca o empaqueta el resultado de `apps/web`.

Raíz del repo (opcional pero útil):

- Un `package.json` en la raíz con scripts que orquesten api, web y desktop (ver punto 6).

---

## 3. Cómo reutilizar `apps/web`

**Idea:** La versión escritorio no duplica el código de la web; solo decide **dónde** se muestra.

- **Desarrollo:** Electron abre una ventana que carga `http://localhost:3000` (o el puerto que use `next dev`). Misma app que en el navegador.  
- **Producción escritorio:** Dos sub-opciones:
  - **A) Servidor embebido (recomendado):** Se construye Next en modo standalone (`next build` con `output: 'standalone'`). El proceso principal de Electron (o un script que lance Electron) inicia ese servidor en un puerto fijo (ej. 3000) y la ventana carga `http://localhost:3000`. El usuario solo abre “PV Quoting” y ve la app.
  - **B) Export estático:** Si la app no usa SSR ni API routes de Next y todo es cliente + API externa, se puede hacer `next export` y que Electron cargue los archivos estáticos (por ejemplo con un servidor estático mínimo o `file://`). Requiere que la app sea 100 % cliente y que la API base URL esté bien configurada (ej. `NEXT_PUBLIC_API_URL`).

**Recomendación:** Opción A (standalone) para no depender de que la app sea totalmente estática y para que el flujo web y escritorio sea el mismo.

Resumen: **reutilización = misma build de `apps/web`; la app de escritorio solo la sirve o la abre por URL.**

---

## 4. Conexión escritorio ↔ `apps/api`

- El frontend (`apps/web`) ya usa `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:4000/api`). En escritorio se sigue usando esa variable en build time (o en runtime si se inyecta de otra forma).
- **Desarrollo:** API en 4000, web en 3000, Electron apunta a 3000. Las peticiones desde la ventana de Electron van a 4000 igual que en el navegador. CORS ya está pensado para el origen de la web; si la ventana de Electron carga `http://localhost:3000`, el origen es ese y no suele hacer falta cambiar nada en la API.
- **Producción escritorio (con API en la misma máquina):**  
  - Si la API se ejecuta como proceso aparte (servicio o binario), el usuario (o el instalador) la inicia y la app de escritorio usa por ejemplo `http://localhost:4000/api` (o una URL configurable).  
  - Si se quisiera empaquetar la API dentro del instalador (un solo .exe/.app), sería un paso posterior y más complejo; no es necesario para el plan inicial.
- **Producción escritorio (API en servidor):** Se configura `NEXT_PUBLIC_API_URL` con la URL del servidor (ej. `https://api.midominio.com`) y la app de escritorio solo abre la UI; toda la lógica sigue en la API.

No hace falta tocar la lógica de `api.ts`; solo asegurar que en cada entorno (dev escritorio, prod escritorio local, prod escritorio con servidor) `NEXT_PUBLIC_API_URL` tenga el valor correcto en el build de la web que consumirá Electron.

---

## 5. Simplificar desarrollo (una sola “entrada”)

Hoy ya existe `npm run dev` que levanta api + web con `concurrently`. Para no depender de varias terminales manualmente:

- **Opción 1 (recomendada):** Añadir un script tipo `dev:desktop` que:
  1. Arranque la API (`npm run dev:api` o equivalente).
  2. Arranque la web (`npm run dev:web`).
  3. Espere a que la web responda en el puerto configurado (por ejemplo con `wait-on http://localhost:3000`).
  4. Lance Electron en modo dev apuntando a `http://localhost:3000`.

Todo desde un solo comando (por ejemplo `npm run dev:desktop` en raíz o en `apps/desktop`).

- **Opción 2:** Mantener `npm run dev` (api + web) y en otra terminal `npm run dev:desktop` solo para Electron; el desarrollador debe tener ya api y web en marcha. Más simple de implementar pero dos pasos.

Recomendación: **Opción 1** con `wait-on` (o similar) para una sola orden y una sola “entrada” al desarrollo escritorio.

---

## 6. Build: web vs escritorio

- **Web (como ahora):**
  - `npm run build` (o `npm --workspace web run build`): genera el build de Next en `apps/web/.next` (y si se usa standalone, el árbol en `apps/web/.next/standalone`).
  - El despliegue web (Vercel, servidor propio, etc.) usa ese build; no cambia.

- **Escritorio:**
  1. **Build de la web para escritorio:**  
     - En `apps/web`, configurar `output: 'standalone'` en `next.config.js` (si se elige servidor embebido).  
     - Ejecutar `next build`; el resultado estará en `apps/web/.next/standalone` (y `static` según documentación de Next).
  2. **Empaquetado Electron:**  
     - En `apps/desktop`, el script de build (por ejemplo con `electron-builder` o `electron-packager`):
       - Copia o referencia el output de `apps/web` (standalone + static).
       - Incluye el `main` de Electron (main process).
       - Al empaquetar, el ejecutable puede iniciar el servidor Next (node del standalone) en un puerto fijo y abrir la ventana a esa URL; o, si se usa estático, sirve los estáticos y abre la ventana a esa URL.
  3. **Resultado:** Un instalador o ejecutable (por ejemplo .exe, .dmg, .AppImage) que el usuario instala o ejecuta; al abrirlo se ve la misma UI que en la web.

Resumen:
- **Build web:** igual que ahora; sirve para navegador y para hospedaje en servidor.
- **Build escritorio:** build de la web (standalone o estático) + empaquetado de Electron en un instalador/app.

---

## 7. Scripts recomendados

En la **raíz** (opcional pero útil para un solo punto de entrada):

| Script            | Acción |
|-------------------|--------|
| `dev`             | Ya existe: api + web (desarrollo en navegador). |
| `dev:desktop`     | Api + web + espera a 3000 + lanza Electron (desarrollo escritorio en un comando). |
| `build`           | Ya existe: build de api y web. |
| `build:desktop`   | Build de web (standalone) + empaquetado Electron (instalador/app). |
| `start:desktop`   | Ejecutar la app de escritorio ya construida (para pruebas locales). |

En **apps/desktop**:

| Script     | Acción |
|------------|--------|
| `dev`      | Lanzar Electron en modo dev (carga `http://localhost:3000`); asume que api y web ya están en marcha, o se llama desde raíz con `dev:desktop`. |
| `build`    | Empaquetar: construir/copiar web + Electron y generar instalador. |
| `start`    | Ejecutar el binario/instalador generado (o el script que inicia standalone + Electron). |

En **apps/web** (si se usa standalone para escritorio):

- Mantener `build` actual; en `next.config.js` añadir `output: 'standalone'` cuando se vaya a usar para escritorio (o siempre; no rompe el despliegue web).

No es obligatorio que todos los scripts estén en raíz; lo importante es tener al menos:
- Un comando para desarrollo escritorio sin varias terminales manuales (`dev:desktop`).
- Un comando para generar el instalador de escritorio (`build:desktop`).

---

## 8. Resumen de decisiones

| Tema              | Decisión |
|-------------------|----------|
| Tecnología        | Electron. |
| Estructura        | Añadir `apps/desktop` (shell Electron). |
| Reutilización web | Misma app: en dev Electron carga localhost; en prod se usa build standalone (o estático) dentro del paquete. |
| Conexión API      | Sin cambios; seguir con `NEXT_PUBLIC_API_URL` (dev: localhost:4000; prod: la que corresponda). |
| Desarrollo simple | Un script `dev:desktop` que levante api + web + Electron. |
| Build web         | Sin cambios; opcionalmente `output: 'standalone'` para escritorio. |
| Build escritorio  | Build web (standalone/estático) + empaquetado con electron-builder (o similar). |
| Scripts           | `dev:desktop`, `build:desktop`, y en desktop `dev` / `build` / `start`. |

Con esto se puede implementar la versión escritorio manteniendo la web tal cual y sin duplicar lógica.

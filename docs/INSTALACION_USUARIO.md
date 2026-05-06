# Instalación y uso — Nivel usuario

Este documento describe cómo abrir y usar la aplicación **Cotizaciones PFV Avanzada** (escritorio y web) y realizar la primera configuración.

---

## 1. Cómo abrir la aplicación

### App de escritorio (Windows)

- **Carpeta de la aplicación:** `apps\desktop`
- **Forma recomendada de abrir (desarrollo):**
  1. Asegúrese de que el **servidor API** y la **app web** estén en ejecución (ver sección “App web” más abajo).
  2. Desde la **raíz del proyecto** (carpeta donde está el `package.json` principal), ejecute:
     ```bash
     npm run dev:desktop
     ```
     Esto abre la ventana de Electron cargando la interfaz en `http://localhost:3000`.

- **Forma empaquetada (usuario final):**
  - Tras generar la aplicación con el build de escritorio, el ejecutable estará en:
    `apps\desktop\dist\win-unpacked\`
  - Ejecute el archivo `.exe` con el nombre del producto (por ejemplo **Cotizaciones PFV Avanzada.exe**).
  - La app empaquetada arranca su propio servidor web interno y no requiere tener el navegador abierto.

### App web

- **Carpeta raíz desde la que se inicia todo:** la **raíz del proyecto** (carpeta que contiene el `package.json` con `"name": "pv-quoting-platform"`).
- **Requisito:** tener **Node.js** y **npm** instalados.

**Opción A — Arranque con un solo comando (recomendado)**

Desde la raíz del proyecto:

```bash
npm run dev
```

Esto inicia:
- **Backend (API)** en `http://localhost:4000`
- **Frontend (web)** en `http://localhost:3000`

Luego abra el navegador en: **http://localhost:3000**

**Opción B — Arranque en modo “producción local”**

1. Primero compile una vez:
   ```bash
   npm run build
   ```
2. Luego inicie API + web:
   ```bash
   npm run start:local
   ```
   O bien ejecute el script por lotes (Windows):
   - Ruta del script: `scripts\start-local.bat`
   - Puede hacer doble clic en `start-local.bat` o ejecutarlo desde la consola. El script cambia a la raíz del proyecto y ejecuta `npm run start:local`.

---

## 2. Primera configuración (/setup)

La primera vez que use la aplicación (o si no hay configuración guardada), se mostrará la pantalla **Configuración inicial**.

1. **URL del API (obligatorio)**  
   Indique la dirección del servidor backend, por ejemplo:
   - `http://localhost:4000/api` (si el backend está en su mismo equipo)
   - O la URL que le haya dado su administrador (ej. `https://su-servidor.com/api`).

2. **Código de activación (opcional)**  
   Si le han proporcionado un código de activación, ingréselo. La instalación quedará registrada en el servidor. Si no tiene código, puede dejar el campo vacío y usar la aplicación en modo local.

3. **Nombre del equipo (opcional)**  
   Si ingresó código de activación, puede poner un nombre para identificar este equipo (ej. “PC Oficina Santiago”).

4. Pulse **Guardar y continuar**.  
   La aplicación comprobará que el servidor responda y, si hay código, registrará la instalación. Después pasará a la pantalla de inicio de sesión.

---

## 3. Inicio de sesión

- En la pantalla de **Iniciar sesión**, introduzca el **correo** y la **contraseña** que le haya dado su administrador.
- Pulse **Iniciar sesión**.  
  Si las credenciales son correctas, entrará al sistema.

---

## 4. Rutas principales en la aplicación

Una vez dentro, puede usar por ejemplo:

- **Inicio / Dashboard:** pantalla principal.
- **Clientes:** listado y gestión de clientes.
- **Cotizaciones:** listado y detalle de cotizaciones.
- **Estudios FV:** estudios fotovoltaicos asociados a clientes.
- **Usuarios** (si tiene permiso): gestión de usuarios.

La barra de navegación lateral le lleva a cada sección.

---

## 5. Si la API no responde

- **Mensaje tipo “Failed to fetch” o “No se pudo conectar”:**
  - Compruebe que el **servidor backend** esté en ejecución (si trabaja en local, que haya ejecutado `npm run dev` o `npm run start:local` desde la raíz del proyecto).
  - Si usa una URL remota, compruebe que la dirección en **Configuración inicial** sea correcta y que el servidor esté accesible (red, firewall, etc.).
- **Primera vez / cambio de equipo:**  
  Si cambia de equipo o borra la configuración del navegador, deberá pasar de nuevo por la **Configuración inicial** (`/setup`) e indicar de nuevo la URL del API (y el código de activación si aplica).

---

## Resumen rápido

| Qué quiere hacer        | Dónde / qué hacer |
|-------------------------|-------------------|
| Abrir web (desarrollo)  | Raíz del proyecto → `npm run dev` → navegador en http://localhost:3000 |
| Abrir web (local “prod”)| Raíz → `npm run build` y luego `npm run start:local`, o ejecutar `scripts\start-local.bat` |
| Abrir escritorio (dev)  | Raíz → `npm run dev:desktop` (con API y web ya en marcha, o ese comando los inicia) |
| Abrir escritorio (exe)  | Ejecutar el `.exe` en `apps\desktop\dist\win-unpacked\` |
| Primera configuración   | La app redirige a `/setup`; indique URL del API y, si tiene, código de activación |
| Iniciar sesión          | Correo y contraseña en la pantalla de login |

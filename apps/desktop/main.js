const { app, BrowserWindow, ipcMain, dialog, session, Menu, MenuItem } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { spawn, spawnSync } = require("child_process");
const http = require("http");
const licenseState = require("./license/state");
const { getLicenseHmacDiagnosticSnapshot } = require("./license/secret");
const clockAnchor = require("./license/clock-anchor");
const installation = require("./installation");
const spellSettings = require("./spell-settings");

const DEV_URL = "http://localhost:3000";
const PROD_PORT = 31337;
const EMBEDDED_API_PORT = 4000;
/** Nombre comercial (títulos de ventana, diálogos). */
const PRODUCT_DISPLAY_NAME = "DELTA SPACE";
/** Portables antiguos (Windows). No renombrar carpetas de distribución en scripts: solo compatibilidad aquí. */
const LEGACY_WIN_EXE = "Cotizaciones PFV Avanzada.exe";
const NEW_WIN_EXE = "DELTA SPACE.exe";

function findWinPortableExe(root) {
  for (const n of [NEW_WIN_EXE, LEGACY_WIN_EXE]) {
    const p = path.join(root, n);
    if (fs.existsSync(p)) return p;
  }
  return null;
}
/** Debe coincidir con build.appId en package.json (paquetes offline / validación). */
const APP_ID_DESKTOP = "cl.pvquoting.desktop";
/** Nest embebido: en discos lentos / AV el primer arranque supera fácilmente 25–30 s. */
const HEALTH_CHECK_TIMEOUT_MS = 60000;
/** Next standalone en :31337: primera carga y JIT pueden tardar mucho más que 30 s. */
const NEXT_SERVER_WAIT_TIMEOUT_MS = 90000;
/** Por petición HTTP al comprobar puertos (evita colgarse si el socket abre pero no hay respuesta). */
const HTTP_PROBE_REQUEST_MS = 8000;
/** Licencia temporal vía servicio emisor (HTTPS). Ver docs/producto/LICENCIA_DESARROLLADOR_ISSUER.md */
const MAX_DEV_LICENSE_DAYS = 30;
const MIN_DEV_LICENSE_DAYS = 1;
const DEV_LICENSE_ISSUER_PATH = "/v1/desktop-developer-license";
const DEV_LICENSE_FETCH_TIMEOUT_MS = 25000;

/**
 * URL base del emisor (sin barra final). Si no se define env y el build incluye API embebida,
 * por defecto apunta al backend local (misma máquina) para Acceso desarrollador sin configurar nada.
 * Anular: DESKTOP_DEV_LICENSE_DISABLE_EMBEDDED_DEFAULT=1 o fijar DESKTOP_DEV_LICENSE_ISSUER_URL explícita.
 */
function getDeveloperIssuerBaseUrl() {
  const trimmed = (process.env.DESKTOP_DEV_LICENSE_ISSUER_URL || "").trim().replace(/\/$/, "");
  if (trimmed) return trimmed;
  if (process.env.DESKTOP_DEV_LICENSE_DISABLE_EMBEDDED_DEFAULT === "1") {
    return "";
  }
  // Sin empaquetar: mismo default que portable (Nest en :4000 con prefijo /api). Ver ACCESO_DESARROLLADOR_USO.md.
  if (!isPackaged()) {
    return `http://127.0.0.1:${EMBEDDED_API_PORT}/api`;
  }
  try {
    const backendDir = getEmbeddedBackendDir();
    if (fs.existsSync(path.join(backendDir, "dist", "main.js"))) {
      return `http://127.0.0.1:${EMBEDDED_API_PORT}/api`;
    }
  } catch (_) {
    /* no-op */
  }
  return "";
}

function isPackaged() {
  return app.isPackaged;
}

function getStandaloneDir() {
  return path.join(process.resourcesPath, "standalone");
}

function getPackagedNodePath() {
  const base = path.join(process.resourcesPath, "node");
  if (process.platform === "win32") {
    return path.join(base, "node.exe");
  }
  return path.join(base, "bin", "node");
}

function waitForServer(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryConnect = () => {
      const req = http.get(
        `http://127.0.0.1:${port}`,
        { timeout: HTTP_PROBE_REQUEST_MS },
        (res) => {
          res.resume();
          resolve();
        },
      );
      req.on("timeout", () => {
        try {
          req.destroy();
        } catch (_) {}
        if (Date.now() > deadline) {
          reject(new Error(`Timeout waiting for server on port ${port} (probe)`));
          return;
        }
        setTimeout(tryConnect, 120);
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timeout waiting for server on port ${port}`));
          return;
        }
        setTimeout(tryConnect, 120);
      });
    };
    tryConnect();
  });
}

let serverProcess = null;
let backendProcess = null;
/** Proceso sidecar libp2p (LAN). */
let p2pProcess = null;
/** Ventana de splash durante el arranque (antes de la ventana principal). */
let splashWindow = null;
let backendLogStream = null;
let desktopLogWritten = false;

function getStartupLogPath() {
  const userData = app.getPath("userData");
  const logDir = path.join(userData, "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, "startup.log");
}

/**
 * Traza de arranque con marca de tiempo (diagnóstico de cierres tras splash).
 * También escribe en consola cuando existe (empaquetado: ver consola del proceso).
 */
function logStartup(phase, detail) {
  const ts = new Date().toISOString();
  const msg = detail != null && detail !== "" ? `${phase} | ${detail}` : phase;
  const line = `[${ts}] ${msg}\n`;
  try {
    fs.appendFileSync(getStartupLogPath(), line, "utf8");
  } catch (_) {
    /* no-op */
  }
  try {
    fs.appendFileSync(getDesktopLogPath(), `[STARTUP] ${line}`, "utf8");
  } catch (_) {
    /* no-op */
  }
  console.log("[STARTUP]", msg);
}

function getDesktopLogPath() {
  const userData = app.getPath("userData");
  const logDir = path.join(userData, "logs");
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  return path.join(logDir, "backend.log");
}

function getBackendLogPath() {
  return getDesktopLogPath();
}

function getBackendLogStream() {
  if (backendLogStream) return backendLogStream;
  const logPath = getBackendLogPath();
  backendLogStream = fs.createWriteStream(logPath, { flags: "a", encoding: "utf8" });
  return backendLogStream;
}

function logToBackendFile(prefix, chunk) {
  try {
    const stream = getBackendLogStream();
    stream.write(prefix + chunk.toString());
  } catch (_) {
    // no-op: si el FS no permite escribir, al menos mantenemos logs a consola
  }
}

function writeGuaranteedDesktopStartupLog() {
  if (desktopLogWritten) return;
  desktopLogWritten = true;
  try {
    const userData = app.getPath("userData");
    const appName = app.getName();
    const appPath = app.getAppPath();
    const resourcesPath = process.resourcesPath;
    const execPath = process.execPath;
    const line =
      `[DESKTOP] app started name=${appName} execPath=${execPath} userData=${userData} ` +
      `appPath=${appPath} resourcesPath=${resourcesPath}\n`;

    // Garantiza existencia del directorio de logs
    const logPath = getDesktopLogPath();
    fs.writeFileSync(logPath, line, { encoding: "utf8", flag: "a" });
    console.log(line.trim());
  } catch (err) {
    // Si falla, no rompemos ejecución: al menos queda en consola
    console.error("[DESKTOP] Failed to write initial backend.log:", err);
  }
}

function getEmbeddedBackendDir() {
  return path.join(process.resourcesPath, "backend");
}

/** Ver license/secret.js: HMAC empaquetado desde resources/backend/env.embedded o .env */

function getDatabasePath() {
  const userData = app.getPath("userData");
  if (!fs.existsSync(userData)) fs.mkdirSync(userData, { recursive: true });
  return path.join(userData, "database.sqlite");
}

/**
 * DATABASE_URL para Prisma SQLite (desktop portable).
 *
 * NO usar pathToFileURL(): produce `file:///C:/...` con espacios como %20; el schema engine
 * de Prisma + SQLite en Windows suele fallar con "Failed to open SQLite database" / os error 161
 * (ERROR_BAD_PATHNAME). Prisma documenta `file:` + ruta absoluta con barras normales.
 *
 * @see apps/api/prisma/clean-full-reset.ts (mismo patrón: file:${abs.replace(/\\/g, '/')})
 */
function prismaSqliteDatabaseUrl(dbPath) {
  const resolved = path.resolve(dbPath);
  const dir = path.dirname(resolved);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const normalized = resolved.replace(/\\/g, "/");
  return `file:${normalized}`;
}

/** Log legible: misma ruta que Prisma usará, sin ocultar espacios (debug portable). */
function describeSqliteRuntime(dbPath, databaseUrl) {
  const userData = app.getPath("userData");
  return {
    userDataDir: userData,
    sqliteFileAbsolute: path.resolve(dbPath),
    databaseUrlForPrisma: databaseUrl,
  };
}

function appendBackendSetupLog(line) {
  try {
    fs.appendFileSync(getDesktopLogPath(), line, "utf8");
  } catch (_) {
    /* no-op */
  }
}

function runEmbeddedMigrations(dbPath) {
  const backendDir = getEmbeddedBackendDir();
  const prismaCli = path.join(backendDir, "node_modules", "prisma", "build", "index.js");
  if (!fs.existsSync(prismaCli)) {
    throw new Error(`[embedded-backend] Prisma CLI no encontrado: ${prismaCli}`);
  }
  const databaseUrl = prismaSqliteDatabaseUrl(dbPath);
  const meta = describeSqliteRuntime(dbPath, databaseUrl);
  const preLog =
    `[embedded-backend] Antes de migrate deploy — SQLite runtime:\n` +
    `  userData (carpeta de datos): ${meta.userDataDir}\n` +
    `  archivo .sqlite esperado: ${meta.sqliteFileAbsolute}\n` +
    `  DATABASE_URL (Prisma): ${meta.databaseUrlForPrisma}\n`;
  console.log(preLog);
  appendBackendSetupLog(preLog);

  const nodePath = getPackagedNodePath();
  const binPath = path.join(backendDir, "node_modules", ".bin");
  const result = spawnSync(nodePath, [prismaCli, "migrate", "deploy"], {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      // Necesario para que el CLI de Prisma pueda resolver comandos como `ts-node`
      PATH: binPath + path.delimiter + (process.env.PATH || ""),
    },
    stdio: "pipe",
    encoding: "utf8",
  });
  const out = (result.stderr || result.stdout || "").trim();
  if (result.status !== 0) {
    const msg =
      `[embedded-backend] migrate deploy falló (code=${result.status})\n` +
      `--- Contexto SQLite (revisar si la ruta es válida en este PC) ---\n` +
      `userData (carpeta de datos): ${meta.userDataDir}\n` +
      `archivo SQLite esperado: ${meta.sqliteFileAbsolute}\n` +
      `DATABASE_URL usada: ${meta.databaseUrlForPrisma}\n` +
      `--- Salida Prisma ---\n` +
      `${out}\n`;
    console.error(msg);
    appendBackendSetupLog(msg);
    throw new Error(
      "prisma migrate deploy falló en el portable. Revise userData/logs/backend.log — " +
        "incluye userData, ruta del .sqlite y DATABASE_URL usada.",
    );
  }
  if (out) {
    appendBackendSetupLog(`[embedded-backend] migrate deploy OK\n${out}\n`);
  }
}

function runEmbeddedDbPush(dbPath) {
  const backendDir = getEmbeddedBackendDir();
  const prismaCli = path.join(backendDir, "node_modules", "prisma", "build", "index.js");
  if (!fs.existsSync(prismaCli)) {
    throw new Error(`[embedded-backend] Prisma CLI no encontrado: ${prismaCli}`);
  }
  const databaseUrl = prismaSqliteDatabaseUrl(dbPath);
  const meta = describeSqliteRuntime(dbPath, databaseUrl);
  const nodePath = getPackagedNodePath();
  const binPath = path.join(backendDir, "node_modules", ".bin");
  const result = spawnSync(nodePath, [prismaCli, "db", "push"], {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PATH: binPath + path.delimiter + (process.env.PATH || ""),
    },
    stdio: "pipe",
    encoding: "utf8",
  });
  const out = (result.stderr || result.stdout || "").trim();
  if (result.status !== 0) {
    const msg =
      `[embedded-backend] db push falló (code=${result.status})\n` +
      `userData (carpeta de datos): ${meta.userDataDir}\n` +
      `archivo SQLite esperado: ${meta.sqliteFileAbsolute}\n` +
      `DATABASE_URL usada: ${meta.databaseUrlForPrisma}\n` +
      `--- Salida Prisma ---\n` +
      `${out}\n`;
    console.error(msg);
    appendBackendSetupLog(msg);
    throw new Error(
      "prisma db push falló en el portable. Revise userData/logs/backend.log para diagnóstico.",
    );
  }
  if (out) {
    appendBackendSetupLog(`[embedded-backend] db push OK\n${out}\n`);
  }
}

function runEmbeddedSeed(dbPath) {
  const backendDir = getEmbeddedBackendDir();
  const prismaCli = path.join(backendDir, "node_modules", "prisma", "build", "index.js");
  if (!fs.existsSync(prismaCli)) {
    throw new Error(`[embedded-backend] Prisma CLI no encontrado: ${prismaCli}`);
  }
  const databaseUrl = prismaSqliteDatabaseUrl(dbPath);
  const meta = describeSqliteRuntime(dbPath, databaseUrl);
  const nodePath = getPackagedNodePath();
  const binPath = path.join(backendDir, "node_modules", ".bin");
  const result = spawnSync(nodePath, [prismaCli, "db", "seed"], {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      /** Solo categorías maestras + roles/admin/códigos; sin productos/proveedores/plantillas demo. */
      EMBEDDED_PORTABLE_MINIMAL_SEED: "1",
      // Necesario para que el seed use `ts-node` definido en package.json
      PATH: binPath + path.delimiter + (process.env.PATH || ""),
    },
    stdio: "pipe",
    encoding: "utf8",
    timeout: 120000,
  });
  const out = (result.stderr || result.stdout || "").trim();
  if (result.status !== 0) {
    const msg =
      `[embedded-backend] seed falló (code=${result.status})\n` +
      `userData: ${meta.userDataDir}\n` +
      `archivo SQLite: ${meta.sqliteFileAbsolute}\n` +
      `DATABASE_URL: ${meta.databaseUrlForPrisma}\n` +
      `${out}\n`;
    console.error(msg);
    appendBackendSetupLog(msg);
    throw new Error("prisma db seed falló en el portable; revise logs en userData/logs.");
  }
  if (out) {
    appendBackendSetupLog(`[embedded-backend] seed OK\n${out}\n`);
  }
}

function validateEmbeddedBackendArtifacts() {
  const backendDir = getEmbeddedBackendDir();
  const required = [
    { path: path.join(backendDir, "dist", "main.js"), label: "dist/main.js" },
    { path: path.join(backendDir, "node_modules"), label: "node_modules" },
    { path: path.join(backendDir, "prisma"), label: "prisma" },
  ];
  const missing = required.filter((item) => !fs.existsSync(item.path));
  const hasDotEnv = fs.existsSync(path.join(backendDir, ".env"));
  const hasEmbeddedEnv = fs.existsSync(path.join(backendDir, "env.embedded"));
  if (!hasDotEnv && !hasEmbeddedEnv) {
    missing.push({
      path: `${path.join(backendDir, ".env")} | ${path.join(backendDir, "env.embedded")}`,
      label: ".env/env.embedded",
    });
  }
  if (missing.length > 0) {
    const details = missing.map((item) => `${item.label}: ${item.path}`).join("\n");
    const msg = `[embedded-backend] Faltan artefactos requeridos en resources/backend:\n${details}\n`;
    appendBackendSetupLog(msg);
    throw new Error(msg);
  }
}

function waitForHealth(port, timeoutMs) {
  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryConnect = () => {
      const req = http.get(
        healthUrl,
        { timeout: HTTP_PROBE_REQUEST_MS },
        (res) => {
          res.resume();
          let data = "";
          res.on("data", (chunk) => { data += chunk; });
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json && json.ok) {
                resolve();
                return;
              }
            } catch (_) {}
            if (Date.now() > deadline) {
              reject(new Error("Health check failed (no ok in body)"));
              return;
            }
            setTimeout(tryConnect, 300);
          });
        },
      );
      req.on("timeout", () => {
        try {
          req.destroy();
        } catch (_) {}
        if (Date.now() > deadline) {
          reject(new Error("Timeout waiting for backend health (probe)"));
          return;
        }
        setTimeout(tryConnect, 300);
      });
      req.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error("Timeout waiting for backend health"));
          return;
        }
        setTimeout(tryConnect, 300);
      });
    };
    tryConnect();
  });
}

function startEmbeddedBackend(dbPath) {
  const backendDir = getEmbeddedBackendDir();
  const mainJs = path.join(backendDir, "dist", "main.js");
  const nodePath = getPackagedNodePath();
  if (!fs.existsSync(mainJs) || !fs.existsSync(nodePath)) {
    throw new Error("Backend embebido no encontrado");
  }
  const databaseUrl = prismaSqliteDatabaseUrl(dbPath);
  // Quitar LICENSE_HMAC_SECRET heredado: @nestjs/config/dotenv NO sobrescribe variables ya definidas;
  // si Windows dejó una distinta, Nest firmaría distinto que Electron (que lee solo el .env embebido).
  const childEnv = { ...process.env };
  delete childEnv.LICENSE_HMAC_SECRET;
  const env = {
    ...childEnv,
    PORT: String(EMBEDDED_API_PORT),
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    EMBEDDED_PACKAGED_DESKTOP: isPackaged() ? "1" : "0",
  };

  // Presencia LAN: si el build no trae LAN_MESH_SECRET (plantilla), derivarlo de LICENSE_HMAC_SECRET
  // para que *todas* las copias de ese mismo build compartan el mismo secreto y la malla funcione
  // en PCs distintas (LAN real).
  // Nota: no rompe setups donde el env ya fue configurado explícitamente.
  try {
    const lanKeyPresent =
      typeof env.LAN_MESH_SECRET === "string" && env.LAN_MESH_SECRET.trim().length >= 8;
    if (!lanKeyPresent) {
      const embeddedEnvPath = path.join(backendDir, "env.embedded");
      const dotEnvPath = path.join(backendDir, ".env");
      const readEnvVal = (p) => {
        try {
          if (!fs.existsSync(p)) return null;
          const raw = fs.readFileSync(p, "utf8");
          const re = new RegExp(
            `^\\s*LICENSE_HMAC_SECRET\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s#]+))\\s*$`,
            "m",
          );
          const m = raw.match(re);
          if (!m) return null;
          const v = (m[2] ?? m[3] ?? m[4] ?? "").trim();
          return v || null;
        } catch (_) {
          return null;
        }
      };
      const licenseHmac = readEnvVal(dotEnvPath) || readEnvVal(embeddedEnvPath);
      if (licenseHmac && licenseHmac.length >= 8) {
        env.LAN_MESH_SECRET = licenseHmac.slice(0, 32);
        appendBackendSetupLog(`[embedded-backend] LAN_MESH_SECRET derivado de LICENSE_HMAC_SECRET (len=${env.LAN_MESH_SECRET.length})\n`);
      }
    }
  } catch (_) {
    // no-op: si falla el parsing, el backend seguirá arrancando (aunque la presencia LAN remota no funcione).
  }
  backendProcess = spawn(nodePath, [path.relative(backendDir, mainJs)], {
    cwd: backendDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Trazabilidad persistente para integraciones externas (Mindicador/PVWATTS/etc).
  // Queda en: app.getPath('userData')/logs/backend.log
  getBackendLogStream();
  backendProcess.stdout?.on("data", (chunk) => {
    process.stdout.write("[api] " + chunk.toString());
    logToBackendFile("[api] ", chunk);
  });
  backendProcess.stderr?.on("data", (chunk) => {
    process.stderr.write("[api] " + chunk.toString());
    logToBackendFile("[api] ", chunk);
  });
  backendProcess.on("error", (err) => {
    console.error("Error al iniciar backend embebido:", err);
  });
  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error("Backend embebido finalizó con código", code);
    }
  });
}

function killP2pDaemon() {
  if (p2pProcess) {
    try {
      p2pProcess.kill();
    } catch (_) {}
    p2pProcess = null;
  }
}

function waitForTcpPort(port, host, timeoutMs) {
  const net = require("net");
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryConnect = () => {
      const s = net.createConnection({ port, host }, () => {
        s.end();
        resolve();
      });
      s.on("error", () => {
        if (Date.now() > deadline) {
          reject(new Error(`Timeout esperando puerto ${port}`));
          return;
        }
        setTimeout(tryConnect, 120);
      });
    };
    tryConnect();
  });
}

async function canReuseEmbeddedBackendOnPort(port) {
  try {
    await waitForTcpPort(port, "127.0.0.1", 1500);
  } catch (_) {
    return false;
  }
  try {
    await waitForHealth(port, 2500);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Arranca `lan-p2p` antes del backend Nest para que P2P_CONTROL_ADDR esté disponible.
 * Binario empaquetado: resources/lan-p2p/lan-p2p.exe (copiar desde build release).
 */
function startLanP2pDaemon(userData, installationId, ingressSecret) {
  const p2pData = path.join(userData, "p2p");
  if (!fs.existsSync(p2pData)) fs.mkdirSync(p2pData, { recursive: true });
  let bin;
  if (isPackaged()) {
    bin = path.join(
      process.resourcesPath,
      "lan-p2p",
      process.platform === "win32" ? "lan-p2p.exe" : "lan-p2p",
    );
  } else {
    bin = path.join(__dirname, "..", "lan-p2p", "target", "release", "lan-p2p.exe");
    if (!fs.existsSync(bin)) {
      bin = path.join(__dirname, "..", "lan-p2p", "target", "release", "lan-p2p");
    }
  }
  if (!fs.existsSync(bin)) {
    console.warn("[p2p] No se encontró el binario lan-p2p; chat P2P desactivado. Esperado en:", bin);
    return;
  }
  const secret = (ingressSecret && String(ingressSecret).trim().length >= 8
    ? String(ingressSecret).trim().slice(0, 32)
    : "");
  const env = {
    ...process.env,
    P2P_DATA_DIR: p2pData,
    PVQ_INSTALLATION_ID: installationId,
    P2P_CONTROL_BIND: "127.0.0.1:40777",
    P2P_NEST_INGRESS_URL: `http://127.0.0.1:${EMBEDDED_API_PORT}`,
    P2P_INGRESS_SECRET: secret || process.env.P2P_INGRESS_SECRET || "",
    P2P_DISPLAY_NAME: os.hostname(),
  };
  try {
    p2pProcess = spawn(bin, [], { env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    p2pProcess.stdout?.on("data", (c) => process.stdout.write("[p2p] " + c.toString()));
    p2pProcess.stderr?.on("data", (c) => process.stderr.write("[p2p] " + c.toString()));
    p2pProcess.on("error", (err) => console.error("[p2p] spawn error:", err));
    appendBackendSetupLog(`[p2p] lan-p2p iniciado installationId=${installationId}\n`);
  } catch (e) {
    console.warn("[p2p] no se pudo iniciar:", e);
  }
}

function killBackend() {
  killP2pDaemon();
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  if (backendLogStream) {
    try {
      backendLogStream.end();
    } catch (_) {}
    backendLogStream = null;
  }
}

function getPreloadPath() {
  return path.join(__dirname, "preload.js");
}

function setSplashPhase(text) {
  if (typeof text === "string" && text.trim()) {
    logStartup("splash", text.trim());
  }
  if (!splashWindow || splashWindow.isDestroyed()) return;
  try {
    const wc = splashWindow.webContents;
    if (!wc || wc.isDestroyed()) return;
    wc.send("splash:phase", text);
  } catch (_) {
    /* no-op */
  }
}

function destroySplash() {
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = null;
    return;
  }
  try {
    splashWindow.close();
  } catch (_) {
    /* no-op */
  }
  splashWindow = null;
}

function createSplashWindow() {
  if (splashWindow && !splashWindow.isDestroyed()) return;
  splashWindow = new BrowserWindow({
    width: 420,
    height: 220,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: false,
    center: true,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
    },
  });
  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.on("closed", () => {
    splashWindow = null;
  });
}

function shouldSkipLicenseCheck() {
  return process.env.ELECTRON_SKIP_LICENSE === "1";
}

/**
 * Solo empaquetado: licencia obligatoria (archivo) guardada en userData.
 * No se crea trial automático: sin `runtime-v1.json` válido → pantalla de licencia.
 * Estados `trial` antiguos siguen validando hasta vencer (compatibilidad con instalaciones previas).
 */
function getPackagedLicenseValidation() {
  if (!isPackaged() || shouldSkipLicenseCheck()) {
    return { ok: true };
  }
  const userData = app.getPath("userData");
  const record = licenseState.loadState(userData);
  if (!record) {
    return { ok: false, reason: "no_license" };
  }
  const clock = clockAnchor.checkClockNotRewound(userData);
  if (!clock.ok) {
    return { ok: false, reason: clock.reason, detail: clock.detail };
  }
  const inst = installation.getOrCreateInstallationRecord(userData);
  const v = licenseState.validateStoredState(record, {
    installationId: inst.installationId,
    nowMs: Date.now(),
  });
  if (v.ok) {
    clockAnchor.touchAnchor(userData);
  }
  return v;
}

function getAppVersionSync() {
  if (app.isPackaged) {
    const vPath = path.join(process.resourcesPath, "version.txt");
    if (fs.existsSync(vPath)) {
      return fs.readFileSync(vPath, "utf8").trim();
    }
  }
  try {
    const pkgPath = path.join(__dirname, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      return pkg.version || "0.0.0";
    }
  } catch (_) {}
  return "0.0.0";
}

function compareSemVer(a, b) {
  const parts = (v) =>
    String(v || "0")
      .split(".")
      .map((x) => parseInt(String(x).replace(/\D/g, ""), 10) || 0);
  const pa = parts(a);
  const pb = parts(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function safeInstallerBasename(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  const base = path.basename(t);
  if (base !== t || t.includes("..")) return null;
  if (!/\.exe$/i.test(base)) return null;
  return base;
}

function verifyInstallerSha256(installerPath, expectedHex) {
  if (!expectedHex || !String(expectedHex).trim()) return { ok: true };
  const buf = fs.readFileSync(installerPath);
  const h = crypto.createHash("sha256").update(buf).digest("hex");
  const want = String(expectedHex).trim().toLowerCase();
  if (h.toLowerCase() !== want) {
    return { ok: false, error: "El instalador no coincide con el hash esperado (manifest o checksum.sha256)." };
  }
  return { ok: true };
}

function verifyChecksumSha256File(root, installerPath, basename) {
  const p = path.join(root, "checksum.sha256");
  if (!fs.existsSync(p)) return { ok: true };
  const raw = fs.readFileSync(p, "utf8").trim();
  const firstLine = raw.split(/\r?\n/)[0] || "";
  const m = firstLine.match(/^([a-fA-F0-9]{64})\s+\*?\s*(.*)$/i);
  if (m) {
    const namePart = (m[2] || "").trim();
    if (namePart && namePart !== basename) {
      return { ok: false, error: `checksum.sha256 no corresponde al instalador (${namePart}).` };
    }
    return verifyInstallerSha256(installerPath, m[1]);
  }
  const hexOnly = firstLine.match(/^([a-fA-F0-9]{64})$/i);
  if (hexOnly) return verifyInstallerSha256(installerPath, hexOnly[1]);
  return { ok: false, error: "checksum.sha256 tiene un formato no reconocido." };
}

/**
 * Paquete offline: carpeta con manifest.json + instalador NSIS.
 * @returns {object|null} null si no hay manifest (usar flujo portable legado).
 */
function validateOfflineUpdatePackage(root, currentVersion) {
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath) || !fs.statSync(manifestPath).isFile()) {
    return null;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (_e) {
    return { valid: false, error: "manifest.json no es JSON válido." };
  }
  if (!manifest || typeof manifest !== "object") {
    return { valid: false, error: "Manifest inválido." };
  }
  if (manifest.schemaVersion !== 1) {
    return { valid: false, error: `schemaVersion no soportada: ${manifest.schemaVersion ?? "(ausente)"}` };
  }
  if (manifest.appId !== APP_ID_DESKTOP) {
    return { valid: false, error: "El paquete no corresponde a esta aplicación (appId distinto)." };
  }
  if (!manifest.version || typeof manifest.version !== "string") {
    return { valid: false, error: "Falta version en el manifest." };
  }
  const newVersion = manifest.version.trim();
  const safeName = safeInstallerBasename(manifest.installerFile);
  if (!safeName) {
    return {
      valid: false,
      error: "installerFile inválido (use solo el nombre del .exe, sin carpetas ni ..).",
    };
  }
  const installerPath = path.join(root, safeName);
  if (!fs.existsSync(installerPath) || !fs.statSync(installerPath).isFile()) {
    return { valid: false, error: `No se encuentra el instalador en el paquete: ${safeName}` };
  }
  const minV =
    manifest.minInstalledVersion != null && String(manifest.minInstalledVersion).trim() !== ""
      ? String(manifest.minInstalledVersion).trim()
      : "0.0.0";
  if (compareSemVer(currentVersion, minV) < 0) {
    return {
      valid: false,
      error: `La versión instalada (${currentVersion}) es menor que la mínima exigida por el paquete (${minV}).`,
    };
  }
  if (compareSemVer(newVersion, currentVersion) <= 0) {
    return {
      valid: false,
      error: `La versión del paquete (${newVersion}) debe ser mayor que la instalada (${currentVersion}).`,
    };
  }
  const h1 = verifyInstallerSha256(installerPath, manifest.installerSha256 || "");
  if (!h1.ok) return { valid: false, error: h1.error };
  const h2 = verifyChecksumSha256File(root, installerPath, safeName);
  if (!h2.ok) return { valid: false, error: h2.error };

  const installerBuf = fs.readFileSync(installerPath);
  const installerSha256Computed = crypto.createHash("sha256").update(installerBuf).digest("hex");

  let releaseNotes = null;
  const nf = manifest.notesFile && String(manifest.notesFile).trim();
  if (nf) {
    const nb = path.basename(nf);
    if (nb === nf) {
      const np = path.join(root, nb);
      if (fs.existsSync(np) && fs.statSync(np).isFile()) {
        try {
          releaseNotes = fs.readFileSync(np, "utf8").slice(0, 8000);
        } catch (_e) {
          /* no-op */
        }
      }
    }
  }

  return {
    valid: true,
    currentVersion,
    newVersion,
    updateMode: "installer",
    releaseNotes,
    installerFileName: safeName,
    installerSha256: installerSha256Computed,
  };
}

function applySpellcheckerFromDisk() {
  const cfg = spellSettings.readSpellSettings(app.getPath("userData"));
  try {
    session.defaultSession.setSpellCheckerEnabled(cfg.enabled !== false);
    if (cfg.enabled !== false && Array.isArray(cfg.languages) && cfg.languages.length) {
      session.defaultSession.setSpellCheckerLanguages(cfg.languages);
    }
  } catch (e) {
    console.warn("[DESKTOP] spellchecker:", e);
  }
}

/**
 * Menú contextual con sugerencias (Electron/Chromium). Solo si hay palabra marcada como error.
 * "Ignorar" no tiene API estable multiplataforma; el usuario puede usar "Agregar al diccionario" para términos válidos recurrentes.
 */
function attachSpellcheckContextMenu(webContents) {
  webContents.on("context-menu", (event, params) => {
    const cfg = spellSettings.readSpellSettings(app.getPath("userData"));
    if (cfg.enabled === false) return;

    const { misspelledWord, dictionarySuggestions, isEditable } = params;
    if (!isEditable || !misspelledWord) return;
    if (cfg.showRightClickSuggestions === false) return;

    event.preventDefault();
    const menu = new Menu();
    const suggestions = dictionarySuggestions || [];
    if (suggestions.length === 0) {
      menu.append(new MenuItem({ label: "Sin sugerencias", enabled: false }));
    } else {
      for (const s of suggestions.slice(0, 10)) {
        menu.append(
          new MenuItem({
            label: s,
            click: () => webContents.replaceMisspelling(s),
          }),
        );
      }
    }
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(
      new MenuItem({
        label: "Agregar al diccionario",
        click: () => {
          try {
            webContents.session.addWordToSpellCheckerDictionary(misspelledWord);
          } catch (_e) {
            /* no-op */
          }
        },
      }),
    );
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(new MenuItem({ role: "cut" }));
    menu.append(new MenuItem({ role: "copy" }));
    menu.append(new MenuItem({ role: "paste" }));
    menu.append(new MenuItem({ type: "separator" }));
    menu.append(new MenuItem({ role: "selectAll" }));
    const win = BrowserWindow.fromWebContents(webContents);
    menu.popup({ window: win || undefined });
  });
}

function createWindow(url) {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
      spellcheck: true,
    },
    title: PRODUCT_DISPLAY_NAME,
    show: false,
  });

  let shown = false;
  const tryShowMainWindow = () => {
    if (shown || win.isDestroyed()) return;
    shown = true;
    destroySplash();
    win.show();
  };

  /**
   * Antes solo se hacía show() en did-finish-load. En algunos casos (Next/redirects/carga larga)
   * el evento puede tardar mucho o no dispararse como se espera y la ventana queda invisible:
   * la app "arranca" pero el usuario no ve login. Usar ready-to-show + respaldo por tiempo.
   */
  const fallbackShowTimer = setTimeout(() => {
    if (win.isDestroyed() || win.isVisible()) return;
    try {
      fs.appendFileSync(
        getDesktopLogPath(),
        `[DESKTOP] WARN: mostrando ventana por timeout (10s) url=${url} — si sigue en blanco, revisar Next en ${PROD_PORT}\n`,
        "utf8",
      );
    } catch (_) {}
    console.warn("[DESKTOP] Ventana principal: show forzado tras timeout — revisar carga de", url);
    tryShowMainWindow();
  }, 10000);

  win.once("ready-to-show", () => {
    clearTimeout(fallbackShowTimer);
    tryShowMainWindow();
  });

  attachSpellcheckContextMenu(win.webContents);

  win.loadURL(url);

  win.webContents.on("did-finish-load", () => {
    clearTimeout(fallbackShowTimer);
    tryShowMainWindow();
  });

  win.webContents.on("did-fail-load", (_event, code, description, validatedURL, isMainFrame) => {
    if (code === -6) return;
    if (code === -3 && isMainFrame === false) return;
    const line = `[DESKTOP] did-fail-load code=${code} ${description || ""} mainFrame=${isMainFrame} url=${validatedURL || url}\n`;
    try {
      fs.appendFileSync(getDesktopLogPath(), line, "utf8");
    } catch (_) {}
    console.error("Load failed:", code, description, validatedURL);
  });

  if (process.env.ELECTRON_DEVTOOLS === "1") {
    win.webContents.openDevTools();
  }

  win.on("focus", () => {
    try {
      if (!win.isDestroyed() && (process.platform === "win32" || process.platform === "darwin")) {
        win.flashFrame(false);
      }
    } catch (_) {
      /* no-op */
    }
  });

  win.on("closed", () => {
    clearTimeout(fallbackShowTimer);
    app.quit();
  });
}

/** Ventana de bloqueo: no arranca Next ni API; solo carga HTML local + preload. */
function createLicenseBlockedWindow() {
  destroySplash();
  const win = new BrowserWindow({
    width: 520,
    height: 520,
    minWidth: 400,
    minHeight: 400,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: getPreloadPath(),
      spellcheck: true,
    },
    title: `${PRODUCT_DISPLAY_NAME} — Licencia`,
  });
  attachSpellcheckContextMenu(win.webContents);
  win.loadFile(path.join(__dirname, "license-blocked.html"));
  win.once("ready-to-show", () => {
    win.show();
  });
  win.on("closed", () => {
    app.quit();
  });
}

function killServer() {
  destroySplash();
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  killBackend();
}

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dst, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
}

function registerDesktopIpc() {
  ipcMain.handle("desktop:setChatAttentionFlash", (event, enabled) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return;
      if (process.platform === "win32" || process.platform === "darwin") {
        win.flashFrame(enabled === true);
      }
    } catch (_) {
      /* no-op */
    }
  });

  ipcMain.handle("desktop:getAppVersion", () => Promise.resolve(getAppVersionSync()));

  ipcMain.handle("desktop:print", async (event) => {
    try {
      const sender = event && event.sender ? event.sender : null;
      const win = sender ? BrowserWindow.fromWebContents(sender) : BrowserWindow.getFocusedWindow();
      const wc = win && win.webContents ? win.webContents : null;
      if (!wc) {
        return { ok: false, message: "No se encontró una ventana activa para imprimir." };
      }
      const printed = await new Promise((resolve) => {
        wc.print(
          {
            silent: false,
            printBackground: true,
          },
          (success, failureReason) => {
            if (!success) {
              resolve({
                ok: false,
                message: failureReason || "No se pudo iniciar la impresión.",
              });
              return;
            }
            resolve({ ok: true });
          },
        );
      });
      return printed;
    } catch (e) {
      return { ok: false, message: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle("desktop:exportPdf", async (event, args) => {
    try {
      const sender = event && event.sender ? event.sender : null;
      const win = sender ? BrowserWindow.fromWebContents(sender) : BrowserWindow.getFocusedWindow();
      const wc = win && win.webContents ? win.webContents : null;
      if (!wc) {
        return { ok: false, message: "No se encontró una ventana activa para exportar PDF." };
      }
      const defaultName =
        args && typeof args.defaultFilename === "string" && args.defaultFilename.trim()
          ? args.defaultFilename.trim()
          : "cotizacion.pdf";
      const targetWin = win || BrowserWindow.getFocusedWindow();
      const save = await dialog.showSaveDialog(targetWin || undefined, {
        title: "Guardar PDF",
        defaultPath: defaultName.toLowerCase().endsWith(".pdf") ? defaultName : `${defaultName}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (save.canceled || !save.filePath) {
        return { ok: false, canceled: true };
      }
      const pdfBuffer = await wc.printToPDF({
        printBackground: true,
        pageSize: "A4",
      });
      fs.writeFileSync(save.filePath, pdfBuffer);
      return { ok: true, filePath: save.filePath };
    } catch (e) {
      return { ok: false, message: String(e && e.message ? e.message : e) };
    }
  });

  ipcMain.handle("desktop:getInstallationId", () => {
    const userData = app.getPath("userData");
    const rec = installation.getOrCreateInstallationRecord(userData);
    return { installationId: rec.installationId, createdAt: rec.createdAt };
  });

  ipcMain.handle("desktop:selectUpdateFolder", async (_event, opts) => {
    const win = BrowserWindow.getFocusedWindow();
    const pickManifest = opts && opts.pick === "manifest";
    if (pickManifest) {
      const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
        title: "Seleccionar manifest.json del paquete offline",
        properties: ["openFile"],
        filters: [{ name: "manifest.json", extensions: ["json"] }],
      });
      if (canceled || !filePaths?.length) return null;
      return path.dirname(filePaths[0]);
    }
    const { canceled, filePaths } = await dialog.showOpenDialog(win || undefined, {
      title: "Carpeta del paquete (offline o portable completo)",
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths?.length) return null;
    return filePaths[0];
  });

  ipcMain.handle("desktop:validateUpdateFolder", async (_event, folderPath) => {
    if (!folderPath || typeof folderPath !== "string") {
      return { valid: false, error: "Ruta no válida" };
    }
    const root = path.resolve(folderPath);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      return { valid: false, error: "La carpeta no existe o no es un directorio" };
    }
    const currentVersion = getAppVersionSync();
    const offline = validateOfflineUpdatePackage(root, currentVersion);
    if (offline !== null) {
      if (!offline.valid) return offline;
      if (offline.updateMode === "installer" && process.platform !== "win32") {
        return {
          valid: false,
          error: "Este paquete usa un instalador .exe y solo aplica en Windows.",
        };
      }
      return offline;
    }

    const exePath =
      process.platform === "win32"
        ? findWinPortableExe(root)
        : (() => {
            const legacy = path.join(root, "Cotizaciones PFV Avanzada");
            if (fs.existsSync(legacy)) return legacy;
            const neu = path.join(root, PRODUCT_DISPLAY_NAME);
            return fs.existsSync(neu) ? neu : null;
          })();
    const standaloneServer = path.join(root, "resources", "standalone", "apps", "web", "server.js");
    const nodeExe = path.join(root, "resources", "node", process.platform === "win32" ? "node.exe" : "bin/node");
    if (!exePath) {
      return {
        valid: false,
        error: `No se encontró el ejecutable en la carpeta (Windows: «${NEW_WIN_EXE}» o «${LEGACY_WIN_EXE}»).`,
      };
    }
    if (!fs.existsSync(standaloneServer)) {
      return { valid: false, error: "No se encontró la aplicación (resources/standalone)" };
    }
    if (!fs.existsSync(nodeExe)) {
      return { valid: false, error: "No se encontró Node portable (resources/node)" };
    }
    let newVersion = null;
    const versionPath = path.join(root, "resources", "version.txt");
    if (fs.existsSync(versionPath)) {
      newVersion = fs.readFileSync(versionPath, "utf8").trim();
    }
    if (newVersion && compareSemVer(newVersion, currentVersion) <= 0) {
      return {
        valid: false,
        error: `La versión seleccionada (${newVersion}) debe ser mayor que la actual (${currentVersion})`,
      };
    }
    return {
      valid: true,
      currentVersion,
      newVersion: newVersion || "(sin versión)",
      updateMode: "replace",
    };
  });

  ipcMain.handle("license:getStatus", async () => {
    const userData = app.getPath("userData");
    const record = licenseState.loadState(userData);
    if (!record) {
      return {
        detail:
          "No hay licencia registrada en este equipo. Cargue el archivo de licencia que le entregó el administrador para continuar.",
        reason: "no_license",
      };
    }
    const clock = clockAnchor.checkClockNotRewound(userData);
    if (!clock.ok) {
      const cmsg = {
        clock_rewind_suspected:
          "Se detectó un retroceso del reloj del sistema respecto al último uso autorizado. Corrija la fecha y hora o contacte soporte.",
        clock_anchor_tamper: "El registro de tiempo local fue alterado. Reinstale o contacte soporte.",
        clock_anchor_corrupt: "Registro de tiempo local corrupto. Contacte soporte.",
        hmac_read_error:
          "No se pudo leer LICENSE_HMAC_SECRET del backend embebido. Reconstruya el portable o repare resources/backend/env.embedded.",
      };
      const base = cmsg[clock.reason] || clock.reason;
      return { detail: clock.detail ? `${base}\n\n${clock.detail}` : base, reason: clock.reason };
    }
    const inst = installation.getOrCreateInstallationRecord(userData);
    const v = licenseState.validateStoredState(record, { installationId: inst.installationId, nowMs: Date.now() });
    if (v.ok) return { detail: "Licencia válida." };
    const messages = {
      trial_expired: "El período de prueba (5 días hábiles) ha finalizado.",
      renewal_expired:
        "La licencia ha vencido. Solicite al administrador un archivo de licencia renovado para este equipo (incluya el ID de instalación).",
      wrong_installation:
        "Esta licencia no corresponde a este equipo (ID de instalación distinto). Solicite una licencia emitida para el ID de instalación mostrado abajo.",
      tamper:
        "La licencia local no es válida (posible manipulación). Cargue un archivo de licencia emitido por el administrador.",
      hmac_read_error:
        "No se pudo leer LICENSE_HMAC_SECRET del backend embebido. Reconstruya el portable o repare resources/backend/env.embedded.",
      missing_or_corrupt: "Estado de licencia ausente o corrupto.",
      bad_date: "Fechas de licencia inválidas.",
      version: "Versión de licencia no soportada.",
      unknown_mode: "Modo de licencia no reconocido.",
    };
    const baseDetail = messages[v.reason] || v.reason || "Licencia no válida.";
    const detail = v.detail ? `${baseDetail}\n\n${v.detail}` : baseDetail;
    const out = { detail };
    if (v.payload && typeof v.payload.licenseId === "string" && v.payload.licenseId.trim()) {
      out.licenseId = v.payload.licenseId.trim();
      out.licenseType = v.payload.licenseType || null;
      out.issuedTo = v.payload.issuedTo ?? null;
    }
    return out;
  });

  ipcMain.handle("license:isDeveloperIssuerConfigured", async () => ({
    configured: Boolean(getDeveloperIssuerBaseUrl()),
    maxDays: MAX_DEV_LICENSE_DAYS,
  }));

  ipcMain.handle("license:getHmacAlignmentDiag", async () => {
    const electron = getLicenseHmacDiagnosticSnapshot();
    let nest = null;
    const hmacDiagUrl = (() => {
      if (isPackaged()) {
        return `http://127.0.0.1:${EMBEDDED_API_PORT}/api/v1/desktop-license-debug/diag`;
      }
      const base = getDeveloperIssuerBaseUrl();
      if (base) {
        return `${base.replace(/\/$/, "")}/v1/desktop-license-debug/diag`;
      }
      return `http://127.0.0.1:${EMBEDDED_API_PORT}/api/v1/desktop-license-debug/diag`;
    })();
    if (hmacDiagUrl) {
      try {
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), 5000);
        const dr = await fetch(hmacDiagUrl, { signal: ac.signal });
        clearTimeout(t);
        nest = dr.ok ? await dr.json() : { httpStatus: dr.status };
      } catch (e) {
        nest = { error: String(e && e.message ? e.message : e) };
      }
    }
    const userData = app.getPath("userData");
    const inst = installation.getOrCreateInstallationRecord(userData);
    const aligned =
      nest &&
      !nest.error &&
      !electron.readFailed &&
      nest.fingerprintSha256Prefix16 === electron.fingerprintSha256Prefix16;
    return { electron, nest, aligned, installationId: inst.installationId };
  });

  ipcMain.handle("license:requestDeveloperLicense", async (_event, form) => {
    const base = getDeveloperIssuerBaseUrl();
    if (!base) {
      return {
        ok: false,
        message:
          "Acceso desarrollador desactivado: defina DESKTOP_DEV_LICENSE_ISSUER_URL o quite DESKTOP_DEV_LICENSE_DISABLE_EMBEDDED_DEFAULT.",
      };
    }
    const allowInsecureLocal =
      /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/api$/i.test(base) ||
      (process.env.DESKTOP_DEV_LICENSE_ISSUER_ALLOW_HTTP === "1" &&
        /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(?:\/|$)/i.test(base));
    if (!base.startsWith("https://") && !allowInsecureLocal) {
      return {
        ok: false,
        message:
          "La URL del emisor debe usar HTTPS (o http://127.0.0.1/... con excepción documentada para laboratorio).",
      };
    }
    const email = typeof form?.email === "string" ? form.email.trim().toLowerCase() : "";
    const password = typeof form?.password === "string" ? form.password : "";
    const daysRaw = form?.days;
    const days = typeof daysRaw === "number" ? daysRaw : parseInt(String(daysRaw ?? ""), 10);
    if (!email || !password) {
      return { ok: false, message: "Ingrese correo y contraseña." };
    }
    if (Number.isNaN(days) || days < MIN_DEV_LICENSE_DAYS || days > MAX_DEV_LICENSE_DAYS) {
      return {
        ok: false,
        message: `La cantidad de días debe estar entre ${MIN_DEV_LICENSE_DAYS} y ${MAX_DEV_LICENSE_DAYS}.`,
      };
    }
    const userData = app.getPath("userData");
    const inst = installation.getOrCreateInstallationRecord(userData);
    const url = `${base}${DEV_LICENSE_ISSUER_PATH}`;
    let res;
    try {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), DEV_LICENSE_FETCH_TIMEOUT_MS);
      res = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          installationId: inst.installationId,
          requestedDays: days,
          appVersion: getAppVersionSync(),
        }),
        signal: ac.signal,
      });
      clearTimeout(t);
    } catch (err) {
      const msg =
        err && err.name === "AbortError"
          ? "Tiempo de espera agotado al contactar el servicio de licencias."
          : "No se pudo contactar el servicio de licencias. Compruebe su conexión.";
      return { ok: false, message: msg };
    }
    let bodyText = "";
    try {
      bodyText = await res.text();
    } catch {
      return { ok: false, message: "Respuesta inválida del servidor." };
    }
    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, message: "Credenciales incorrectas o cuenta no autorizada." };
      }
      if (res.status === 403) {
        return { ok: false, message: "Su cuenta no tiene permiso para emitir este tipo de licencia." };
      }
      if (res.status === 429) {
        return { ok: false, message: "Demasiados intentos. Intente más tarde." };
      }
      if (res.status === 503) {
        return {
          ok: false,
          message:
            "El servidor no puede firmar licencias (revise LICENSE_HMAC_SECRET en la API embebida / .env).",
        };
      }
      if (res.status === 400) {
        try {
          const j = JSON.parse(bodyText);
          if (j && typeof j.message === "string" && j.message.length < 200) {
            return { ok: false, message: j.message };
          }
        } catch {
          /* fallthrough */
        }
        return { ok: false, message: "Solicitud rechazada por el servidor." };
      }
      return { ok: false, message: "El servicio de licencias no pudo completar la operación." };
    }
    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch {
      return { ok: false, message: "El servidor no devolvió un JSON válido." };
    }
    if (!parsedBody || typeof parsedBody !== "object" || !parsedBody.payload || !parsedBody.sig) {
      return { ok: false, message: "Formato de licencia inválido en la respuesta del servidor." };
    }
    const r = licenseState.validateExternalLicenseFile(parsedBody, inst.installationId);
    if (!r.ok) {
      const map = {
        bad_signature: "La licencia recibida no supera la verificación local (firma).",
        installation_mismatch: "El servidor emitió la licencia para otro equipo.",
        already_expired: "La licencia emitida ya está vencida.",
        no_valid_until: "La licencia emitida no incluye fecha de vencimiento.",
        no_installation_id: "La licencia emitida no incluye installationId.",
      };
      let message = map[r.reason] || "La licencia recibida no es válida en este equipo.";
      if (r.reason === "bad_signature" && isPackaged()) {
        const elShot = getLicenseHmacDiagnosticSnapshot();
        let nestShot = null;
        try {
          const ac = new AbortController();
          const t = setTimeout(() => ac.abort(), 5000);
          const dr = await fetch(
            `http://127.0.0.1:${EMBEDDED_API_PORT}/api/v1/desktop-license-debug/diag`,
            { signal: ac.signal },
          );
          clearTimeout(t);
          if (dr.ok) nestShot = await dr.json();
        } catch (_) {
          nestShot = { error: "no_response" };
        }
        try {
          const dbg = licenseState.describeLicenseSignatureCheck(parsedBody, inst.installationId);
          const line = `[LICENSE] bad_signature ${JSON.stringify({ electron: elShot, nest: nestShot, verify: dbg })}\n`;
          fs.appendFileSync(getDesktopLogPath(), line, "utf8");
        } catch (_) {
          /* no-op */
        }
        const aligned =
          nestShot &&
          !nestShot.error &&
          nestShot.fingerprintSha256Prefix16 === elShot.fingerprintSha256Prefix16;
        const plInst = parsedBody.payload?.installationId;
        const elFile =
          elShot.pathUsed ||
          elShot.envPath ||
          "(sin archivo; comprobar resources/backend/env.embedded)";
        message += `\n\n— Diagnóstico (empaquetado) —\nElectron: huella SHA256…${elShot.fingerprintSha256Prefix16} · longitud secreto ${elShot.secretLength}\nOrigen: ${elShot.source}\nArchivo leído: ${elFile}`;
        if (nestShot && !nestShot.error) {
          message += `\nNest: huella …${nestShot.fingerprintSha256Prefix16} · longitud ${nestShot.secretLength}\ncwd: ${nestShot.cwd}\nenv.embedded: ${nestShot.envEmbeddedPath} (existe: ${nestShot.envEmbeddedExists})\n.env: ${nestShot.dotEnvPath} (existe: ${nestShot.dotEnvExists})\n¿Misma huella?: ${aligned ? "SÍ" : "NO (causa típica de firma inválida)"}`;
        } else {
          message += `\nNest: sin respuesta de /api/v1/desktop-license-debug/diag`;
        }
        message += `\ninstallationId equipo: ${inst.installationId}\ninstallationId en licencia: ${plInst ?? "(vacío)"}`;
      }
      return { ok: false, message };
    }
    licenseState.saveState(userData, r.record);
    try {
      clockAnchor.touchAnchor(userData);
    } catch {
      /* no-op */
    }
    return {
      ok: true,
      licenseId: r.meta.licenseId,
      licenseType: r.meta.licenseType,
      issuedTo: r.meta.issuedTo,
    };
  });

  ipcMain.handle("license:getUiStatus", async () => {
    if (!isPackaged()) {
      return { embedded: false };
    }
    const userData = app.getPath("userData");
    const inst = installation.getOrCreateInstallationRecord(userData);
    const record = licenseState.loadState(userData);
    const clock = clockAnchor.checkClockNotRewound(userData);
    if (!clock.ok) {
      const detail =
        clock.reason === "clock_rewind_suspected"
          ? "Retroceso del reloj detectado. Corrija fecha y hora del sistema."
          : "Problema con el registro de tiempo local.";
      return {
        embedded: true,
        level: "blocked",
        headline: "Licencia no disponible",
        detail,
        daysRemaining: null,
        validUntil: null,
        warnShort: false,
        installationId: inst.installationId,
      };
    }
    if (!record) {
      return {
        embedded: true,
        level: "none",
        headline: "",
        detail: "",
        daysRemaining: null,
        validUntil: null,
        warnShort: false,
        installationId: inst.installationId,
      };
    }
    const v = licenseState.validateStoredState(record, { installationId: inst.installationId, nowMs: Date.now() });
    if (!v.ok) {
      if (v.reason === "hmac_read_error") {
        const base =
          "No se pudo leer LICENSE_HMAC_SECRET del backend embebido. Reconstruya el portable o repare resources/backend/env.embedded.";
        return {
          embedded: true,
          level: "blocked",
          headline: "Error de firma (HMAC)",
          detail: v.detail ? `${base}\n\n${v.detail}` : base,
          daysRemaining: 0,
          validUntil: null,
          warnShort: false,
          installationId: inst.installationId,
        };
      }
      return {
        embedded: true,
        level: "blocked",
        headline: "Licencia vencida o no válida",
        detail: "Cargue una licencia renovada o contacte al administrador.",
        daysRemaining: 0,
        validUntil: v.payload?.validUntil ?? v.payload?.trialEndsAt ?? null,
        warnShort: false,
        installationId: inst.installationId,
      };
    }
    clockAnchor.touchAnchor(userData);
    const until =
      v.payload.mode === "renewal" ? v.payload.validUntil : v.payload.trialEndsAt;
    const days = licenseState.wholeDaysRemaining(until, Date.now());
    const warnShort = days > 0 && days <= 3;
    const dayWord = days === 1 ? "día" : "días";
    const headline = `Licencia activa, vence en ${days} ${dayWord}`;
    return {
      embedded: true,
      level: "active",
      headline,
      detail: until ? `Válida hasta: ${new Date(until).toLocaleString()}` : "",
      daysRemaining: days,
      validUntil: until,
      warnShort,
      licenseId: v.payload.licenseId ?? null,
      installationId: inst.installationId,
    };
  });

  ipcMain.handle("license:selectAndApply", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Archivo de licencia",
      filters: [
        { name: "Licencia", extensions: ["json", "lic"] },
        { name: "Todos los archivos", extensions: ["*"] },
      ],
      properties: ["openFile"],
    });
    if (canceled || !filePaths?.length) return { ok: false, cancelled: true };
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePaths[0], "utf8"));
    } catch {
      return { ok: false, message: "El archivo no es un JSON válido." };
    }
    const inst = installation.getOrCreateInstallationRecord(app.getPath("userData"));
    const r = licenseState.validateExternalLicenseFile(parsed, inst.installationId);
    if (!r.ok) {
      const map = {
        invalid_file: "Formato de archivo incorrecto (se espera { payload, sig }).",
        bad_signature: "La firma no coincide. El archivo fue alterado o no corresponde a esta instalación.",
        version: "Versión de licencia no soportada.",
        kind: "Tipo de licencia no válido.",
        no_license_id:
          "Falta un identificador de licencia válido en el archivo (ej. LIC-TRIAL-0001). Solicite un archivo nuevo al administrador.",
        bad_license_type: "El tipo de licencia del archivo no es reconocido por esta versión de la aplicación.",
        no_valid_until: "Falta la fecha de validez (campo validUntil).",
        already_expired: "Esta licencia ya está vencida.",
        no_installation_id:
          "El archivo de licencia no incluye installationId (UUID). Debe generarse con el ID de este equipo.",
        installation_mismatch:
          "Esta licencia fue emitida para otro equipo. Verifique el ID de instalación y solicite un archivo nuevo.",
        hmac_read_error:
          "No se pudo leer LICENSE_HMAC_SECRET del backend embebido. Reconstruya el portable o repare resources/backend/env.embedded.",
      };
      const msg = map[r.reason] || r.reason;
      return { ok: false, message: r.detail ? `${msg}\n\n${r.detail}` : msg };
    }
    licenseState.saveState(app.getPath("userData"), r.record);
    return {
      ok: true,
      licenseId: r.meta.licenseId,
      licenseType: r.meta.licenseType,
      issuedTo: r.meta.issuedTo,
    };
  });

  ipcMain.handle("license:quit", () => {
    app.quit();
  });

  ipcMain.handle("license:relaunch", () => {
    /**
     * Escenario crítico: carpeta portable copiada/movida.
     * app.relaunch() puede ser ambiguo cuando existen varias copias/instancias.
     * Forzamos relanzar exactamente el exe actual (process.execPath).
     */
    const currentExe = process.execPath;
    const relaunchArgs = process.argv.slice(1).filter((arg) => arg !== "--relaunch-from-license");
    relaunchArgs.push("--relaunch-from-license");
    try {
      fs.appendFileSync(
        getDesktopLogPath(),
        `[DESKTOP] Relaunch solicitado exe=${currentExe} args=${JSON.stringify(relaunchArgs)}\n`,
        "utf8",
      );
    } catch (_) {}
    try {
      spawn(currentExe, relaunchArgs, {
        cwd: path.dirname(currentExe),
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      setImmediate(() => app.exit(0));
      return { ok: true };
    } catch (err) {
      try {
        fs.appendFileSync(
          getDesktopLogPath(),
          `[DESKTOP] ERROR relaunch spawn: ${err && err.message ? err.message : String(err)}\n`,
          "utf8",
        );
      } catch (_) {}
      return { ok: false, message: "No se pudo reiniciar automáticamente. Cierre y abra la aplicación manualmente." };
    }
  });

  ipcMain.handle("desktop:applyUpdate", async (_event, folderPath) => {
    if (!app.isPackaged) {
      return { ok: false, message: "La actualización solo está disponible en la aplicación empaquetada." };
    }
    if (!folderPath || typeof folderPath !== "string") {
      return { ok: false, message: "Ruta no válida." };
    }
    const sourceDir = path.resolve(folderPath);
    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      return { ok: false, message: "La carpeta de actualización no existe." };
    }
    const currentVersion = getAppVersionSync();
    const offline = validateOfflineUpdatePackage(sourceDir, currentVersion);
    if (offline !== null) {
      if (!offline.valid) {
        return { ok: false, message: offline.error || "Paquete offline inválido." };
      }
      if (offline.updateMode === "installer") {
        if (process.platform !== "win32") {
          return { ok: false, message: "Instalador .exe solo en Windows." };
        }
        let manifest;
        try {
          manifest = JSON.parse(fs.readFileSync(path.join(sourceDir, "manifest.json"), "utf8"));
        } catch (e) {
          return { ok: false, message: "No se pudo leer manifest.json." };
        }
        const safeName = safeInstallerBasename(manifest.installerFile);
        if (!safeName) {
          return { ok: false, message: "installerFile inválido." };
        }
        const installerPath = path.join(sourceDir, safeName);
        if (!fs.existsSync(installerPath)) {
          return { ok: false, message: "Instalador no encontrado." };
        }
        const h1 = verifyInstallerSha256(installerPath, manifest.installerSha256 || "");
        if (!h1.ok) return { ok: false, message: h1.error };
        const h2 = verifyChecksumSha256File(sourceDir, installerPath, safeName);
        if (!h2.ok) return { ok: false, message: h2.error };
        const newVersion =
          manifest && manifest.version != null && String(manifest.version).trim()
            ? String(manifest.version).trim()
            : null;
        const win = BrowserWindow.fromWebContents(_event.sender) || BrowserWindow.getFocusedWindow();
        const confirm = await dialog.showMessageBox(win || undefined, {
          type: "info",
          title: "Actualizar Cotizaciones PFV Avanzada",
          message: newVersion
            ? `Se instalará la versión ${newVersion} de Cotizaciones PFV Avanzada.`
            : "Se instalará una nueva versión de Cotizaciones PFV Avanzada.",
          detail:
            "Si ya tiene la aplicación instalada, esto es una actualización: se conservan sus datos, licencia y configuración en la carpeta de datos de usuario.\n\n" +
            "La aplicación se cerrará y se abrirá el asistente del instalador. Siga los pasos hasta finalizar; no apague el equipo ni interrumpa el proceso.\n\n" +
            "¿Desea continuar?",
          buttons: ["Continuar con la actualización", "Cancelar"],
          defaultId: 0,
          cancelId: 1,
          noLink: true,
        });
        if (confirm.response === 1) {
          return { ok: false, message: "Actualización cancelada." };
        }
        try {
          fs.appendFileSync(
            getDesktopLogPath(),
            `[DESKTOP] applyUpdate: lanzando instalador offline ${installerPath}\n`,
            "utf8",
          );
        } catch (_e) {
          /* no-op */
        }
        try {
          spawn(installerPath, [], {
            detached: true,
            stdio: "ignore",
            cwd: sourceDir,
            windowsHide: false,
          }).unref();
        } catch (err) {
          return {
            ok: false,
            message: "No se pudo iniciar el instalador: " + (err.message || String(err)),
          };
        }
        setImmediate(() => app.quit());
        return {
          ok: true,
          message:
            "La aplicación se cerrará. Complete la actualización en el asistente del instalador. Sus datos y licencia se conservan en la carpeta de datos de usuario de la aplicación.",
        };
      }
    }

    const appDir = path.dirname(process.execPath);
    const timestamp = Date.now();
    const tempCopy = path.join(os.tmpdir(), `pvquoting-update-${timestamp}`);
    const backupSuffix = `backup.${timestamp}`;

    try {
      copyRecursive(sourceDir, tempCopy);
    } catch (err) {
      return { ok: false, message: "Error al copiar la actualización: " + (err.message || String(err)) };
    }

    if (process.platform === "win32") {
      const runningExeBasename = path.basename(process.execPath);
      const batPath = path.join(os.tmpdir(), `pvquoting-updater-${timestamp}.bat`);
      const backupDir = appDir + "." + backupSuffix;
      const esc = (s) => s.replace(/"/g, '""');
      const batContent = [
        "@echo off",
        `set "APPDIR=${esc(appDir)}"`,
        `set "TEMPDIR=${esc(tempCopy)}"`,
        `set "EXENAME=${esc(runningExeBasename)}"`,
        `set "BACKUPDIR=${esc(backupDir)}"`,
        ":wait",
        "tasklist /FI \"IMAGENAME eq %EXENAME%\" 2>NUL | find /I \"%EXENAME%\" >NUL",
        "if %ERRORLEVEL% equ 0 (timeout /t 2 /nobreak >NUL & goto wait)",
        "move /Y \"%APPDIR%\" \"%BACKUPDIR%\"",
        "move /Y \"%TEMPDIR%\" \"%APPDIR%\"",
        "start \"\" \"%APPDIR%\\%EXENAME%\"",
      ].join("\n");
      fs.writeFileSync(batPath, batContent, "utf8");
      spawn("cmd.exe", ["/c", batPath], {
        detached: true,
        stdio: "ignore",
        cwd: os.tmpdir(),
        windowsHide: true,
      }).unref();
    } else {
      const runningExeBasename = path.basename(process.execPath);
      const scriptPath = path.join(os.tmpdir(), `pvquoting-updater-${timestamp}.sh`);
      const scriptContent = [
        "#!/bin/sh",
        `APPDIR="${appDir.replace(/"/g, '\\"')}"`,
        `TEMPDIR="${tempCopy.replace(/"/g, '\\"')}"`,
        `EXENAME="${runningExeBasename.replace(/"/g, '\\"')}"`,
        `BACKUPDIR="${(appDir + "." + backupSuffix).replace(/"/g, '\\"')}"`,
        "while kill -0 " + process.pid + " 2>/dev/null; do sleep 2; done",
        "mv \"$APPDIR\" \"$BACKUPDIR\"",
        "mv \"$TEMPDIR\" \"$APPDIR\"",
        "exec \"$APPDIR/$EXENAME\" &",
      ].join("\n");
      fs.writeFileSync(scriptPath, scriptContent, "utf8");
      fs.chmodSync(scriptPath, "755");
      spawn(scriptPath, [], {
        detached: true,
        stdio: "ignore",
        cwd: os.tmpdir(),
      }).unref();
    }

    setImmediate(() => app.quit());
    return { ok: true, message: "La aplicación se cerrará y se actualizará. Se abrirá de nuevo en unos segundos." };
  });

  ipcMain.handle("spellcheck:getSettings", () => spellSettings.readSpellSettings(app.getPath("userData")));

  ipcMain.handle("spellcheck:setSettings", (_event, payload) => {
    if (!payload || typeof payload !== "object") {
      return { ok: false, error: "Payload inválido." };
    }
    try {
      const next = spellSettings.writeSpellSettings(app.getPath("userData"), {
        enabled: payload.enabled,
        languages: payload.languages,
        showRightClickSuggestions: payload.showRightClickSuggestions,
      });
      session.defaultSession.setSpellCheckerEnabled(next.enabled !== false);
      if (next.enabled !== false && next.languages.length) {
        session.defaultSession.setSpellCheckerLanguages(next.languages);
      }
      return { ok: true, settings: next };
    } catch (err) {
      return { ok: false, error: String(err && err.message ? err.message : err) };
    }
  });
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return;
    try {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    } catch (_) {
      /* no-op */
    }
  });
}

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  registerDesktopIpc();
  applySpellcheckerFromDisk();
  createSplashWindow();
  setSplashPhase("Iniciando aplicación…");
  writeGuaranteedDesktopStartupLog();
  if (isPackaged()) {
    try {
      const inst = installation.getOrCreateInstallationRecord(app.getPath("userData"));
      fs.appendFileSync(
        getDesktopLogPath(),
        `[DESKTOP] installationId=${inst.installationId}\n`,
        "utf8",
      );
    } catch (e) {
      console.warn("[DESKTOP] installation id:", e);
    }
    const nodePath = getPackagedNodePath();
    const backendDir = getEmbeddedBackendDir();
    const hasEmbeddedBackend = fs.existsSync(path.join(backendDir, "dist", "main.js"));

    // Arrancar API embebida antes de validar licencia: permite «Acceso desarrollador» en la pantalla de bloqueo
    // (POST firmado contra el mismo installationId en localhost).
    if (hasEmbeddedBackend) {
      if (!fs.existsSync(nodePath)) {
        console.error("No se encontró Node empaquetado en", nodePath);
        destroySplash();
        app.quit();
        return;
      }
      const dbPath = getDatabasePath();
      try {
        setSplashPhase("Preparando base de datos…");
        validateEmbeddedBackendArtifacts();
        runEmbeddedMigrations(dbPath);
        runEmbeddedDbPush(dbPath);
        runEmbeddedSeed(dbPath);
        const instRec = installation.getOrCreateInstallationRecord(app.getPath("userData"));
        let ingressSecret = "";
        try {
          const embeddedEnvPath = path.join(backendDir, "env.embedded");
          const dotEnvPath = path.join(backendDir, ".env");
          const readEnvVal = (p) => {
            try {
              if (!fs.existsSync(p)) return null;
              const raw = fs.readFileSync(p, "utf8");
              const re = new RegExp(
                `^\\s*LICENSE_HMAC_SECRET\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s#]+))\\s*$`,
                "m",
              );
              const m = raw.match(re);
              if (!m) return null;
              const v = (m[2] ?? m[3] ?? m[4] ?? "").trim();
              return v || null;
            } catch (_) {
              return null;
            }
          };
          const licenseHmac = readEnvVal(dotEnvPath) || readEnvVal(embeddedEnvPath);
          if (licenseHmac && licenseHmac.length >= 8) {
            ingressSecret = licenseHmac.slice(0, 32);
          }
        } catch (_) {}
        setSplashPhase("Iniciando servicios de red…");
        startLanP2pDaemon(app.getPath("userData"), instRec.installationId, ingressSecret);
        try {
          await waitForTcpPort(40777, "127.0.0.1", 8000);
        } catch (e) {
          console.warn("[p2p] Espera control TCP:", e && e.message ? e.message : e);
        }
        process.env.PVQ_INSTALLATION_ID = instRec.installationId;
        process.env.P2P_CONTROL_ADDR = "127.0.0.1:40777";
        if (ingressSecret.length >= 8) {
          process.env.P2P_INGRESS_SECRET = ingressSecret;
        }
        setSplashPhase("Conectando con el servidor…");
        const reusableBackend = await canReuseEmbeddedBackendOnPort(EMBEDDED_API_PORT);
        if (reusableBackend) {
          appendBackendSetupLog(
            `[embedded-backend] Reutilizando backend ya activo en :${EMBEDDED_API_PORT} (health OK)\n`,
          );
          logStartup("backend-reuse", `health OK en :${EMBEDDED_API_PORT} (sin nuevo spawn)`);
        } else {
          let skipSpawnBecauseReuse = false;
          let portInUse = false;
          try {
            await waitForTcpPort(EMBEDDED_API_PORT, "127.0.0.1", 1200);
            portInUse = true;
          } catch (_) {
            portInUse = false;
          }
          if (portInUse) {
            appendBackendSetupLog(
              `[embedded-backend] Puerto :${EMBEDDED_API_PORT} en uso sin health OK; esperando 2s por si otra instancia liberó…\n`,
            );
            logStartup(
              "backend-port-busy",
              `:${EMBEDDED_API_PORT} ocupado, reintento de health tras 2s`,
            );
            await new Promise((r) => setTimeout(r, 2000));
            const recovered = await canReuseEmbeddedBackendOnPort(EMBEDDED_API_PORT);
            if (recovered) {
              appendBackendSetupLog(
                `[embedded-backend] Tras espera, backend en :${EMBEDDED_API_PORT} respondió health OK\n`,
              );
              skipSpawnBecauseReuse = true;
            } else {
              appendBackendSetupLog(
                `[embedded-backend] ERROR puerto :${EMBEDDED_API_PORT} ocupado sin health OK; no se puede arrancar backend embebido.\n`,
              );
              throw new Error(
                `Puerto ${EMBEDDED_API_PORT} ocupado por un proceso no saludable (/api/health no responde).`,
              );
            }
          }
          if (!skipSpawnBecauseReuse) {
            startEmbeddedBackend(dbPath);
            logStartup("backend-spawn", `Nest embebido en :${EMBEDDED_API_PORT}, esperando /api/health`);
            await waitForHealth(EMBEDDED_API_PORT, HEALTH_CHECK_TIMEOUT_MS);
            logStartup("backend-health-ok", `:${EMBEDDED_API_PORT}`);
          }
        }
      } catch (err) {
        const em = err && err.message ? err.message : String(err);
        logStartup("FATAL backend embebido", em);
        console.error("Error iniciando backend embebido:", err);
        destroySplash();
        killServer();
        app.quit();
        return;
      }
    }

    setSplashPhase("Verificando licencia…");
    const lic = getPackagedLicenseValidation();
    if (!lic.ok) {
      console.warn("[license] Bloqueado:", lic.reason || "unknown");
      createLicenseBlockedWindow();
      return;
    }

    try {
      fs.appendFileSync(
        getDesktopLogPath(),
        `[DESKTOP] Licencia OK (${lic.payload?.mode || "unknown"}) — arrancando Next\n`,
        "utf8",
      );
    } catch (_) {}

    if (!fs.existsSync(nodePath)) {
      console.error("No se encontró Node empaquetado en", nodePath);
      destroySplash();
      app.quit();
      return;
    }

    const standaloneDir = getStandaloneDir();
    const serverJs = path.join(standaloneDir, "apps", "web", "server.js");
    if (!fs.existsSync(serverJs)) {
      console.error("No se encontró la app empaquetada en", standaloneDir);
      destroySplash();
      app.quit();
      return;
    }
    setSplashPhase("Cargando interfaz…");
    serverProcess = spawn(nodePath, [path.relative(standaloneDir, serverJs)], {
      cwd: standaloneDir,
      env: {
        ...process.env,
        PORT: String(PROD_PORT),
        HOSTNAME: "127.0.0.1",
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4000/api",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serverProcess.stdout?.on("data", (chunk) => {
      logToBackendFile("[next] ", chunk);
    });
    serverProcess.stderr?.on("data", (chunk) => {
      logToBackendFile("[next] ", chunk);
    });
    serverProcess.on("error", (err) => {
      console.error("Error al iniciar servidor Next:", err);
      try {
        fs.appendFileSync(getDesktopLogPath(), `[DESKTOP] Next spawn error: ${err && err.message}\n`, "utf8");
      } catch (_) {}
      destroySplash();
      app.quit();
    });
    serverProcess.on("exit", (code) => {
      const line = `[DESKTOP] Servidor Next exit code=${code}\n`;
      try {
        fs.appendFileSync(getDesktopLogPath(), line, "utf8");
      } catch (_) {}
      if (code !== 0 && code !== null) {
        console.error("Servidor Next finalizó con código", code);
      }
    });
    try {
      logStartup("next-wait", `esperando http://127.0.0.1:${PROD_PORT} (máx ${NEXT_SERVER_WAIT_TIMEOUT_MS}ms)`);
      await waitForServer(PROD_PORT, NEXT_SERVER_WAIT_TIMEOUT_MS);
      logStartup("next-ready", `puerto ${PROD_PORT} respondió`);
      const embeddedParam = hasEmbeddedBackend ? "?embedded=1" : "";
      createWindow(`http://127.0.0.1:${PROD_PORT}${embeddedParam}`);
    } catch (err) {
      const em = err && err.message ? err.message : String(err);
      logStartup("FATAL esperando Next", em);
      console.error("Error esperando servidor Next:", err);
      destroySplash();
      killServer();
      app.quit();
    }
  } else {
    setSplashPhase("Cargando aplicación de desarrollo…");
    createWindow(DEV_URL);
  }
});

app.on("window-all-closed", () => {
  killServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killServer();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    if (isPackaged() && !shouldSkipLicenseCheck()) {
      const lic = getPackagedLicenseValidation();
      if (!lic.ok) {
        createLicenseBlockedWindow();
        return;
      }
    }
    const url = isPackaged() ? `http://127.0.0.1:${PROD_PORT}` : DEV_URL;
    createWindow(url);
  }
});

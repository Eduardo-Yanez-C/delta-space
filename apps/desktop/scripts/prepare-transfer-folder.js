/**
 * Carpeta OFICIAL para traslado: dist/Cotizaciones-PFV-Portable/
 * (copia desde win-unpacked del manifiesto + backend embed-api actualizado).
 *
 * La carpeta "Aplicacion de traslado" solo aparece si corriste un script viejo; ya no se genera.
 * electron-builder (vía run-electron-build.js) puede escribir en dist/electron-out-<ts>/win-unpacked;
 * si no hay manifiesto, se usa dist/win-unpacked.
 */
const path = require("path");
const fs = require("fs");
const { relocateDir, renameWithRetry } = require("./win-safe-fs");
const { getWinUnpackedPath } = require("./read-build-manifest");
const {
  distRoot,
  desktopRoot,
  OFFICIAL_PORTABLE_DIR_NAME,
} = require("./build-paths");
const { verifyPortableFolder } = require("./verify-portable-package");
const { parseEnvFile, mergeSecretsIntoDotenv } = require("./merge-desktop-build-env");

const embedApiDir = path.join(desktopRoot, "embed-api");
const officialDir = path.join(distRoot, OFFICIAL_PORTABLE_DIR_NAME);
const tmpDir = path.join(distRoot, `${OFFICIAL_PORTABLE_DIR_NAME}.__build__`);

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
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

function pruneOldElectronOuts(keep = 2) {
  if (!fs.existsSync(distRoot)) return;
  const names = fs.readdirSync(distRoot).filter((n) => /^electron-out-\d+$/.test(n));
  const sorted = names
    .map((n) => ({ n, t: fs.statSync(path.join(distRoot, n)).mtimeMs }))
    .sort((a, b) => a.t - b.t);
  const victims = sorted.slice(0, Math.max(0, sorted.length - keep));
  for (const { n } of victims) {
    relocateDir(path.join(distRoot, n));
  }
  if (victims.length) {
    console.log(
      `[prepare-transfer-folder] ${victims.length} carpeta(s) electron-out-* antigua(s) movidas a .__stale__`,
    );
  }
}

function assertTransferIntegrity(dir) {
  const checks = [
    ["chrome_100_percent.pak", path.join(dir, "chrome_100_percent.pak")],
    ["resources.pak", path.join(dir, "resources.pak")],
    ["Next standalone server.js", path.join(dir, "resources", "standalone", "apps", "web", "server.js")],
    ["Node portable", path.join(dir, "resources", "node", process.platform === "win32" ? "node.exe" : path.join("bin", "node"))],
    ["locales (al menos 1 archivo)", path.join(dir, "locales")],
  ];
  if (fs.existsSync(embedApiDir)) {
    checks.push([
      "Backend embebido dist/main.js",
      path.join(dir, "resources", "backend", "dist", "main.js"),
    ]);
    checks.push([
      "Backend env.embedded (HMAC; electron-builder omite .env a menudo)",
      path.join(dir, "resources", "backend", "env.embedded"),
    ]);
    if (process.platform === "win32") {
      checks.push([
        "Daemon LAN P2P (lan-p2p.exe)",
        path.join(dir, "resources", "lan-p2p", "lan-p2p.exe"),
      ]);
    }
  }
  const missing = [];
  for (const [label, p] of checks) {
    if (!fs.existsSync(p)) {
      missing.push(`${label}: ${p}`);
      continue;
    }
    if (label.startsWith("locales")) {
      const names = fs.readdirSync(p);
      if (!names.length) missing.push(`${label}: carpeta vacía (${p})`);
    }
  }
  if (missing.length) {
    console.error(
      "[prepare-transfer-folder] Carpeta portable incompleta:\n  - " + missing.join("\n  - "),
    );
    process.exit(1);
  }
}

function writeReadme(portableDir, exeName) {
  const text = [
    "================================================================================",
    "  COTIZACIONES PFV AVANZADA — CARPETA OFICIAL PARA TRASLADO",
    "================================================================================",
    "",
    `Ejecutable: ${exeName}`,
    "",
    "Licencia:",
    "  • Botón «Seleccionar licencia» → archivo .json o .lic",
    "  • «Acceso desarrollador» → correo/contraseña ADMIN_DEV + días (API embebida en este PC)",
    "",
    "No mueva solo el .exe: lleve TODA esta carpeta.",
    "",
    "Registro técnico (fallos de API/SQLite): carpeta de datos de la app → logs/backend.log",
    "",
    "Desarrollo: tras cambiar el backend, reconstruir con «npm run build:desktop» en la raíz del repo;",
    "validar sin abrir el .exe: «npm run validate:desktop-portable».",
    "",
    `Generado: ${new Date().toISOString()}`,
    "================================================================================",
    "",
  ].join("\r\n");
  fs.writeFileSync(path.join(portableDir, "LEEME-TRASLADO.txt"), text, "utf8");
}

function writePointerFile(portableDir, exeName) {
  const abs = path.resolve(portableDir);
  const lines = [
    "CARPETA OFICIAL PARA LLEVAR A OTRO PC",
    "====================================",
    "",
    abs,
    "",
    `Abrir: ${exeName}`,
    "",
    "(Este archivo se regenera en cada build:desktop)",
    "",
  ].join("\r\n");
  fs.writeFileSync(path.join(distRoot, "LLEVAR-ESTA-CARPETA.txt"), lines, "utf8");
}

const resolved = getWinUnpackedPath();
if (!resolved) {
  console.error("[prepare-transfer-folder] No hay manifiesto de build ni win-unpacked. Ejecute el pipeline desktop primero.");
  process.exit(1);
}

const { winUnpacked } = resolved;
if (!fs.existsSync(winUnpacked)) {
  console.error("[prepare-transfer-folder] win-unpacked no existe:", winUnpacked);
  process.exit(1);
}

if (fs.existsSync(tmpDir)) {
  if (!relocateDir(tmpDir)) {
    console.error("[prepare-transfer-folder] No se pudo mover carpeta temporal anterior.");
    process.exit(1);
  }
}

console.log("[prepare-transfer-folder] Origen win-unpacked:", winUnpacked);
console.log("[prepare-transfer-folder] Construyendo en:", tmpDir);
copyRecursive(winUnpacked, tmpDir);

const backendDest = path.join(tmpDir, "resources", "backend");
if (fs.existsSync(embedApiDir)) {
  if (fs.existsSync(backendDest)) {
    if (!relocateDir(backendDest)) {
      console.error("[prepare-transfer-folder] No se pudo mover resources/backend anterior en temporal.");
      process.exit(1);
    }
  }
  copyRecursive(embedApiDir, backendDest);
} else {
  console.warn("[prepare-transfer-folder] Sin embed-api; backend podría faltar.");
}

/** Alinea HMAC del portable con desktop-build.env aunque win-unpacked traiga .env placeholder. */
const backendEnvInPortable = path.join(tmpDir, "resources", "backend", ".env");
const exampleSecretsPath = path.join(desktopRoot, "desktop-build.env.example");
const buildSecretsPath = path.join(desktopRoot, "desktop-build.env");
if (!fs.existsSync(buildSecretsPath) && fs.existsSync(exampleSecretsPath)) {
  fs.copyFileSync(exampleSecretsPath, buildSecretsPath);
  console.log(
    "[prepare-transfer-folder] Creado desktop-build.env desde desktop-build.env.example (fusionar HMAC).",
  );
}
if (fs.existsSync(buildSecretsPath) && fs.existsSync(backendEnvInPortable)) {
  const sec = parseEnvFile(fs.readFileSync(buildSecretsPath, "utf8"));
  mergeSecretsIntoDotenv(backendEnvInPortable, sec);
  console.log(
    "[prepare-transfer-folder] desktop-build.env → resources/backend/.env del portable (LICENSE_HMAC_SECRET).",
  );
}
if (fs.existsSync(backendEnvInPortable)) {
  const mirror = path.join(path.dirname(backendEnvInPortable), "env.embedded");
  fs.copyFileSync(backendEnvInPortable, mirror);
  console.log("[prepare-transfer-folder] Sincronizado resources/backend/env.embedded (lectura Electron / empaquetado).");
}

/**
 * electron-builder a veces no deja lan-p2p.exe en win-unpacked (rutas con espacios, antivirus, etc.).
 * Mismo criterio que ensure-standalone-in-dist: alinear desde la salida real de cargo.
 */
function syncLanP2pFromCargo(portableDir) {
  if (process.platform !== "win32") return;
  if (!fs.existsSync(embedApiDir)) return;
  const src = path.join(desktopRoot, "..", "lan-p2p", "target", "release", "lan-p2p.exe");
  const dest = path.join(portableDir, "resources", "lan-p2p", "lan-p2p.exe");
  if (!fs.existsSync(src)) {
    console.error(
      "[prepare-transfer-folder] Falta lan-p2p.exe (compilación Rust). En la raíz del monorepo ejecute:\n" +
        "  npm run build:lan-p2p\n" +
        "Origen esperado:\n  " +
        src,
    );
    process.exit(1);
  }
  const destDir = path.dirname(dest);
  if (fs.existsSync(destDir)) {
    const st = fs.statSync(destDir);
    if (!st.isDirectory()) {
      fs.unlinkSync(destDir);
    }
  }
  try {
    fs.mkdirSync(destDir, { recursive: true });
  } catch (e) {
    if (e && e.code === "EEXIST" && fs.statSync(destDir).isDirectory()) {
      /* idempotente */
    } else {
      throw e;
    }
  }
  fs.copyFileSync(src, dest);
  console.log("[prepare-transfer-folder] lan-p2p.exe sincronizado desde cargo →", dest);
}

syncLanP2pFromCargo(tmpDir);

assertTransferIntegrity(tmpDir);

const allowPh = process.env.DESKTOP_BUILD_ALLOW_PLACEHOLDER_LICENSE_SECRET === "1";
let verifyResult;
try {
  verifyResult = verifyPortableFolder(tmpDir, { allowPlaceholderSecret: allowPh });
} catch (e) {
  console.error(String(e && e.message ? e.message : e));
  console.error(
    "[prepare-transfer-folder] Falló la verificación. Revise LICENSE_HMAC_SECRET en desktop-build.env o api/.env.desktop, luego reintente.",
  );
  relocateDir(tmpDir);
  process.exit(1);
}

if (fs.existsSync(officialDir)) {
  if (!relocateDir(officialDir)) {
    const fallback = path.join(distRoot, `${OFFICIAL_PORTABLE_DIR_NAME}-${Date.now()}`);
    console.warn(
      "[prepare-transfer-folder] No se pudo mover la carpeta oficial anterior (¿en uso?). " +
        `Entregando: ${path.basename(fallback)}`,
    );
    if (!renameWithRetry(tmpDir, fallback)) {
      console.error("[prepare-transfer-folder] No se pudo renombrar carpeta temporal a fallback.");
      process.exit(1);
    }
    writeReadme(fallback, verifyResult.exeName);
    writePointerFile(fallback, verifyResult.exeName);
    pruneOldElectronOuts();
    console.log("[prepare-transfer-folder] Listo (fallback):", fallback);
    process.exit(0);
  }
}

if (!renameWithRetry(tmpDir, officialDir)) {
  console.error("[prepare-transfer-folder] No se pudo renombrar carpeta temporal a oficial.");
  process.exit(1);
}
writeReadme(officialDir, verifyResult.exeName);
writePointerFile(officialDir, verifyResult.exeName);
pruneOldElectronOuts();

console.log("------------------------------------------------------------");
console.log("[prepare-transfer-folder] CARPETA OFICIAL (traslado):");
console.log(" ", officialDir);
console.log("[prepare-transfer-folder] Ejecutable:", verifyResult.exeName);
console.log("------------------------------------------------------------");

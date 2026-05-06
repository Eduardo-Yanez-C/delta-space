/**
 * Genera carpeta transportable para actualización manual (pendrive):
 *   dist/Cotizaciones-PFV-Update-<version>/
 *     manifest.json
 *     Cotizaciones-PFV-Setup-<version>.exe   (copiado desde dist/)
 *     checksum.sha256                         (opcional, recomendado)
 *     release-notes.txt                       (opcional, si existe RELEASE_NOTES.txt en desktop)
 *
 * Prerrequisito: haber corrido el build y que exista dist/Cotizaciones-PFV-Setup-<version>.exe
 * (p. ej. npm run build en apps/desktop).
 *
 * Uso:
 *   node scripts/prepare-offline-update-package.js
 *   node scripts/prepare-offline-update-package.js --min 0.1.0
 *
 * Formato manifest.json (v1):
 * {
 *   "schemaVersion": 1,
 *   "appId": "cl.pvquoting.desktop",
 *   "productName": "Cotizaciones PFV Avanzada",
 *   "version": "0.1.0",
 *   "minInstalledVersion": "0.0.0",
 *   "installerFile": "Cotizaciones-PFV-Setup-0.1.0.exe",
 *   "installerSha256": "<hex>",
 *   "generatedAt": "<ISO>"
 * }
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { desktopRoot, distRoot } = require("./build-paths");

const APP_ID = "cl.pvquoting.desktop";
const PRODUCT_NAME = "Cotizaciones PFV Avanzada";

function parseArgs() {
  const argv = process.argv.slice(2);
  let minInstalled = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--min=")) minInstalled = a.slice("--min=".length).trim();
    else if (a === "--min" && argv[i + 1]) {
      minInstalled = argv[i + 1].trim();
      i++;
    }
  }
  return { minInstalled };
}

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function main() {
  const { minInstalled } = parseArgs();
  const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"));
  const version = (pkg.version || "0.0.0").trim();
  const installerName = `Cotizaciones-PFV-Setup-${version}.exe`;
  const srcInstaller = path.join(distRoot, installerName);

  if (!fs.existsSync(srcInstaller)) {
    console.error(
      `[prepare-offline-update-package] No existe ${installerName} en ${distRoot}. Ejecute antes el build (npm run build).`,
    );
    process.exit(1);
    return;
  }

  const outDirName = `Cotizaciones-PFV-Update-${version}`;
  const outDir = path.join(distRoot, outDirName);
  if (fs.existsSync(outDir)) {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  fs.mkdirSync(outDir, { recursive: true });

  const destInstaller = path.join(outDir, installerName);
  fs.copyFileSync(srcInstaller, destInstaller);

  const hash = sha256File(destInstaller);
  const checksumLine = `${hash}  ${installerName}\n`;
  fs.writeFileSync(path.join(outDir, "checksum.sha256"), checksumLine, "utf8");

  const notesSrc = path.join(desktopRoot, "RELEASE_NOTES.txt");
  if (fs.existsSync(notesSrc)) {
    fs.copyFileSync(notesSrc, path.join(outDir, "release-notes.txt"));
  }

  const minVer = (minInstalled || "0.0.0").trim();

  const manifest = {
    schemaVersion: 1,
    appId: APP_ID,
    productName: PRODUCT_NAME,
    version,
    minInstalledVersion: minVer,
    installerFile: installerName,
    installerSha256: hash,
    notesFile: fs.existsSync(notesSrc) ? "release-notes.txt" : undefined,
    generatedAt: new Date().toISOString(),
  };
  if (!manifest.notesFile) delete manifest.notesFile;

  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");

  console.log("[prepare-offline-update-package] Paquete creado en:", outDir);
  console.log("  ", installerName, "sha256:", hash.slice(0, 16) + "…");
}

main();

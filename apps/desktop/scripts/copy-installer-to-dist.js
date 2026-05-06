/**
 * Tras electron-builder (NSIS), copia el instalador a apps/desktop/dist/ con nombre fijo.
 * Lee dist/.desktop-build-manifest.json (electronOutputDir) escrito por run-electron-build.js.
 */
const fs = require("fs");
const path = require("path");
const { manifestPath, distRoot, desktopRoot } = require("./build-paths");

function main() {
  const pkg = JSON.parse(fs.readFileSync(path.join(desktopRoot, "package.json"), "utf8"));
  const version = pkg.version;
  const expectedName = `Cotizaciones-PFV-Setup-${version}.exe`;

  if (!fs.existsSync(manifestPath)) {
    console.error("[copy-installer-to-dist] Falta manifiesto de build (.desktop-build-manifest.json).");
    process.exit(1);
    return;
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    console.error("[copy-installer-to-dist] Manifiesto inválido.");
    process.exit(1);
    return;
  }
  const outDir = manifest.electronOutputDir;
  if (!outDir || !fs.existsSync(outDir)) {
    console.error("[copy-installer-to-dist] electronOutputDir ausente o inexistente.");
    process.exit(1);
    return;
  }
  const src = path.join(outDir, expectedName);
  if (!fs.existsSync(src)) {
    console.error(
      `[copy-installer-to-dist] No se encontró ${expectedName} en ${outDir}. ¿Target nsis y artifactName en package.json?`,
    );
    process.exit(1);
    return;
  }
  const dest = path.join(distRoot, expectedName);
  fs.mkdirSync(distRoot, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("[copy-installer-to-dist] Instalador copiado a:", dest);
}

main();

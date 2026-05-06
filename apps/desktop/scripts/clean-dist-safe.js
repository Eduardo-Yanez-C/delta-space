/**
 * Reemplaza rmSync(dist): mueve apps/desktop/dist → dist.__stale__.ts (reintentos).
 * No falla si dist no existe. Si no se puede mover (ej. proceso usando archivos), sale con código 1 y mensaje claro.
 */
const path = require("path");
const fs = require("fs");
const { relocateDir } = require("./win-safe-fs");
const { distRoot } = require("./build-paths");

function main() {
  if (!fs.existsSync(distRoot)) {
    console.log("[clean-dist-safe] No hay carpeta dist; nada que limpiar.");
    return;
  }
  const ok = relocateDir(distRoot);
  if (!ok) {
    console.error(
      "[clean-dist-safe] No se pudo mover apps/desktop/dist (¿tienes abierto el .exe, Explorer dentro de dist, o antivirus bloqueando?).\n" +
        "Cierra «Cotizaciones PFV Avanzada» y cualquier ventana de esa carpeta, luego vuelve a ejecutar el build.",
    );
    process.exit(1);
  }
  fs.mkdirSync(distRoot, { recursive: true });
  console.log("[clean-dist-safe] dist anterior movida a dist.__stale__.* — lista vacía nueva.");
}

main();

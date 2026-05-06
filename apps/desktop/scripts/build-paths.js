const path = require("path");

const desktopRoot = path.join(__dirname, "..");
const distRoot = path.join(desktopRoot, "dist");
const manifestPath = path.join(distRoot, ".desktop-build-manifest.json");

/** Carpeta oficial única para llevar a otro PC (sin espacios en el nombre de carpeta). */
const OFFICIAL_PORTABLE_DIR_NAME = "Cotizaciones-PFV-Portable";

module.exports = {
  desktopRoot,
  distRoot,
  manifestPath,
  OFFICIAL_PORTABLE_DIR_NAME,
};

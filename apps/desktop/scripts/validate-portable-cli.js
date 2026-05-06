/**
 * Valida dist/Cotizaciones-PFV-Portable tras un build (sin abrir el .exe).
 */
const path = require("path");
const { distRoot, OFFICIAL_PORTABLE_DIR_NAME } = require("./build-paths");
const { verifyPortableFolder } = require("./verify-portable-package");

const portableDir = path.join(distRoot, OFFICIAL_PORTABLE_DIR_NAME);
const allowPh = process.env.DESKTOP_BUILD_ALLOW_PLACEHOLDER_LICENSE_SECRET === "1";

try {
  const r = verifyPortableFolder(portableDir, { allowPlaceholderSecret: allowPh });
  console.log("[validate-portable] OK — ejecutable:", r.exeName);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}

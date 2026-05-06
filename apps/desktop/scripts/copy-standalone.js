/**
 * Copia .next/static y public al directorio que espera server.js en standalone.
 * En monorepo, server.js está en standalone/apps/web/ y hace process.chdir(__dirname),
 * por lo que espera .next y public en standalone/apps/web/, no en la raíz de standalone.
 * Ejecutar desde apps/desktop después de build --workspace=web con BUILD_DESKTOP=1.
 */
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..", "..", "web");
const standaloneDir = path.join(root, ".next", "standalone");
const appWebDir = path.join(standaloneDir, "apps", "web");
const staticSrc = path.join(root, ".next", "static");
const staticDst = path.join(appWebDir, ".next", "static");
const publicSrc = path.join(root, "public");
const publicDst = path.join(appWebDir, "public");

function copyRecursive(src, dst) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

if (!fs.existsSync(standaloneDir)) {
  console.error("No existe .next/standalone. Ejecuta primero: BUILD_DESKTOP=1 npm run build --workspace=web");
  process.exit(1);
}

if (!fs.existsSync(appWebDir)) {
  console.error("No existe standalone/apps/web. Revisa el build standalone.");
  process.exit(1);
}
if (fs.existsSync(staticSrc)) {
  fs.mkdirSync(path.dirname(staticDst), { recursive: true });
  copyRecursive(staticSrc, staticDst);
  console.log("Copiado .next/static -> standalone/apps/web/.next/static");
}
if (fs.existsSync(publicSrc)) {
  copyRecursive(publicSrc, publicDst);
  console.log("Copiado public -> standalone/apps/web/public");
} else {
  fs.mkdirSync(publicDst, { recursive: true });
  console.log("Creado directorio vacío standalone/apps/web/public");
}

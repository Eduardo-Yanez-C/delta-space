/**

 * Sincroniza apps/web/.next/standalone completo hacia win-unpacked/resources/standalone

 * (electron-builder no copia bien node_modules dentro de extraResources).

 *

 * Usa apps/desktop/dist/.desktop-build-manifest.json para localizar win-unpacked

 * (cada build usa dist/electron-out-<ts>/win-unpacked y evita locks en dist antigua).

 */

const path = require("path");

const fs = require("fs");

const { relocateDir } = require("./win-safe-fs");

const { getWinUnpackedPath } = require("./read-build-manifest");



const desktopRoot = path.join(__dirname, "..");

const standaloneSrc = path.join(desktopRoot, "..", "web", ".next", "standalone");



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



if (!fs.existsSync(standaloneSrc)) {

  console.error(

    "[ensure-standalone-in-dist] No existe apps/web/.next/standalone. " +

      "Ejecuta: cross-env BUILD_DESKTOP=1 npm run build --workspace=web && npm run prepare-standalone --workspace=desktop",

  );

  process.exit(1);

}



const nextPkg = path.join(standaloneSrc, "node_modules", "next", "package.json");

if (!fs.existsSync(nextPkg)) {

  console.error(

    "[ensure-standalone-in-dist] El standalone de Next no incluye node_modules/next. " +

      "Rehaz el build web con BUILD_DESKTOP=1.",

  );

  process.exit(1);

}



const resolved = getWinUnpackedPath();

if (!resolved) {

  console.error(

    "[ensure-standalone-in-dist] No hay win-unpacked. Ejecute antes: npm run build --workspace=desktop (run-electron-build).",

  );

  process.exit(1);

}



const { winUnpacked } = resolved;

const standaloneDest = path.join(winUnpacked, "resources", "standalone");



console.log("[ensure-standalone-in-dist] Sincronizando standalone completo:");

console.log("  desde:", standaloneSrc);

console.log("  hacia:", standaloneDest);



if (fs.existsSync(standaloneDest)) {

  if (!relocateDir(standaloneDest)) {

    console.error(

      "[ensure-standalone-in-dist] No se pudo mover standalone anterior (archivo en uso). Cierre la app y reintente.",

    );

    process.exit(1);

  }

}

copyRecursive(standaloneSrc, standaloneDest);



const nextPkgOut = path.join(standaloneDest, "node_modules", "next", "package.json");

if (!fs.existsSync(nextPkgOut)) {

  console.error("[ensure-standalone-in-dist] FATAL: tras copiar, sigue sin existir node_modules/next.");

  process.exit(1);

}



console.log("[ensure-standalone-in-dist] OK (next presente en el portable).");


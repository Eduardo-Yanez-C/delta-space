/**
 * Comprueba que en el standalone existan apps/web/public y apps/web/.next/static,
 * que son las rutas que espera server.js (cwd = apps/web).
 * Uso: node scripts/validate-standalone.js [ruta]
 * Sin argumentos: valida apps/web/.next/standalone (origen).
 * Con argumentos: valida la ruta dada (ej. dist/win-unpacked/resources/standalone).
 */
const path = require("path");
const fs = require("fs");

const defaultStandalone = path.join(__dirname, "..", "..", "web", ".next", "standalone");
const target = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : defaultStandalone;

const required = [
  ["apps", "web", "public"],
  ["apps", "web", ".next", "static"],
  /** Next standalone: require("next") se resuelve desde la raíz del standalone, no solo apps/web */
  ["node_modules", "next", "package.json"],
];

let failed = false;
for (const parts of required) {
  const dir = path.join(target, ...parts);
  const exists = fs.existsSync(dir);
  const rel = path.relative(process.cwd(), dir);
  if (!exists) {
    console.error("FALTA:", rel);
    failed = true;
  } else {
    console.log("OK:", rel);
  }
}

if (failed) {
  process.exit(1);
}
console.log("Validación OK: public, .next/static y node_modules/next presentes en standalone.");

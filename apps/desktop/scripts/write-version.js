/**
 * Escribe version.txt en la raíz de desktop con la versión de package.json.
 * Se ejecuta antes de electron-builder para que version.txt entre en resources.
 */
const path = require("path");
const fs = require("fs");

const pkgPath = path.join(__dirname, "..", "package.json");
const outPath = path.join(__dirname, "..", "version.txt");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version || "0.0.0";
fs.writeFileSync(outPath, version.trim() + "\n", "utf8");
console.log("version.txt escrito:", version);

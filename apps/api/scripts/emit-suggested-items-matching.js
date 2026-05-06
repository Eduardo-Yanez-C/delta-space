const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcPath = path.join(root, "dist/modules/fv-study/suggested-items-matching.js");
const outPath = path.join(root, "src/modules/fv-study/suggested-items-matching.ts");

let b = fs.readFileSync(srcPath, "utf8");
const i = b.indexOf("function toNum");
if (i < 0) throw new Error("function toNum not found");
b = b.slice(i);

const exportAsync = [
  "resolveCategoryId",
  "getCurrentPriceForProduct",
  "resolvePanelCandidate",
  "resolveInverterCandidate",
  "resolveStructureCandidate",
];
const exportSync = [
  "extractWpFromText",
  "extractKwFromText",
  "productMatchesConnectionType",
  "productMatchesMountingType",
];
for (const name of exportAsync) {
  b = b.replace(new RegExp(`^async function ${name}`, "m"), `export async function ${name}`);
}
for (const name of exportSync) {
  b = b.replace(new RegExp(`^function ${name}`, "m"), `export function ${name}`);
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, b, "utf8");
console.log("Wrote", outPath);

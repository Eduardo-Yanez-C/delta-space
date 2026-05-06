/**
 * One-off helper: reads a Nest-compiled *.service.js (or similar) from dist and emits
 * a TypeScript file with ESM-style imports and @Injectable / export class.
 * Preserves method bodies (logic) verbatim from the JS source.
 */
const fs = require("fs");
const path = require("path");

function emit({ distRel, outRel, className, injectable, importsHeader }) {
  const root = path.join(__dirname, "..");
  const srcPath = path.join(root, "dist", distRel);
  const outPath = path.join(root, "src", outRel);
  let s = fs.readFileSync(srcPath, "utf8");
  const letNeedle = `let ${className} = class`;
  const i = s.indexOf(letNeedle);
  if (i < 0) throw new Error(`Class ${className} not found in ${srcPath}`);
  const tail = s.slice(i);
  const expNeedle = `exports.${className} = ${className}`;
  const j = tail.indexOf(expNeedle);
  if (j < 0) throw new Error(`Export footer not found for ${className}`);
  let classBlock = tail.slice(0, j);
  classBlock = classBlock.replace(
    `let ${className} = class`,
    `${injectable ? "@Injectable()\n" : ""}export class ${className}`,
  );
  classBlock = classBlock.replace(/\s*;\s*$/, "");
  const out = `${importsHeader}\n\n${classBlock}\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, out, "utf8");
  console.log("Wrote", outPath);
}

module.exports = { emit };

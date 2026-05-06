/**
 * One-off: analizar Excel de contrato transporte (SheetJS).
 * Uso: node scripts/dump-excel-analysis.mjs "ruta.xlsx"
 */
import * as fs from "node:fs";
import * as path from "node:path";
import XLSX from "xlsx";

const filePath = process.argv[2];
if (!filePath || !fs.existsSync(filePath)) {
  console.error("Uso: node scripts/dump-excel-analysis.mjs <ruta.xlsx>");
  process.exit(1);
}

const wb = XLSX.readFile(filePath, {
  cellDates: true,
  cellFormula: true,
  cellNF: true,
  sheetStubs: true,
});

const out = {
  file: path.basename(filePath),
  sheetNames: wb.SheetNames,
  definedNames: [],
  sheets: [],
};

if (wb.Workbook?.Names?.length) {
  for (const n of wb.Workbook.Names) {
    out.definedNames.push({
      name: n.Name,
      ref: n.Ref,
      sheet: n.Sheet,
    });
  }
}

function colLetter(n) {
  let s = "";
  for (let x = n + 1; x > 0; x = Math.floor((x - 1) / 26)) {
    s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  }
  return s;
}

for (const sheetName of wb.SheetNames) {
  const ws = wb.Sheets[sheetName];
  const ref = ws["!ref"];
  if (!ref) {
    out.sheets.push({ name: sheetName, ref: null, rows: 0, cols: 0, formulas: [], gridSample: [] });
    continue;
  }
  const range = XLSX.utils.decode_range(ref);
  const nRows = range.e.r - range.s.r + 1;
  const nCols = range.e.c - range.s.c + 1;

  const formulas = [];
  const merges = ws["!merges"]?.length ?? 0;

  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (cell?.f) {
        const v = cell.v;
        const t = cell.t;
        formulas.push({
          cell: addr,
          formula: cell.f,
          value: v,
          type: t,
          w: cell.w,
        });
      }
    }
  }

  const maxDumpR = Math.min(range.s.r + 45, range.e.r);
  const maxDumpC = Math.min(range.s.c + 18, range.e.c);
  const grid = [];
  for (let R = range.s.r; R <= maxDumpR; R++) {
    const row = [];
    for (let C = range.s.c; C <= maxDumpC; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[addr];
      if (!cell) {
        row.push("");
        continue;
      }
      if (cell.f) row.push({ f: cell.f, v: cell.v, w: cell.w });
      else row.push(cell.w ?? cell.v ?? "");
    }
    grid.push(row);
  }

  out.sheets.push({
    name: sheetName,
    ref,
    rowCount: nRows,
    colCount: nCols,
    merges,
    formulaCount: formulas.length,
    formulasSample: formulas.slice(0, 120),
    formulasRest: Math.max(0, formulas.length - 120),
    gridSample45x19: grid,
  });
}

process.stdout.write(JSON.stringify(out, null, 2));

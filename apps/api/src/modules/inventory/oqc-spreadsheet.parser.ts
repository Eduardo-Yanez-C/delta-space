import * as XLSX from "xlsx";
import type { OqcPresetPanelRow } from "./oqc-preset-ege2026-2356";

const MAX_ROWS = 20_000;

function normKey(k: string): string {
  return String(k)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/[()]/g, " ");
}

function buildNormMap(row: Record<string, unknown>): Map<string, unknown> {
  const m = new Map<string, unknown>();
  for (const k of Object.keys(row)) {
    m.set(normKey(k), row[k]);
  }
  return m;
}

function getCell(m: Map<string, unknown>, patterns: RegExp[]): unknown {
  for (const [key, val] of m) {
    for (const p of patterns) {
      if (p.test(key)) return val;
    }
  }
  return undefined;
}

function parseNum(x: unknown): number | undefined {
  if (x == null || x === "") return undefined;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  let s = String(x).trim().replace(/%$/g, "").replace(/\s/g, "");
  s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function parseSerial(x: unknown): string {
  const s = String(x ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  return s;
}

function looksLikeDataSerial(serial: string): boolean {
  if (serial.length < 6 || serial.length > 80) return false;
  if (/^serial(\s*number)?$/i.test(serial)) return false;
  if (/^item\s*n$/i.test(serial)) return false;
  if (/^pallet/i.test(serial)) return false;
  if (/^ff$/i.test(serial)) return false;
  return /^[A-Z0-9][A-Z0-9._\-/]+$/i.test(serial);
}

/** Factor de llenado a veces viene como 0,802 en Excel en lugar de 80,2 %. */
function normalizeFillFactorPercent(raw: number | undefined): number | undefined {
  if (raw == null || !Number.isFinite(raw)) return undefined;
  if (raw > 0 && raw <= 1.000001) return raw * 100;
  return raw;
}

function cellStr(c: unknown): string {
  return String(c ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
}

/**
 * Algunas planillas traen portada / resumen / tablas de inspección y recién después el bloque
 * «N° Ítem | Número de Serie | …». Buscamos esa fila de cabecera (0-based) para usar `range` en sheetjs.
 */
function isLikelyOqcHeaderRow(row: unknown[]): boolean {
  const texts = row.map((c) =>
    cellStr(c)
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/\s+/g, " "),
  );
  const hasSerial = texts.some(
    (t) =>
      t.includes("numero de serie") ||
      /serial\s*number/.test(t) ||
      t === "serial" ||
      /\bs\/n\b/.test(t) ||
      /^sn$/.test(t) ||
      /\bbarcode\b/.test(t),
  );
  const hasItem = texts.some((t) => /n[°o]?\s*item/.test(t));
  const hasMetricHint = texts.some(
    (t) =>
      /factor(\s+de)?\s*llenado/.test(t) ||
      /\bfill\s*factor\b/.test(t) ||
      /\bff\b/.test(t) ||
      /\bisc\b/.test(t) ||
      /n[°o]?\s*pallet/.test(t) ||
      /\bpallet\b/.test(t),
  );
  return hasSerial && hasItem && hasMetricHint;
}

/** Una fila física de la hoja (índice 0-based de fila Excel), leyendo todas las columnas del rango usado. */
function readSheetRowDisplayValues(ws: XLSX.WorkSheet, row0: number): unknown[] {
  if (ws["!ref"] == null) return [];
  const d = XLSX.utils.decode_range(ws["!ref"]);
  const rr = XLSX.utils.encode_row(row0);
  const out: unknown[] = [];
  for (let c = d.s.c; c <= d.e.c; c++) {
    const addr = XLSX.utils.encode_col(c) + rr;
    const cell = ws[addr] as { w?: string; v?: unknown } | undefined;
    if (cell == null) {
      out.push("");
      continue;
    }
    const w = cell.w != null ? String(cell.w) : cell.v != null ? String(cell.v) : "";
    out.push(w);
  }
  return out;
}

/**
 * Fila absoluta (0-based, como en `decode_range` / opción numérica `range` de sheet_to_json)
 * donde está la cabecera OQC. No usar índices de `sheet_to_json(..., { header: 1 })` porque con
 * `blankrows: false` no coinciden 1:1 con las filas de la hoja.
 */
function findOqcHeaderAbsoluteRow0(ws: XLSX.WorkSheet): number | null {
  if (ws["!ref"] == null) return null;
  const d = XLSX.utils.decode_range(ws["!ref"]);
  const last = Math.min(d.s.r + 500, d.e.r);
  for (let R = d.s.r; R <= last; R++) {
    const row = readSheetRowDisplayValues(ws, R);
    if (isLikelyOqcHeaderRow(row)) return R;
  }
  return null;
}

/** Normaliza texto de celda para comparar etiquetas de portada (sin tildes ni dobles espacios). */
function normSheetLabelText(s: string): string {
  return cellStr(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .replace(/[:：]\s*$/g, "")
    .trim();
}

/**
 * Planillas tipo informe OQC ponen «Nombre producto» / «Nombre del producto» en la portada (p. ej. A1)
 * y el valor en la celda siguiente (B1), no como columna de la tabla de seriales (más abajo).
 */
function extractDocumentProductNameFromSheetTop(ws: XLSX.WorkSheet, oqcHeaderRow0: number | null): string | undefined {
  if (ws["!ref"] == null) return undefined;
  const d = XLSX.utils.decode_range(ws["!ref"]);
  const lastScanRow =
    oqcHeaderRow0 != null && oqcHeaderRow0 > d.s.r
      ? Math.min(oqcHeaderRow0 - 1, d.e.r)
      : Math.min(d.s.r + 40, d.e.r);

  const labelRes = [
    /^nombre\s+del\s+producto$/,
    /^nombre\s+de\s+producto$/,
    /^nombre\s+producto$/,
    /^product\s+name$/,
    /^commercial\s+name$/,
  ];

  for (let R = d.s.r; R <= lastScanRow; R++) {
    const row = readSheetRowDisplayValues(ws, R);
    for (let i = 0; i < row.length; i++) {
      const lab = normSheetLabelText(String(row[i] ?? ""));
      if (!lab) continue;
      if (!labelRes.some((re) => re.test(lab))) continue;
      const rawNext = row[i + 1];
      let val = cellStr(rawNext);
      if (!val || val === "—" || val === "-") continue;
      const valNorm = normSheetLabelText(val);
      if (labelRes.some((re) => re.test(valNorm))) continue;
      if (val.length > 240) val = `${val.slice(0, 237)}…`;
      return val;
    }
  }
  return undefined;
}

function rowToPanel(row: Record<string, unknown>, fallbackItemN: number): OqcPresetPanelRow | null {
  const m = buildNormMap(row);
  const serial = parseSerial(
    getCell(m, [
      /n[uú]mero de serie/i,
      /serial\s*number/i,
      /^serial$/i,
      /序列号/,
      /\bs\/n\b/i,
      /^sn$/i,
      /barcode/i,
    ]),
  );
  if (!looksLikeDataSerial(serial)) return null;

  const palletRaw = getCell(m, [/pallet/i, /托盘/, /栈板/, /板号/]);
  const pallet = String(palletRaw ?? "")
    .trim()
    .replace(/\u00a0/g, " ");
  const palletNumber = pallet && pallet !== "—" && pallet !== "-" ? pallet : "—";

  const itemN =
    parseNum(
      getCell(m, [
        /n[°º]?\s*ítem/i,
        /n[°º]?\s*item/i,
        /^item\s*n/i,
        /^#?\s*item\s*n/i,
        /^no\.?\s*item/i,
        /序号/,
        /^nº?\s*item/i,
      ]),
    ) ?? fallbackItemN;

  const ffPercent = normalizeFillFactorPercent(
    parseNum(getCell(m, [/fill\s*factor/i, /factor de llenado/i, /llenado/i, /^ff\b/i, /ff\s*%/i, /填充因子/])),
  );
  const isc = parseNum(getCell(m, [/\bisc\b/i, /短路电流/i]));
  const voc = parseNum(getCell(m, [/\bvoc\b/i, /开路电压/i]));
  const imp = parseNum(getCell(m, [/\bimp\b/i, /closed\s*circuit.*current/i, /最大.*点.*流/i]));
  const vmp = parseNum(getCell(m, [/\bvmp\b/i, /最大功率点.*压/i]));
  const pmW = parseNum(
    getCell(m, [
      /\bpm\b/i,
      /maximum\s*power\s*\(?\s*pm\s*\)?/i,
      /max\.?\s*power\s*\(?\s*pm\s*\)?/i,
      /最大功率/i,
      /功率\s*\(?w\)?/i,
      /^pmax$/i,
    ]),
  );

  const nameRaw = getCell(m, [
    /nombre del producto/i,
    /nombre de producto/i,
    /nombre producto/i,
    /^product name$/i,
    /nombre comercial/i,
    /descripcion del producto/i,
    /descripción del producto/i,
    /产品名称/,
    /品名/,
  ]);
  let sheetProductName: string | undefined;
  if (nameRaw != null && nameRaw !== "") {
    let s = String(nameRaw)
      .trim()
      .replace(/\u00a0/g, " ");
    if (s && s !== serial && s !== "—" && s !== "-") {
      if (s.length > 240) s = `${s.slice(0, 237)}…`;
      sheetProductName = s;
    }
  }

  return {
    itemN: Number.isFinite(itemN) ? Math.trunc(itemN) : fallbackItemN,
    serialNumber: serial,
    palletNumber,
    ffPercent,
    isc,
    voc,
    imp,
    vmp,
    pmW,
    sheetProductName,
  };
}

/**
 * Interpreta la primera hoja (o la que más filas válidas tenga) de un CSV/XLS/XLSX
 * con columnas tipo informe OQC (inglés, español —p. ej. «Número de Serie», «Factor de Llenado (%)»— o cabeceras chinas habituales).
 */
export function parseOqcShipmentBuffer(buffer: Buffer, originalName: string): {
  panels: OqcPresetPanelRow[];
  sheetsTried: string[];
  parseWarnings: string[];
} {
  const name = (originalName || "import").toLowerCase();
  if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
    throw new Error("Solo se admiten archivos .csv, .xlsx o .xls");
  }

  const wb = XLSX.read(buffer, { type: "buffer", raw: false, codepage: 65001 });
  if (!wb.SheetNames.length) throw new Error("El archivo no contiene hojas");

  const parseWarnings: string[] = [];
  let best: OqcPresetPanelRow[] = [];
  const sheetsTried: string[] = [];

  for (const sheetName of wb.SheetNames) {
    sheetsTried.push(sheetName);
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;

    const objectAttempts: { label: string; rows: Record<string, unknown>[] }[] = [
      {
        label: "primera fila como cabecera",
        rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", blankrows: false }),
      },
    ];
    const headerAbsRow0 = findOqcHeaderAbsoluteRow0(ws);
    if (headerAbsRow0 != null && headerAbsRow0 > 0) {
      objectAttempts.push({
        label: `cabecera OQC detectada en fila ${headerAbsRow0 + 1} (1-based Excel)`,
        rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
          blankrows: false,
          range: headerAbsRow0,
        }),
      });
    }

    let sheetBest: OqcPresetPanelRow[] = [];
    let sheetBestDup = 0;
    let sheetBestLabel = objectAttempts[0]?.label ?? "";

    for (const attempt of objectAttempts) {
      const panels: OqcPresetPanelRow[] = [];
      const seen = new Set<string>();
      let duplicateSerialRows = 0;
      let n = 0;
      for (const obj of attempt.rows) {
        n += 1;
        if (n > MAX_ROWS + 500) {
          parseWarnings.push(`Hoja «${sheetName}»: se ignoraron filas tras ${MAX_ROWS} filas de datos.`);
          break;
        }
        const p = rowToPanel(obj, panels.length + 1);
        if (!p) continue;
        if (seen.has(p.serialNumber)) {
          duplicateSerialRows += 1;
          continue;
        }
        seen.add(p.serialNumber);
        panels.push(p);
        if (panels.length >= MAX_ROWS) break;
      }
      if (panels.length > sheetBest.length) {
        sheetBest = panels;
        sheetBestDup = duplicateSerialRows;
        sheetBestLabel = attempt.label;
      }
    }

    const docProductName = extractDocumentProductNameFromSheetTop(ws, headerAbsRow0);
    if (docProductName && sheetBest.length) {
      const dn = docProductName.trim().slice(0, 240);
      sheetBest = sheetBest.map((p) => (p.sheetProductName?.trim() ? p : { ...p, sheetProductName: dn }));
    }

    if (sheetBestDup > 0) {
      parseWarnings.push(
        `Hoja «${sheetName}»: ${sheetBestDup} fila(s) con el mismo número de serie que una fila anterior; solo se conserva la primera aparición.`,
      );
    }
    if (headerAbsRow0 != null && headerAbsRow0 > 0 && sheetBestLabel !== "primera fila como cabecera") {
      parseWarnings.push(
        `Hoja «${sheetName}»: la tabla de paneles OQC no empieza en la fila 1; se usó la cabecera de la fila ${headerAbsRow0 + 1} (formato planilla completa / informe).`,
      );
    }
    if (sheetBest.length > best.length) best = sheetBest;
  }

  if (best.length === 0) {
    throw new Error(
      "No se detectaron filas con número de serie válido. Compruebe que la primera fila tenga encabezados (p. ej. «Número de Serie» o «Serial Number», «N° Pallet», FF / Factor de llenado, Isc, Voc, Imp, Vmp, Pm) y que los datos empiecen debajo.",
    );
  }

  return { panels: best, sheetsTried, parseWarnings };
}

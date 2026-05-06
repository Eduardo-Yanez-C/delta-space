import * as XLSX from "xlsx";

export type LogisticsSummary = {
  headline: string;
  productLine: string;
  panelCount: number;
  palletCount: number;
  routeText: string;
  orderRef: string | null;
};

export type LogisticsParsedPayload = {
  summary: LogisticsSummary;
  panels: Record<string, unknown>[];
  pallets: Record<string, unknown>[];
  shipments: Record<string, unknown>[];
  groundTransport: Record<string, unknown>[];
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

/** Convierte serial de Excel a YYYY-MM-DD si parece fecha (>= 40000 ≈ 2009). */
function maybeExcelDate(v: unknown, key: string): unknown {
  if (typeof v !== "number" || !Number.isFinite(v)) return v;
  const k = key
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  if (!k.includes("fecha") && !k.includes("despacho")) return v;
  if (v < 35000 || v > 65000) return v;
  const ms = (v - 25569) * 86400 * 1000;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return v;
  return d.toISOString().slice(0, 10);
}

function normalizeRow(headers: string[], row: unknown[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < headers.length; i++) {
    let h = (headers[i] ?? "").trim();
    if (!h) h = `_c${i}`;
    let val = row[i] ?? null;
    val = maybeExcelDate(val, h);
    out[h] = val;
  }
  return out;
}

function matrixFromSheet(sheet: XLSX.WorkSheet | undefined): unknown[][] {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: true });
}

function findHeaderRowIndex(matrix: unknown[][], predicate: (row: unknown[]) => boolean): number {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!Array.isArray(row)) continue;
    if (predicate(row)) return i;
  }
  return -1;
}

function extractOrderRef(texts: string[]): string | null {
  const joined = texts.join(" ");
  const m = joined.match(/\bN-\d+\b/i);
  return m ? m[0].toUpperCase() : null;
}

function parseResumen(matrix: unknown[][], summary: Partial<LogisticsSummary>): void {
  const texts: string[] = [];
  for (const row of matrix.slice(0, 25)) {
    if (!Array.isArray(row)) continue;
    for (const c of row) texts.push(cellStr(c));
  }
  const orderRef = extractOrderRef(texts);
  if (orderRef) summary.orderRef = orderRef;
  for (const row of matrix.slice(0, 15)) {
    if (!Array.isArray(row)) continue;
    const line = row.map(cellStr).filter(Boolean).join(" ");
    if (line.includes("RESUMEN") || line.includes("ORDEN")) summary.headline = line || summary.headline;
    if (/\d[\d.,]*\s*paneles/i.test(line) || line.includes("pallets")) {
      summary.routeText = line;
      const pm = line.match(/([\d.,]+)\s*paneles/i);
      const plm = line.match(/([\d.,]+)\s*pallets/i);
      if (pm) summary.panelCount = Number(pm[1].replace(/\./g, "").replace(/,/g, ""));
      if (plm) summary.palletCount = Number(plm[1].replace(/\./g, "").replace(/,/g, ""));
    }
    if (/EGE-|GM\d+|W-\d+/i.test(line) && line.length < 120) summary.productLine = line;
  }
}

function isPanelHeaderRow(row: unknown[]): boolean {
  return row.some((c) => {
    const s = cellStr(c).toLowerCase();
    return (
      (s.includes("número") && s.includes("serie")) ||
      (s.includes("numero") && s.includes("serie")) ||
      /^n[°º]?\s*serie$/i.test(s) ||
      s === "serial"
    );
  });
}

function panelSerialFromObject(obj: Record<string, unknown>): string {
  for (const [k, v] of Object.entries(obj)) {
    const low = k.toLowerCase();
    if ((low.includes("número") || low.includes("numero")) && low.includes("serie")) return cellStr(v);
  }
  for (const [k, v] of Object.entries(obj)) {
    const low = k.toLowerCase();
    if (low.includes("serie") && !low.includes("pallet")) return cellStr(v);
  }
  return "";
}

function parsePanelsSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = matrixFromSheet(sheet);
  if (matrix.length < 2) return [];
  let hi = findHeaderRowIndex(matrix, isPanelHeaderRow);
  if (hi < 0) hi = 0;
  const headers = (matrix[hi] as unknown[]).map((h) => cellStr(h));
  const out: Record<string, unknown>[] = [];
  for (let r = hi + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    if (!row?.length) continue;
    const obj = normalizeRow(headers, row);
    if (Object.keys(obj).length === 0) continue;
    const serial = panelSerialFromObject(obj);
    if (!serial) continue;
    out.push(obj);
  }
  return out;
}

function isPalletHeaderRow(row: unknown[]): boolean {
  return row.some((c) => {
    const t = cellStr(c);
    const l = t.toLowerCase();
    return (
      (l.includes("pallet") && (l.includes("id") || l.includes("n°") || l.includes("nº"))) ||
      t === "N° Pallet (ID)" ||
      /^n[°º]?\s*pallet/i.test(t)
    );
  });
}

function headerPalletColumnIndex(headers: string[]): number {
  const idx = headers.findIndex((h) => {
    const l = h.toLowerCase();
    return (l.includes("pallet") && l.includes("id")) || /^n[°º]?\s*pallet/i.test(h);
  });
  return idx >= 0 ? idx : 0;
}

function parsePalletsSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = matrixFromSheet(sheet);
  let hi = findHeaderRowIndex(matrix, isPalletHeaderRow);
  if (hi < 0) {
    hi = findHeaderRowIndex(matrix, (row) => cellStr(row[0]) === "N° Pallet (ID)" || cellStr(row[0]).includes("Pallet"));
  }
  if (hi < 0) return [];
  const headers = (matrix[hi] as unknown[]).map((h) => cellStr(h));
  const palletCol = headerPalletColumnIndex(headers);
  const out: Record<string, unknown>[] = [];
  for (let r = hi + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const id = cellStr(row[palletCol]);
    if (!id) continue;
    out.push(normalizeRow(headers, row));
  }
  return out;
}

function parseDatosBaseSheet(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = matrixFromSheet(sheet);
  const hi = findHeaderRowIndex(matrix, (row) => {
    const a = cellStr(row[0]);
    return a.includes("ID Embarque") || a.includes("Embarque");
  });
  if (hi < 0) return [];
  const headers = (matrix[hi] as unknown[]).map((h) => cellStr(h).replace(/\s+/g, " "));
  const out: Record<string, unknown>[] = [];
  for (let r = hi + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const id = cellStr(row[0]);
    if (!id || id.startsWith("🔒") || id === "ID") continue;
    out.push(normalizeRow(headers, row));
  }
  return out;
}

function isGroundTransportHeaderRow(row: unknown[]): boolean {
  const joined = row.map(cellStr).join("|").toLowerCase();
  return joined.includes("transportista") && (joined.includes("conductor") || joined.includes("pallet") || joined.includes("patente"));
}

function parseRegistroTransporte(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const matrix = matrixFromSheet(sheet);
  let hi = findHeaderRowIndex(matrix, isGroundTransportHeaderRow);
  if (hi < 0) {
    hi = findHeaderRowIndex(matrix, (row) => cellStr(row[1]) === "Seq." || cellStr(row[1]).includes("Seq"));
  }
  if (hi < 0) return [];
  const headers = (matrix[hi] as unknown[]).map((h) => cellStr(h));
  let palletIdx = headers.findIndex((h) => {
    const l = h.toLowerCase();
    return (l.includes("pallet") && l.includes("id")) || /^n[°º]?\s*pallet/i.test(h);
  });
  if (palletIdx < 0) palletIdx = 2;
  const out: Record<string, unknown>[] = [];
  for (let r = hi + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const palletId = cellStr(row[palletIdx]);
    if (!palletId) continue;
    out.push(normalizeRow(headers, row));
  }
  return out;
}

export function parseLogisticaInternacionalWorkbook(wb: XLSX.WorkBook): LogisticsParsedPayload {
  const panelsSheet = wb.Sheets["Base Paneles"];
  const palletsSheet = wb.Sheets["Base Pallets"];
  if (!panelsSheet || !palletsSheet) {
    throw new Error("El archivo debe contener las hojas «Base Paneles» y «Base Pallets» (plantilla Logística internacional).");
  }

  const panels = parsePanelsSheet(panelsSheet);
  const pallets = parsePalletsSheet(palletsSheet);
  const datosBase = wb.Sheets["Datos Base"] ? parseDatosBaseSheet(wb.Sheets["Datos Base"]) : [];
  const transportSheet = wb.Sheets["Registro Transporte"];
  const groundTransport = transportSheet ? parseRegistroTransporte(transportSheet) : [];

  const summary: LogisticsSummary = {
    headline: "",
    productLine: "",
    panelCount: panels.length,
    palletCount: pallets.length,
    routeText: "",
    orderRef: null,
  };

  const resumen = wb.Sheets["Resumen Paneles"];
  if (resumen) parseResumen(matrixFromSheet(resumen), summary);

  if (!summary.orderRef && datosBase.length) {
    const first = datosBase[0];
    const pi = cellStr(first["N° PI / Proforma"]);
    const m = pi.match(/\bN-\d+\b/i);
    if (m) summary.orderRef = m[0].toUpperCase();
  }

  if (!summary.panelCount && panels.length) summary.panelCount = panels.length;
  if (!summary.palletCount && pallets.length) summary.palletCount = pallets.length;

  if (!summary.headline && summary.orderRef) {
    summary.headline = `Operación importación · ${summary.orderRef}`;
  }

  return { summary, panels, pallets, shipments: datosBase, groundTransport };
}

export function parseLogisticaInternacionalBuffer(buf: Buffer): LogisticsParsedPayload {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  return parseLogisticaInternacionalWorkbook(wb);
}

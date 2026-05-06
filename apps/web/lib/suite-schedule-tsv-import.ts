/**
 * Vista previa local del mismo formato que el API (`parseScheduleDelimitedText`).
 * Primera fila = cabeceras; delimitador: tab, `;` o `,`.
 */

export type SuiteScheduleImportRow = {
  name: string;
  startDate: string;
  endDate: string;
  wbsCode?: string | null;
};

function normHeader(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function parseFlexibleDate(raw: string): string {
  const t = raw.trim();
  if (!t) throw new Error("Fecha vacía");
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) throw new Error(`Fecha inválida: ${raw}`);
    return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha no reconocida: ${raw}`);
  return d.toISOString().slice(0, 10);
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim().length > 0);
}

function splitRow(line: string): string[] {
  const tabCount = (line.match(/\t/g) ?? []).length;
  if (tabCount >= 1) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  return line.split(",").map((c) => c.trim());
}

const NAME_KEYS = new Set([
  "name",
  "nombre",
  "tarea",
  "task",
  "titulo",
  "title",
  "actividad",
  "descripcion",
  "description",
]);
const START_KEYS = new Set(["start", "inicio", "startdate", "fecha_inicio", "desde", "comienzo"]);
const END_KEYS = new Set(["end", "fin", "enddate", "fecha_fin", "hasta", "termino", "termino"]);
const WBS_KEYS = new Set(["wbs", "wbscode", "codigo_wbs", "codigo", "id_wbs", "pos"]);

export function parseSuiteScheduleDelimitedText(
  text: string,
  maxRows = 350,
): { rows: SuiteScheduleImportRow[]; warnings: string[] } {
  const warnings: string[] = [];
  const lines = splitLines(text.trim());
  if (lines.length < 2) {
    throw new Error("El archivo debe tener cabecera y al menos una fila de datos.");
  }
  const headerCells = splitRow(lines[0]!);
  const normHeaders = headerCells.map(normHeader);
  const idx = (pred: (h: string) => boolean): number => normHeaders.findIndex(pred);

  const nameI = idx((h) => NAME_KEYS.has(h));
  const startI = idx((h) => START_KEYS.has(h));
  const endI = idx((h) => END_KEYS.has(h));
  const wbsI = idx((h) => WBS_KEYS.has(h));

  if (nameI < 0) {
    throw new Error("No se encontró columna de nombre de tarea. Use: nombre, tarea, name o title.");
  }
  if (startI < 0 || endI < 0) {
    throw new Error("Faltan columnas de fechas. Use inicio/fin, start/end (YYYY-MM-DD o DD/MM/AAAA).");
  }

  const rows: SuiteScheduleImportRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = splitRow(lines[li]!);
    const name = (cells[nameI] ?? "").trim();
    if (!name) continue;
    const startRaw = cells[startI] ?? "";
    const endRaw = cells[endI] ?? "";
    const wbsRaw = wbsI >= 0 ? (cells[wbsI] ?? "").trim() : "";
    try {
      const startDate = parseFlexibleDate(startRaw);
      const endDate = parseFlexibleDate(endRaw);
      rows.push({
        name,
        startDate,
        endDate,
        wbsCode: wbsRaw || null,
      });
    } catch (e) {
      warnings.push(`Fila ${li + 1} omitida (${name.slice(0, 40)}): ${e instanceof Error ? e.message : String(e)}`);
    }
    if (rows.length >= maxRows) {
      warnings.push(`Se analizaron como máximo ${maxRows} filas; el resto se ignoró.`);
      break;
    }
  }
  if (rows.length === 0) {
    throw new Error("No quedó ninguna fila válida tras el análisis del archivo.");
  }
  return { rows, warnings };
}

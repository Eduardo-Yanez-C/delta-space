"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../../lib/auth-context";
import {
  createInventoryItem,
  deduplicateInventorySerials,
  deleteInventoryItem,
  fetchCategories,
  fetchInventoryDuplicateSerials,
  fetchInventoryItems,
  fetchProduct,
  purgeProjectInventoryItems,
  relinkOqcInventoryCatalog,
  fetchProducts,
  fetchQuotes,
  fetchSuiteProjects,
  getApiBase,
  importOqcInventorySpreadsheet,
  updateInventoryItem,
  type Category,
  type CreateInventoryItemInput,
  type InventoryDestinationKind,
  type InventoryDuplicateSerialsResponse,
  type InventoryListRow,
  type Product,
  type QuoteListItem,
  type SuiteProjectRow,
} from "../../../../lib/api";
import {
  buildProductosNuevoHref,
  QUERY_LINK_PRODUCT,
} from "../../../../lib/catalog-inventory-flow";
import {
  filterProductsForInventoryPicker,
  flattenProductCategories,
  type InventoryProductPickerMode,
} from "../../../../lib/suite-inventory-catalog";
import { useCan } from "../../../../lib/useCan";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";
import {
  INVENTORY_LINE_SEGMENT_OPTIONS,
  TRACEABILITY_OQC_SERIAL_PANEL,
  TRACEABILITY_SUPPLIER_BOM_LINE,
  inferInventoryLineSegmentId,
  inventoryLineSegmentShortLabel,
  inventoryLineSegmentTitle,
  rowMatchesInventoryLineSegment,
  type InventoryLineSegmentFilter,
} from "../../../../lib/inventory-line-segment";
import { useSuiteAgentRuntime } from "../../../../components/suite-agent/SuiteAgentRuntimeProvider";
import { InventoryTableColumnsDrawer } from "../../../../components/logistica/InventoryTableColumnsDrawer";
import { SupplierBomImportModal } from "../../../../components/logistica/SupplierBomImportModal";

const DESTINO_LABEL: Record<InventoryDestinationKind, string> = {
  GENERAL: "Stock general",
  SALES_LOCAL: "Local ventas / mostrador",
  PROJECT: "Proyecto / obra",
  QUOTE: "Cotización",
  OTHER: "Otro (nota)",
};

const INVENTARIO_PATH = "/vista-previa-suite/logistica/inventario";
/** Detalle de producto bajo Logística (evita `/productos`, que el menú asocia a Ventas). */
const LOGISTICA_FICHA_PRODUCTO = "/vista-previa-suite/logistica/catalogo-producto";

/** Coincide con el informe OQC EGE 720 W (texto de respaldo si linksJson aún no trae productModel). */
const OQC_INVENTORY_MODEL_FALLBACK = "EGE-720W-132N (GM12)";

function inventoryRowOqcModelFromReport(row: InventoryListRow): string | null {
  let parsed: { traceability?: string; productModel?: string; reportRef?: string } | null = null;
  try {
    parsed = row.linksJson?.trim() ? JSON.parse(row.linksJson) : null;
  } catch {
    parsed = null;
  }
  const isOqcTrace = parsed?.traceability === TRACEABILITY_OQC_SERIAL_PANEL;
  const etnd = Boolean(row.sku?.trim() && /^ETND/i.test(row.sku.trim()));
  if (!isOqcTrace && !(etnd && /Trazabilidad OQC/i.test(row.destinationNote ?? ""))) return null;

  if (typeof parsed?.productModel === "string" && parsed.productModel.trim()) return parsed.productModel.trim();

  const desc = row.description?.trim() ?? "";
  if (/^Modelo fabricante:/i.test(desc)) {
    const head = (desc.split("\n")[0] ?? "").replace(/^Modelo fabricante:\s*/i, "").trim();
    const one = head.split(".").shift()?.trim();
    if (one) return one;
  }

  const ref = typeof parsed?.reportRef === "string" ? parsed.reportRef : "";
  const note = row.destinationNote ?? "";
  if (/720|20262356|ege2026/i.test(ref) || /720|20262356|ege2026/i.test(note)) return OQC_INVENTORY_MODEL_FALLBACK;

  return null;
}

/** Datos de planilla / informe OQC guardados en `linksJson` (trazabilidad por serial). */
type InventoryOqcParsed = {
  itemN: number | null;
  serialNumber: string | null;
  palletNumber: string | null;
  ffPercent: number | null;
  isc: number | null;
  voc: number | null;
  imp: number | null;
  vmp: number | null;
  pmW: number | null;
  reportRef: string | null;
  /** Reservado para cuando exista el módulo Logística → Transporte. */
  tripNumber: string | null;
  truckLabel: string | null;
  driverLabel: string | null;
  /** Nombre del archivo indicado al importar (no es URL). */
  sourceFileHint: string | null;
  /** Metadatos de importación (nube / auditoría). */
  sourceImportedByEmail: string | null;
  sourceImportedAt: string | null;
  /** Columna «Nombre del producto» u homónima en la planilla OQC. */
  sheetProductName: string | null;
};

const OQC_OPERATOR_NOTES_MARKER = "\n\n---\nNotas operativas:\n";

function splitOqcStoredDescription(stored: string | null): { technical: string; notes: string } {
  const s = stored ?? "";
  const i = s.indexOf(OQC_OPERATOR_NOTES_MARKER);
  if (i === -1) return { technical: s, notes: "" };
  return { technical: s.slice(0, i), notes: s.slice(i + OQC_OPERATOR_NOTES_MARKER.length) };
}

function mergeOqcStoredDescription(technical: string, notes: string): string | null {
  const t = technical.trimEnd();
  const n = notes.trim();
  if (!t && !n) return null;
  if (!n) return t || null;
  if (!t) return n;
  return `${t}${OQC_OPERATOR_NOTES_MARKER}${n}`;
}

function parseInventoryRowOqc(row: InventoryListRow): InventoryOqcParsed | null {
  let o: Record<string, unknown>;
  try {
    if (!row.linksJson?.trim()) return null;
    o = JSON.parse(row.linksJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.traceability !== TRACEABILITY_OQC_SERIAL_PANEL) return null;

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

  const itemRaw = num(o.itemN);
  return {
    itemN: itemRaw != null ? Math.trunc(itemRaw) : null,
    serialNumber: str(o.serialNumber) ?? (row.sku?.trim() || null),
    palletNumber: o.palletNumber != null && String(o.palletNumber).trim() ? String(o.palletNumber).trim() : null,
    ffPercent: num(o.ffPercent),
    isc: num(o.isc),
    voc: num(o.voc),
    imp: num(o.imp),
    vmp: num(o.vmp),
    pmW: num(o.pmW),
    reportRef: str(o.reportRef),
    tripNumber: str(o.tripNumber ?? o.transportTripNumber ?? o.viajeNumero),
    truckLabel: str(o.truckPlate ?? o.camion ?? o.vehiclePlate),
    driverLabel: str(o.conductor ?? o.driverName ?? o.chofer),
    sourceFileHint: str(o.sourceFileHint),
    sourceImportedByEmail: str(o.sourceImportedByEmail ?? o.importedByEmail),
    sourceImportedAt: str(o.sourceImportedAt ?? o.importedAt),
    sheetProductName: str(o.sheetProductName ?? o.nombreProductoPlanilla),
  };
}

/** Datos BOM proveedor en `linksJson` (Mibet, etc.). */
type InventorySupplierBomParsed = {
  bomLineNo: number | null;
  supplierQuoteRef: string | null;
  materialGrade: string | null;
  specText: string | null;
  unitWeightKg: number | null;
  totalWeightKg: number | null;
};

function parseInventoryRowSupplierBom(row: InventoryListRow): InventorySupplierBomParsed | null {
  let o: Record<string, unknown>;
  try {
    if (!row.linksJson?.trim()) return null;
    o = JSON.parse(row.linksJson) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (o.traceability !== TRACEABILITY_SUPPLIER_BOM_LINE) return null;
  const num = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  const bn = num(o.bomLineNo);
  return {
    bomLineNo: bn != null ? Math.trunc(bn) : null,
    supplierQuoteRef: str(o.supplierQuoteRef),
    materialGrade: str(o.materialGrade),
    specText: str(o.specText),
    unitWeightKg: num(o.unitWeightKg),
    totalWeightKg: num(o.totalWeightKg),
  };
}

function supplierBomMatSpecSummary(b: InventorySupplierBomParsed): string {
  return [b.materialGrade, b.specText].filter(Boolean).join(" · ");
}

/** Subtítulo bajo el serial: nombre de planilla o nombre de ítem útil (evita repetir solo «Panel OQC #…»). */
function inventorySerialColumnSubtitle(r: InventoryListRow): string | null {
  const oqc = parseInventoryRowOqc(r);
  if (oqc?.sheetProductName?.trim()) return oqc.sheetProductName.trim();
  if (parseInventoryRowSupplierBom(r) && r.name?.trim()) return r.name.trim();
  const n = r.name?.trim();
  if (!n) return null;
  if (/^Panel OQC #\d+\s*·\s*/i.test(n)) return null;
  return n;
}

function parseOqcFromLinksJson(linksJson: string | null | undefined, sku?: string | null): InventoryOqcParsed | null {
  return parseInventoryRowOqc({ linksJson: linksJson ?? "", sku: sku ?? null } as InventoryListRow);
}

/** Evita basura tipo 81.39999999999999 al mostrar o exportar. */
function roundFixed(value: number | null | undefined, decimals: number): string {
  if (value == null || !Number.isFinite(value)) return "";
  const m = 10 ** decimals;
  const n = Math.round(value * m) / m;
  return String(n);
}

function cellMetric(value: number | null | undefined, decimals: number): string {
  const s = roundFixed(value, decimals);
  return s === "" ? "—" : s;
}

function escapeCsvCell(raw: string): string {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildInventoryExportCsv(data: InventoryListRow[]): string {
  const headers = [
    "Serial",
    "N_ítem_informe",
    "Pallet",
    "FF_pct",
    "Isc_A",
    "Voc_V",
    "Imp_A",
    "Vmp_V",
    "Pm_W",
    "Ref_informe_OQC",
    "Viaje",
    "Camión",
    "Conductor",
    "Proyecto_codigo",
    "Proyecto_nombre",
    "Modelo_OQC",
    "Nombre_producto_planilla",
    "Destino",
    "Cantidad",
    "Unidad",
    "Nombre_ítem",
  ];
  const lines = [headers.join(",")];
  for (const r of data) {
    const oqc = parseInventoryRowOqc(r);
    const pallet =
      oqc?.palletNumber?.trim() ||
      (r.storageLocation?.trim().toLowerCase().startsWith("pallet") ? r.storageLocation.trim() : "") ||
      "";
    const model = inventoryRowOqcModelFromReport(r) ?? "";
    const row = [
      r.sku?.trim() ?? "",
      oqc?.itemN != null ? String(oqc.itemN) : "",
      pallet,
      oqc ? roundFixed(oqc.ffPercent, 2) : "",
      oqc ? roundFixed(oqc.isc, 2) : "",
      oqc ? roundFixed(oqc.voc, 2) : "",
      oqc ? roundFixed(oqc.imp, 2) : "",
      oqc ? roundFixed(oqc.vmp, 2) : "",
      oqc ? roundFixed(oqc.pmW, 2) : "",
      oqc?.reportRef ?? "",
      oqc?.tripNumber ?? "",
      oqc?.truckLabel ?? "",
      oqc?.driverLabel ?? "",
      r.project?.code ?? "",
      r.project?.name ?? "",
      model,
      oqc?.sheetProductName ?? "",
      DESTINO_LABEL[r.destinationKind as InventoryDestinationKind] ?? r.destinationKind,
      String(r.quantity),
      r.unit ?? "",
      r.name ?? "",
    ].map(escapeCsvCell);
    lines.push(row.join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.prompt("Copie manualmente:", text);
  }
}

/** Ordenación cliente en la tabla de inventario. */
type InventoryTableSortKey =
  | "serial"
  | "bomNo"
  | "bomCotiz"
  | "bomMatSpec"
  | "bomUnitKg"
  | "bomTotKg"
  | "itemN"
  | "pallet"
  | "ff"
  | "isc"
  | "voc"
  | "imp"
  | "vmp"
  | "pm"
  | "informe"
  | "transp"
  | "proy"
  | "modelo"
  | "cant"
  | "destino";

type InventoryTableSort = { key: InventoryTableSortKey; dir: "asc" | "desc" } | null;

function getInventoryRowSortComparable(r: InventoryListRow, key: InventoryTableSortKey): string | number {
  const bom = parseInventoryRowSupplierBom(r);
  const oqc = parseInventoryRowOqc(r);
  const pallet =
    oqc?.palletNumber?.trim() ||
    (r.storageLocation?.trim().toLowerCase().startsWith("pallet") ? r.storageLocation.trim() : "") ||
    "";
  switch (key) {
    case "serial":
      return (r.sku ?? "").toLowerCase();
    case "bomNo":
      return bom?.bomLineNo ?? -1e9;
    case "bomCotiz":
      return (bom?.supplierQuoteRef ?? "").toLowerCase();
    case "bomMatSpec":
      return bom ? supplierBomMatSpecSummary(bom).toLowerCase() : "";
    case "bomUnitKg":
      return bom?.unitWeightKg ?? -1e9;
    case "bomTotKg":
      return bom?.totalWeightKg ?? -1e9;
    case "itemN":
      return oqc?.itemN ?? -1e9;
    case "pallet":
      return pallet.toLowerCase();
    case "ff":
      return oqc?.ffPercent ?? -1e9;
    case "isc":
      return oqc?.isc ?? -1e9;
    case "voc":
      return oqc?.voc ?? -1e9;
    case "imp":
      return oqc?.imp ?? -1e9;
    case "vmp":
      return oqc?.vmp ?? -1e9;
    case "pm":
      return oqc?.pmW ?? -1e9;
    case "informe":
      return (oqc?.reportRef ?? "").toLowerCase();
    case "transp": {
      const t = oqc ? [oqc.tripNumber, oqc.truckLabel, oqc.driverLabel].filter(Boolean).join(" ") : "";
      return t.toLowerCase();
    }
    case "proy":
      return (r.project?.code ?? r.quote?.commercialNumber ?? "").toLowerCase();
    case "modelo": {
      const o = parseInventoryRowOqc(r);
      const sheet = o?.sheetProductName?.trim() ?? "";
      const tech = inventoryRowOqcModelFromReport(r) ?? r.product?.name ?? "";
      return `${sheet} ${tech}`.trim().toLowerCase();
    }
    case "cant":
      return Number.isFinite(r.quantity) ? r.quantity : 0;
    case "destino":
      return (DESTINO_LABEL[r.destinationKind as InventoryDestinationKind] ?? r.destinationKind).toLowerCase();
    default:
      return "";
  }
}

function compareInventoryRowsForSort(a: InventoryListRow, b: InventoryListRow, sort: InventoryTableSort): number {
  if (!sort) return 0;
  const va = getInventoryRowSortComparable(a, sort.key);
  const vb = getInventoryRowSortComparable(b, sort.key);
  let cmp = 0;
  if (typeof va === "number" && typeof vb === "number") {
    cmp = va === vb ? 0 : va < vb ? -1 : 1;
  } else {
    cmp = String(va).localeCompare(String(vb), "es", { numeric: true, sensitivity: "base" });
  }
  return sort.dir === "asc" ? cmp : -cmp;
}

function sortInventoryRows(list: InventoryListRow[], sort: InventoryTableSort): InventoryListRow[] {
  if (!sort) return list;
  return [...list].sort((a, b) => compareInventoryRowsForSort(a, b, sort));
}

/**
 * Si el filtro «Familia» está en «Todas» pero las filas visibles son homogéneas (solo BOM o solo OQC),
 * se puede aplicar el mismo layout de columnas que al filtrar por esa familia (evita columnas llenas de «—»).
 */
function homogeneousBomOrOqcLayoutSegment(rows: InventoryListRow[]): "supplier_bom" | "oqc_serial_panel" | null {
  if (rows.length === 0) return null;
  const first = inferInventoryLineSegmentId(rows[0]);
  if (first !== "supplier_bom" && first !== "oqc_serial_panel") return null;
  for (let i = 1; i < rows.length; i++) {
    if (inferInventoryLineSegmentId(rows[i]) !== first) return null;
  }
  return first;
}

const INVENTORY_TABLE_COL_WIDTHS_KEY = "suite-inventory-oqc-table-col-widths-v1";

/** Ancho mínimo por columna al redimensionar / cargar desde localStorage (evita encabezados ilegibles). */
const INVENTORY_COL_WIDTH_MIN = 52;

const DEFAULT_INVENTORY_COL_WIDTHS: Record<InventoryTableSortKey, number> = {
  serial: 168,
  bomNo: 52,
  bomCotiz: 100,
  bomMatSpec: 200,
  bomUnitKg: 72,
  bomTotKg: 80,
  itemN: 56,
  pallet: 132,
  ff: 68,
  isc: 64,
  voc: 64,
  imp: 64,
  vmp: 64,
  pm: 68,
  informe: 128,
  transp: 100,
  proy: 76,
  modelo: 140,
  cant: 58,
  destino: 104,
};

/** Orden fijo de columnas en la tabla (misma lógica que vista lista de tareas / planning). */
const INVENTORY_TABLE_COL_ORDER: InventoryTableSortKey[] = [
  "serial",
  "bomNo",
  "bomCotiz",
  "bomMatSpec",
  "bomUnitKg",
  "bomTotKg",
  "itemN",
  "pallet",
  "ff",
  "isc",
  "voc",
  "imp",
  "vmp",
  "pm",
  "informe",
  "transp",
  "proy",
  "modelo",
  "cant",
  "destino",
];

const INVENTORY_TABLE_COL_VISIBLE_KEY = "suite-inventory-table-col-visible-v2";

const DEFAULT_INVENTORY_COL_VISIBLE: Record<InventoryTableSortKey, boolean> = {
  serial: true,
  bomNo: false,
  bomCotiz: false,
  bomMatSpec: false,
  bomUnitKg: false,
  bomTotKg: false,
  itemN: true,
  pallet: true,
  ff: true,
  isc: true,
  voc: true,
  imp: true,
  vmp: true,
  pm: true,
  informe: true,
  transp: true,
  proy: true,
  modelo: true,
  cant: true,
  destino: true,
};

const INVENTORY_COL_LABELS: Record<InventoryTableSortKey, string> = {
  serial: "Serial",
  bomNo: "N° BOM",
  bomCotiz: "Ref. cotiz.",
  bomMatSpec: "Material / espec.",
  bomUnitKg: "kg / u.",
  bomTotKg: "kg total",
  itemN: "N° ítem",
  pallet: "Pallet",
  ff: "FF %",
  isc: "Isc",
  voc: "Voc",
  imp: "Imp",
  vmp: "Vmp",
  pm: "Pm (W)",
  informe: "Informe",
  transp: "Transporte",
  proy: "Proyecto",
  modelo: "Modelo / producto",
  cant: "Cantidad",
  destino: "Destino",
};

function loadInventoryColVisible(): Record<InventoryTableSortKey, boolean> {
  const out: Record<InventoryTableSortKey, boolean> = { ...DEFAULT_INVENTORY_COL_VISIBLE };
  if (typeof window === "undefined") return out;
  try {
    const raw = window.localStorage.getItem(INVENTORY_TABLE_COL_VISIBLE_KEY);
    if (!raw) return out;
    const p = JSON.parse(raw) as Partial<Record<InventoryTableSortKey, boolean>>;
    for (const id of INVENTORY_TABLE_COL_ORDER) {
      if (id === "serial") continue;
      if (p[id] === false) out[id] = false;
    }
  } catch {
    /* ignore */
  }
  return out;
}

function saveInventoryColVisible(v: Record<InventoryTableSortKey, boolean>) {
  if (typeof window === "undefined") return;
  try {
    const toSave = { ...v, serial: true };
    window.localStorage.setItem(INVENTORY_TABLE_COL_VISIBLE_KEY, JSON.stringify(toSave));
  } catch {
    /* ignore */
  }
}

function loadInventoryColWidths(): Record<InventoryTableSortKey, number> {
  if (typeof window === "undefined") return { ...DEFAULT_INVENTORY_COL_WIDTHS };
  try {
    const raw = window.localStorage.getItem(INVENTORY_TABLE_COL_WIDTHS_KEY);
    if (!raw) return { ...DEFAULT_INVENTORY_COL_WIDTHS };
    const p = JSON.parse(raw) as Partial<Record<InventoryTableSortKey, number>>;
    const out = { ...DEFAULT_INVENTORY_COL_WIDTHS };
    (Object.keys(DEFAULT_INVENTORY_COL_WIDTHS) as InventoryTableSortKey[]).forEach((k) => {
      const v = p[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.max(INVENTORY_COL_WIDTH_MIN, Math.min(560, Math.round(v)));
    });
    return out;
  } catch {
    return { ...DEFAULT_INVENTORY_COL_WIDTHS };
  }
}

function formatInventoryDateTime(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.trim();
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(d);
}

/** Fusiona campos OQC en `linksJson` conservando el resto de claves. */
function mergeOqcPatchIntoLinksJson(current: string | null | undefined, patch: Record<string, unknown>): string {
  let o: Record<string, unknown> = {};
  const raw = String(current ?? "").trim();
  if (raw) {
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      o = {};
    }
  }
  const next = { ...o };
  for (const [k, v] of Object.entries(patch)) {
    if (v === "" || v === null || v === undefined) delete next[k];
    else next[k] = v;
  }
  return JSON.stringify(next);
}

function InventoryThSort(props: {
  label: string;
  sortKey: InventoryTableSortKey;
  sort: InventoryTableSort;
  onCycle: (k: InventoryTableSortKey) => void;
  className?: string;
  align?: "left" | "center" | "right";
  onBeginColResize?: (e: ReactMouseEvent<HTMLButtonElement>, key: InventoryTableSortKey) => void;
  /** Si es false y hay `onBeginColResize`, no se muestra el asa de redimensionar (p. ej. última columna visible). */
  showResizeHandle?: boolean;
}) {
  const { label, sortKey, sort, onCycle, className, align = "left", onBeginColResize, showResizeHandle = true } = props;
  const active = sort?.key === sortKey;
  const arrow = !active ? "·" : sort.dir === "asc" ? "▲" : "▼";
  const justify =
    align === "center" ? "justify-center" : align === "right" ? "justify-end" : "justify-between";
  const textAlign = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";

  const thTitle =
    sortKey === "itemN" ? "N° ítem en planilla de informe" : sortKey === "ff" ? "Factor de llenado %" : sortKey === "transp" ? "Viaje, camión, conductor" : undefined;

  const sortBtnClass = onBeginColResize
    ? `inline-flex min-h-[2rem] min-w-0 flex-1 items-center gap-0.5 ${justify} ${textAlign} font-semibold uppercase tracking-wide hover:text-primary-600 dark:hover:text-primary-400`
    : `inline-flex w-full min-w-0 items-center gap-1 ${justify} ${textAlign} font-semibold uppercase tracking-wide hover:text-primary-600 dark:hover:text-primary-400`;

  if (!onBeginColResize) {
    return (
      <th className={className} title={thTitle}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCycle(sortKey);
          }}
          className={sortBtnClass}
          title="Ordenar: asc · desc · sin orden"
        >
          <span className="min-w-0 truncate">{label}</span>
          <span className="shrink-0 text-[9px] font-normal tabular-nums opacity-80" aria-hidden>
            {arrow}
          </span>
        </button>
      </th>
    );
  }

  return (
    <th className={`${className ?? ""} group/th !p-0`} title={thTitle}>
      <div className="flex h-full min-h-[2.25rem] min-w-0 items-stretch">
        <div className="min-w-0 flex-1 px-2 py-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCycle(sortKey);
            }}
            className={sortBtnClass}
            title="Ordenar: asc · desc · sin orden"
          >
            <span className="min-w-0 truncate">{label}</span>
            <span className="shrink-0 text-[9px] font-normal tabular-nums opacity-80" aria-hidden>
              {arrow}
            </span>
          </button>
        </div>
        {showResizeHandle ? (
          <button
            type="button"
            aria-label={`Redimensionar columna ${label}`}
            title="Arrastrar para cambiar el ancho"
            className="flex w-[10px] shrink-0 cursor-col-resize touch-none select-none flex-col items-center justify-center border-0 border-l border-slate-200/80 bg-transparent px-0 transition-colors hover:bg-violet-500/15 dark:border-slate-500/90 dark:hover:bg-violet-400/25"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onBeginColResize(e, sortKey);
            }}
          >
            <span
              className="pointer-events-none flex h-3 items-center gap-px rounded-sm border border-slate-400/40 bg-slate-900/[0.03] px-px dark:border-slate-500/45 dark:bg-white/[0.04]"
              aria-hidden
            >
              <span className="h-2.5 w-px bg-slate-500/85 dark:bg-slate-400" />
              <span className="h-2.5 w-px bg-slate-500/85 dark:bg-slate-400" />
            </span>
          </button>
        ) : null}
      </div>
    </th>
  );
}

function downloadInventoryCsv(data: InventoryListRow[], filenameBase: string) {
  const blob = new Blob([buildInventoryExportCsv(data)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const MAX_PRODUCT_OPTIONS = 500;

/** `fv_plant` | `all` | `cat:<id>` */
function parseCatalogAreaKey(key: string): { mode: InventoryProductPickerMode; categoryId: number | null } {
  if (key.startsWith("cat:")) {
    const id = Number(key.slice(4));
    return { mode: "all", categoryId: Number.isFinite(id) ? id : null };
  }
  if (key === "all") return { mode: "all", categoryId: null };
  return { mode: "fv_plant", categoryId: null };
}

function LogisticaInventarioInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mergeRuntime } = useSuiteAgentRuntime();
  const { user, loading: authLoading } = useAuth();

  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);
  const canCreateProduct = useCan("create", "product");

  const [rows, setRows] = useState<InventoryListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<SuiteProjectRow[]>([]);
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categoriesFlat, setCategoriesFlat] = useState<Category[]>([]);
  const [catalogAreaKey, setCatalogAreaKey] = useState<string>("fv_plant");
  const [productSearch, setProductSearch] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [orphanProduct, setOrphanProduct] = useState<Product | null>(null);

  const [filterKind, setFilterKind] = useState<string>("");
  const urlProjectId = searchParams.get("projectId")?.trim() ?? "";
  const urlQuoteId = searchParams.get("quoteId")?.trim() ?? "";
  const urlPallet = searchParams.get("pallet")?.trim() ?? "";
  const linkProductFromUrl = searchParams.get(QUERY_LINK_PRODUCT)?.trim() ?? "";
  const [filterProjectId, setFilterProjectId] = useState<string>(urlProjectId);
  const [filterQuoteId, setFilterQuoteId] = useState<string>(urlQuoteId);
  const [filterSearch, setFilterSearch] = useState<string>("");
  const [filterPallet, setFilterPallet] = useState<string>(urlPallet);
  /** Filtro solo de vista: familía inferida (OQC vs BOM proveedor vs catálogo). No cambia la petición al API. */
  const [filterLineSegment, setFilterLineSegment] = useState<InventoryLineSegmentFilter>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{
    sku: string;
    name: string;
    description: string;
    quantity: string;
    unit: string;
    storageLocation: string;
    destinationKind: InventoryDestinationKind;
    destinationNote: string;
    projectId: string;
    quoteId: string;
    productId: string;
    linksJson: string;
  }>({
    sku: "",
    name: "",
    description: "",
    quantity: "0",
    unit: "unidad",
    storageLocation: "",
    destinationKind: "GENERAL",
    destinationNote: "",
    projectId: "",
    quoteId: "",
    productId: "",
    linksJson: "",
  });
  const [saving, setSaving] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
  const oqcSpreadsheetInputRef = useRef<HTMLInputElement>(null);
  const pendingOqcSpreadsheetProjectIdRef = useRef<string | null>(null);
  const [oqcImportModal, setOqcImportModal] = useState<null | "spreadsheet">(null);
  const [oqcImportProjectId, setOqcImportProjectId] = useState("");
  const [bomPdfModalOpen, setBomPdfModalOpen] = useState(false);
  const [duplicateReport, setDuplicateReport] = useState<InventoryDuplicateSerialsResponse | null>(null);
  const [duplicateScanLoading, setDuplicateScanLoading] = useState(false);
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [relinkOqcLoading, setRelinkOqcLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  /** Panel de filtros + herramientas: colapsado por defecto para vista más limpia. */
  const [inventoryToolsExpanded, setInventoryToolsExpanded] = useState(false);
  const [inventoryItemsMenuOpen, setInventoryItemsMenuOpen] = useState(false);
  const inventoryItemsMenuRef = useRef<HTMLDivElement>(null);
  const [purgePinModal, setPurgePinModal] = useState<null | { scope: "OQC_PANELS_ONLY" | "ALL_PROJECT_DESTINATION" }>(null);
  const [purgePinInput, setPurgePinInput] = useState("");
  /** Texto técnico de importación OQC (no se edita en el cuadro de notas; se fusiona al guardar). */
  const oqcTechnicalDescriptionRef = useRef<string>("");
  const [inventoryModalShowOqcDetail, setInventoryModalShowOqcDetail] = useState(false);
  const [inventoryTableSort, setInventoryTableSort] = useState<InventoryTableSort>(null);
  const [liveColWidths, setLiveColWidths] = useState<Record<InventoryTableSortKey, number>>(() => ({ ...DEFAULT_INVENTORY_COL_WIDTHS }));
  const [savedColWidths, setSavedColWidths] = useState<Record<InventoryTableSortKey, number>>(() => ({ ...DEFAULT_INVENTORY_COL_WIDTHS }));
  const [inventoryColVisible, setInventoryColVisible] = useState<Record<InventoryTableSortKey, boolean>>(() => ({
    ...DEFAULT_INVENTORY_COL_VISIBLE,
  }));
  const [inventoryColsDrawerOpen, setInventoryColsDrawerOpen] = useState(false);
  const colDragRef = useRef<{ key: InventoryTableSortKey; originX: number; originW: number } | null>(null);
  const [colResizeActive, setColResizeActive] = useState(false);
  const [editingInventoryMeta, setEditingInventoryMeta] = useState<{ createdAt: string; updatedAt: string } | null>(null);
  /** Proyecto para duplicados / sanitizar / vaciar (no depende del filtro de la tabla). */
  const [massOpsProjectId, setMassOpsProjectId] = useState("");
  const [invPageHelpOpen, setInvPageHelpOpen] = useState(false);
  const invPageHelpRef = useRef<HTMLDivElement>(null);
  /** Ayuda contextual del panel «Filtros y herramientas» (textos largos fuera de la vista principal). */
  const [inventoryFiltrosHelpOpen, setInventoryFiltrosHelpOpen] = useState(false);
  const inventoryFiltrosHelpRef = useRef<HTMLDivElement>(null);

  const cycleInventoryTableSort = useCallback((key: InventoryTableSortKey) => {
    setInventoryTableSort((cur) => {
      if (!cur || cur.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }, []);

  useEffect(() => {
    const w = loadInventoryColWidths();
    setLiveColWidths(w);
    setSavedColWidths(w);
  }, []);

  useEffect(() => {
    setInventoryColVisible(loadInventoryColVisible());
  }, []);

  useEffect(() => {
    saveInventoryColVisible(inventoryColVisible);
  }, [inventoryColVisible]);

  useEffect(() => {
    if (!inventoryColsDrawerOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setInventoryColsDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inventoryColsDrawerOpen]);

  useEffect(() => {
    if (!invPageHelpOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const el = invPageHelpRef.current;
      if (el && !el.contains(e.target as Node)) setInvPageHelpOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [invPageHelpOpen]);

  useEffect(() => {
    if (!inventoryFiltrosHelpOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const el = inventoryFiltrosHelpRef.current;
      if (el && !el.contains(e.target as Node)) setInventoryFiltrosHelpOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [inventoryFiltrosHelpOpen]);

  useEffect(() => {
    if (!inventoryToolsExpanded) setInventoryFiltrosHelpOpen(false);
  }, [inventoryToolsExpanded]);

  useEffect(() => {
    if (!inventoryFiltrosHelpOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setInventoryFiltrosHelpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [inventoryFiltrosHelpOpen]);

  useEffect(() => {
    if (!colResizeActive) return;
    const move = (ev: globalThis.MouseEvent) => {
      const d = colDragRef.current;
      if (!d) return;
      const nw = Math.max(INVENTORY_COL_WIDTH_MIN, Math.min(560, d.originW + (ev.clientX - d.originX)));
      setLiveColWidths((prev) => (prev[d.key] === nw ? prev : { ...prev, [d.key]: nw }));
    };
    const up = () => {
      colDragRef.current = null;
      setColResizeActive(false);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [colResizeActive]);

  const beginInventoryColResize = useCallback((e: ReactMouseEvent<HTMLButtonElement>, key: InventoryTableSortKey) => {
    e.preventDefault();
    e.stopPropagation();
    colDragRef.current = { key, originX: e.clientX, originW: liveColWidths[key] };
    setColResizeActive(true);
  }, [liveColWidths]);

  const persistInventoryColWidths = useCallback(() => {
    try {
      window.localStorage.setItem(INVENTORY_TABLE_COL_WIDTHS_KEY, JSON.stringify(liveColWidths));
      setSavedColWidths({ ...liveColWidths });
    } catch {
      /* ignore */
    }
  }, [liveColWidths]);

  const inventoryColumnLayoutDirty = useMemo(
    () =>
      (Object.keys(DEFAULT_INVENTORY_COL_WIDTHS) as InventoryTableSortKey[]).some((k) => liveColWidths[k] !== savedColWidths[k]),
    [liveColWidths, savedColWidths],
  );

  useEffect(() => {
    if (!inventoryItemsMenuOpen) return;
    const onDoc = (e: globalThis.MouseEvent) => {
      const el = inventoryItemsMenuRef.current;
      if (el && !el.contains(e.target as Node)) setInventoryItemsMenuOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setInventoryItemsMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [inventoryItemsMenuOpen]);

  useEffect(() => {
    setFilterProjectId(urlProjectId);
    setFilterQuoteId(urlQuoteId);
    if (urlPallet) setFilterPallet(urlPallet);
  }, [urlProjectId, urlQuoteId, urlPallet]);

  useEffect(() => {
    if (filterProjectId.trim()) setMassOpsProjectId(filterProjectId);
  }, [filterProjectId]);

  useEffect(() => {
    if (!projects.length || massOpsProjectId.trim()) return;
    const cso = projects.find((p) => p.code.trim().toUpperCase() === "CSO");
    setMassOpsProjectId(cso?.id ?? projects[0]?.id ?? "");
  }, [projects, massOpsProjectId]);

  useEffect(() => {
    setDuplicateReport(null);
  }, [filterProjectId, massOpsProjectId]);

  const reload = useCallback(async (mode?: "cleared") => {
    setLoading(true);
    setError(null);
    const listFilters =
      mode === "cleared"
        ? {}
        : {
            destinationKind: filterKind || undefined,
            projectId: filterProjectId.trim() || undefined,
            quoteId: filterQuoteId.trim() || undefined,
            search: filterSearch.trim() || undefined,
            pallet: filterPallet.trim() || undefined,
          };
    try {
      const [list, plist, qlist] = await Promise.all([
        fetchInventoryItems(listFilters),
        fetchSuiteProjects().catch(() => [] as SuiteProjectRow[]),
        fetchQuotes({ includeInactive: true }).catch(() => [] as QuoteListItem[]),
      ]);
      setRows(list);
      setProjects(plist);
      setQuotes(qlist.slice(0, 150));
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Error al cargar";
      const hint404 =
        raw.includes("Cannot GET") || raw.includes("404")
          ? " Reinicie el servidor del API (Nest en el puerto 4000) y ejecute `npx prisma db push` o las migraciones en `apps/api` para crear la tabla InventoryItem."
          : "";
      setError(raw + hint404);
    } finally {
      setLoading(false);
    }
  }, [filterKind, filterProjectId, filterQuoteId, filterSearch, filterPallet]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    let cancelled = false;
    setCatalogLoading(true);
    (async () => {
      try {
        const [cats, prods] = await Promise.all([
          fetchCategories().catch(() => [] as Category[]),
          fetchProducts({ commercialStatus: "ACTIVO" }).catch(() => [] as Product[]),
        ]);
        if (cancelled) return;
        setCategoriesFlat(flattenProductCategories(cats));
        setProducts(prods);
      } finally {
        if (!cancelled) setCatalogLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canSee]);

  const { mode: pickerMode, categoryId: pickerCategoryId } = useMemo(
    () => parseCatalogAreaKey(catalogAreaKey),
    [catalogAreaKey],
  );

  const filteredCatalogProducts = useMemo(
    () =>
      filterProductsForInventoryPicker(products, {
        mode: pickerMode,
        categoryId: pickerCategoryId,
        search: productSearch,
      }),
    [products, pickerMode, pickerCategoryId, productSearch],
  );

  const productOptions = useMemo(() => {
    const cap = filteredCatalogProducts.slice(0, MAX_PRODUCT_OPTIONS);
    const id = form.productId.trim();
    if (id && orphanProduct && orphanProduct.id === id && !cap.some((p) => p.id === id)) {
      return [orphanProduct, ...cap];
    }
    return cap;
  }, [filteredCatalogProducts, form.productId, orphanProduct]);

  useEffect(() => {
    const id = form.productId.trim();
    if (!id) {
      setOrphanProduct(null);
      return;
    }
    if (products.some((p) => p.id === id)) {
      setOrphanProduct(null);
      return;
    }
    let cancelled = false;
    fetchProduct(id)
      .then((p) => {
        if (!cancelled) setOrphanProduct(p);
      })
      .catch(() => {
        if (!cancelled) setOrphanProduct(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.productId, products]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canSee) {
      router.replace("/acceso-restringido");
      return;
    }
    void reload();
  }, [authLoading, user, canSee, router, reload]);

  useEffect(() => {
    mergeRuntime({
      summary: "Inventario suite: stock por destino; enlace opcional al catálogo solo para ficha técnica (EGE-720W, etc.).",
    });
  }, [mergeRuntime]);

  function resetForm() {
    setEditingId(null);
    setOrphanProduct(null);
    setCatalogAreaKey("fv_plant");
    setProductSearch("");
    setItemModalOpen(false);
    oqcTechnicalDescriptionRef.current = "";
    setInventoryModalShowOqcDetail(false);
    setEditingInventoryMeta(null);
    setForm({
      sku: "",
      name: "",
      description: "",
      quantity: "0",
      unit: "unidad",
      storageLocation: "",
      destinationKind: "GENERAL",
      destinationNote: "",
      projectId: "",
      quoteId: "",
      productId: "",
      linksJson: "",
    });
  }

  function openNewItemModal() {
    const pid = filterProjectId.trim();
    setEditingId(null);
    setOrphanProduct(null);
    oqcTechnicalDescriptionRef.current = "";
    setInventoryModalShowOqcDetail(false);
    setEditingInventoryMeta(null);
    setCatalogAreaKey("fv_plant");
    setProductSearch("");
    setForm({
      sku: "",
      name: "",
      description: "",
      quantity: "0",
      unit: "unidad",
      storageLocation: "",
      destinationKind: pid ? "PROJECT" : "GENERAL",
      destinationNote: "",
      projectId: pid,
      quoteId: "",
      productId: "",
      linksJson: "",
    });
    setItemModalOpen(true);
  }

  const prefillFromProduct = useCallback((p: Product, opts?: { projectId?: string }) => {
    setEditingId(null);
    setOrphanProduct(null);
    oqcTechnicalDescriptionRef.current = "";
    setInventoryModalShowOqcDetail(false);
    setEditingInventoryMeta(null);
    setCatalogAreaKey("fv_plant");
    setProductSearch("");
    const pid = (opts?.projectId ?? filterProjectId).trim();
    setForm({
      sku: p.sku?.trim() ?? "",
      name: p.name.slice(0, 500),
      description: "",
      quantity: "1",
      unit: (p.unit || "unidad").slice(0, 64),
      storageLocation: "",
      destinationKind: pid ? "PROJECT" : "GENERAL",
      destinationNote: "",
      projectId: pid,
      quoteId: "",
      productId: p.id,
      linksJson: "",
    });
    setItemModalOpen(true);
  }, [filterProjectId]);

  useEffect(() => {
    if (!linkProductFromUrl || authLoading || !user || !canSee) return;
    const stripLinkParam = () => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete(QUERY_LINK_PRODUCT);
      const qs = next.toString();
      router.replace(qs ? `${INVENTARIO_PATH}?${qs}` : INVENTARIO_PATH, { scroll: false });
    };
    if (!canWrite) {
      setError("No puede usar el enlace de vinculación: inventario en solo lectura.");
      stripLinkParam();
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const p = await fetchProduct(linkProductFromUrl);
        if (cancelled) return;
        const proj = searchParams.get("projectId")?.trim() ?? "";
        prefillFromProduct(p, proj ? { projectId: proj } : undefined);
        stripLinkParam();
      } catch {
        if (!cancelled) {
          setError("No se pudo cargar el producto del enlace (permisos o ID inválido). Puede seguir creando stock manualmente.");
          stripLinkParam();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    canSee,
    canWrite,
    linkProductFromUrl,
    prefillFromProduct,
    router,
    searchParams,
    user,
  ]);

  function loadRowIntoForm(r: InventoryListRow) {
    setEditingId(r.id);
    setEditingInventoryMeta({ createdAt: r.createdAt, updatedAt: r.updatedAt });
    const oqc = parseInventoryRowOqc(r);
    let descriptionForNotes = r.description ?? "";
    if (oqc) {
      const { technical, notes } = splitOqcStoredDescription(r.description);
      oqcTechnicalDescriptionRef.current = technical;
      descriptionForNotes = notes;
    } else {
      oqcTechnicalDescriptionRef.current = "";
    }
    setForm({
      sku: r.sku ?? "",
      name: r.name,
      description: descriptionForNotes,
      quantity: String(r.quantity),
      unit: r.unit,
      storageLocation: r.storageLocation ?? "",
      destinationKind: (r.destinationKind as InventoryDestinationKind) || "GENERAL",
      destinationNote: r.destinationNote ?? "",
      projectId: r.projectId ?? "",
      quoteId: r.quoteId ?? "",
      productId: r.productId ?? "",
      linksJson: r.linksJson ?? "",
    });
    setInventoryModalShowOqcDetail(false);
    setItemModalOpen(true);
  }

  useEffect(() => {
    if (!itemModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetForm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [itemModalOpen]);

  async function onSubmitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    const qty = Number(form.quantity);
    if (Number.isNaN(qty) || qty < 0) {
      setError("Cantidad inválida");
      setSaving(false);
      return;
    }
    const oqcPayload = parseOqcFromLinksJson(form.linksJson, form.sku);
    const descriptionPayload =
      oqcPayload != null
        ? mergeOqcStoredDescription(oqcTechnicalDescriptionRef.current || "", form.description)
        : form.description.trim() || null;

    const payload: CreateInventoryItemInput = {
      sku: form.sku.trim() || null,
      name: form.name.trim(),
      description: descriptionPayload,
      quantity: qty,
      unit: form.unit.trim() || "unidad",
      storageLocation: form.storageLocation.trim() || null,
      destinationKind: form.destinationKind,
      destinationNote: form.destinationNote.trim() || null,
      projectId: form.projectId.trim() || null,
      quoteId: form.quoteId.trim() || null,
      productId: form.productId.trim() || null,
      linksJson: form.linksJson.trim() || null,
    };
    try {
      if (editingId) {
        await updateInventoryItem(editingId, payload);
      } else {
        await createInventoryItem(payload);
      }
      resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  function openInventoryBulkSpreadsheetModal() {
    const init =
      filterProjectId.trim() ||
      projects.find((p) => p.code.toUpperCase() === "CSO")?.id ||
      projects[0]?.id ||
      "";
    setOqcImportProjectId(init);
    setOqcImportModal("spreadsheet");
    setError(null);
  }

  function confirmOqcSpreadsheetChooseFile() {
    const pid = oqcImportProjectId.trim();
    if (!pid) {
      setError("Seleccione el proyecto al que pertenecerán los paneles importados.");
      return;
    }
    pendingOqcSpreadsheetProjectIdRef.current = pid;
    setOqcImportModal(null);
    requestAnimationFrame(() => oqcSpreadsheetInputRef.current?.click());
  }

  async function onOqcSpreadsheetChosen(file: File) {
    if (!canWrite) return;
    const pid = pendingOqcSpreadsheetProjectIdRef.current?.trim();
    pendingOqcSpreadsheetProjectIdRef.current = null;
    if (!pid) {
      setError("No se indicó el proyecto destino. Use el botón + → «Importar masivo (CSV / XLSX)» y elija proyecto antes del archivo.");
      return;
    }
    if (
      !window.confirm(
        `¿Importar todas las filas con número de serie en «${file.name}» al proyecto seleccionado? Puede tardar 1–2 minutos si son miles de filas.`,
      )
    ) {
      return;
    }
    setImportingSpreadsheet(true);
    setError(null);
    try {
      const r = await importOqcInventorySpreadsheet(file, {
        projectId: pid,
        reportRef: "EGE2026-OQC-PV · 20262356-720W",
        sourceFileHint: file.name.slice(0, 400),
      });
      const warn = r.parseWarnings?.length ? ` Avisos: ${r.parseWarnings.join(" · ")}.` : "";
      window.alert(
        `Hojas analizadas: ${r.sheetsTried.join(", ")}. Filas leídas: ${r.rowsInFile}. Creadas: ${r.created}. Omitidas: ${r.skipped}.${warn}`,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al importar el archivo");
    } finally {
      setImportingSpreadsheet(false);
    }
  }

  async function scanInventoryDuplicates() {
    const pid = massOpsProjectId.trim();
    if (!pid || !canWrite) return;
    setDuplicateScanLoading(true);
    setError(null);
    try {
      const r = await fetchInventoryDuplicateSerials(pid);
      setDuplicateReport(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al analizar duplicados");
    } finally {
      setDuplicateScanLoading(false);
    }
  }

  async function runDedupeInventoryOldest() {
    if (!canWrite) return;
    const pid = massOpsProjectId.trim();
    if (!pid) return;
    if (!duplicateReport || duplicateReport.extraDuplicateRows === 0) {
      window.alert("No hay duplicados detectados. Pulse «Analizar duplicados» primero.");
      return;
    }
    if (
      !window.confirm(
        `Se eliminarán ${duplicateReport.extraDuplicateRows} fila(s) duplicada(s) (mismo serial en destino proyecto), conservando la más antigua por serial. ¿Continuar?`,
      )
    ) {
      return;
    }
    setDedupeLoading(true);
    setError(null);
    try {
      const r = await deduplicateInventorySerials({ projectId: pid, keep: "OLDEST" });
      window.alert(`Eliminadas ${r.deleted} fila(s). Seriales con duplicado resueltos: ${r.duplicateSerialsResolved}.`);
      setDuplicateReport(null);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al eliminar duplicados");
    } finally {
      setDedupeLoading(false);
    }
  }

  async function runRelinkOqcCatalog() {
    if (!canWrite) return;
    const pid = massOpsProjectId.trim();
    if (!pid) return;
    if (
      !window.confirm(
        "Se revisarán las filas importadas desde planillas en este proyecto y se ajustarán los enlaces al catálogo de productos cuando haya incoherencias. No se borran cantidades ni números de serie. ¿Continuar?",
      )
    ) {
      return;
    }
    setRelinkOqcLoading(true);
    setError(null);
    try {
      const r = await relinkOqcInventoryCatalog({ projectId: pid });
      window.alert(
        `Listo. Filas revisadas: ${r.rowsTouched}. Enlaces al catálogo corregidos: ${r.productRelinks}. Enlaces quitados por no coincidir con la planilla: ${r.productUnlinks}.${r.targetProductName ? ` Referencia de producto: ${r.targetProductName}.` : ""}`,
      );
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al corregir enlaces con el catálogo");
    } finally {
      setRelinkOqcLoading(false);
    }
  }

  function requestPurgeProjectInventory(scope: "OQC_PANELS_ONLY" | "ALL_PROJECT_DESTINATION") {
    if (!canWrite) return;
    const pid = massOpsProjectId.trim();
    if (!pid) return;
    const proj = projects.find((x) => x.id === pid);
    if (!proj) {
      setError("No se encontró el proyecto en la lista. Recargue o aplique filtros de nuevo.");
      return;
    }
    const scopeLabel =
      scope === "OQC_PANELS_ONLY"
        ? "solo las filas reconocidas como importación de planilla con número de serie (no listas de proveedor ni otros tipos de stock)"
        : "todas las filas de inventario con destino «Proyecto / obra» en este proyecto (cualquier origen: planilla, lista, manual, etc.)";
    if (
      !window.confirm(
        `Acción irreversible en el proyecto «${proj.code}» (${proj.name.slice(0, 60)}${proj.name.length > 60 ? "…" : ""}).\n\nSe eliminarán ${scopeLabel}.\n\nNo se borran productos del catálogo comercial, ni cotizaciones, ni el proyecto.\n\n¿Continuar?`,
      )
    ) {
      return;
    }
    if (scope === "ALL_PROJECT_DESTINATION") {
      if (!window.confirm(`Segunda confirmación: proyecto «${proj.code}». Se borrará todo el stock con destino obra en ese proyecto (todas las fuentes). ¿Seguro?`)) {
        return;
      }
    }
    setPurgePinInput("");
    setPurgePinModal({ scope });
  }

  async function confirmPurgeWithSecurityPin() {
    if (!canWrite || !purgePinModal) return;
    const pid = massOpsProjectId.trim();
    const pin = purgePinInput.trim();
    if (!pin) {
      setError("Indique el código de seguridad interno.");
      return;
    }
    setPurgeLoading(true);
    setDuplicateReport(null);
    setError(null);
    try {
      const r = await purgeProjectInventoryItems({
        projectId: pid,
        securityPin: pin,
        scope: purgePinModal.scope,
      });
      setPurgePinModal(null);
      setPurgePinInput("");
      window.alert(`Eliminadas ${r.deleted} fila(s) de inventario. Candidatas revisadas: ${r.scanned}. Proyecto ${r.projectCode}. Ya puede volver a subir la planilla.`);
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al vaciar inventario");
    } finally {
      setPurgeLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!canWrite) return;
    if (!window.confirm("¿Eliminar este ítem del inventario?")) return;
    setError(null);
    try {
      await deleteInventoryItem(id);
      if (editingId === id) resetForm();
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  }

  function applyFiltersToUrl() {
    const p = new URLSearchParams();
    if (filterProjectId.trim()) p.set("projectId", filterProjectId.trim());
    if (filterQuoteId.trim()) p.set("quoteId", filterQuoteId.trim());
    const s = p.toString();
    router.replace(s ? `${INVENTARIO_PATH}?${s}` : INVENTARIO_PATH);
    void reload();
  }

  function clearAllFilters() {
    setFilterKind("");
    setFilterProjectId("");
    setFilterQuoteId("");
    setFilterSearch("");
    setFilterPallet("");
    setFilterLineSegment("");
    router.replace(INVENTARIO_PATH);
    // Sin "cleared", reload usaría el estado anterior (React aún no aplicó los setState).
    void reload("cleared");
  }

  const hasNarrowingFilters = Boolean(
    filterProjectId.trim() ||
      filterQuoteId.trim() ||
      filterKind.trim() ||
      filterSearch.trim() ||
      filterPallet.trim() ||
      filterLineSegment,
  );

  const rowsForTable = useMemo(() => {
    if (!filterLineSegment) return rows;
    return rows.filter((r) => rowMatchesInventoryLineSegment(r, filterLineSegment));
  }, [rows, filterLineSegment]);

  /**
   * Con «Todas las familias», si las filas visibles son solo BOM o solo OQC, se aplica el mismo layout de columnas
   * que al filtrar por esa familia (evita muchas columnas de paneles en blanco al importar solo BOM, y viceversa).
   */
  const homogeneousLayoutWhenAllFamilies = useMemo(() => {
    if (filterLineSegment) return null;
    return homogeneousBomOrOqcLayoutSegment(rowsForTable);
  }, [filterLineSegment, rowsForTable]);

  /** Con familia «BOM proveedor» / «OQC» explícita, o detección homogénea arriba. */
  const inventoryDisplayColVisible = useMemo((): Record<InventoryTableSortKey, boolean> => {
    const base = { ...inventoryColVisible };
    const oqcPanelCols: InventoryTableSortKey[] = [
      "itemN",
      "pallet",
      "ff",
      "isc",
      "voc",
      "imp",
      "vmp",
      "pm",
      "informe",
      "transp",
      "modelo",
    ];
    const bomCols: InventoryTableSortKey[] = ["bomNo", "bomCotiz", "bomMatSpec", "bomUnitKg", "bomTotKg"];
    const explicit =
      filterLineSegment === "supplier_bom" || filterLineSegment === "oqc_serial_panel" ? filterLineSegment : null;
    const inferred = explicit == null ? homogeneousLayoutWhenAllFamilies : null;
    const layoutKey = explicit ?? inferred;
    if (layoutKey === "supplier_bom") {
      const o = { ...base };
      for (const k of oqcPanelCols) o[k] = false;
      for (const k of bomCols) o[k] = true;
      return o;
    }
    if (layoutKey === "oqc_serial_panel") {
      const o = { ...base };
      for (const k of bomCols) o[k] = false;
      return o;
    }
    return base;
  }, [inventoryColVisible, filterLineSegment, homogeneousLayoutWhenAllFamilies]);

  const inventoryVisibleKeys = useMemo(
    () => INVENTORY_TABLE_COL_ORDER.filter((k) => k === "serial" || inventoryDisplayColVisible[k] !== false),
    [inventoryDisplayColVisible],
  );

  const inventoryTableMinPx = useMemo(
    () => inventoryVisibleKeys.reduce((acc, k) => acc + liveColWidths[k], 0),
    [inventoryVisibleKeys, liveColWidths],
  );

  useEffect(() => {
    setInventoryTableSort((cur) => {
      if (!cur) return cur;
      if (!inventoryVisibleKeys.includes(cur.key)) return null;
      return cur;
    });
  }, [inventoryVisibleKeys]);

  const inventoryTotals = useMemo(() => {
    const sumQty = rowsForTable.reduce((acc, r) => {
      const q = Number(r.quantity);
      return acc + (Number.isFinite(q) ? q : 0);
    }, 0);
    const oqcProjectSerials = rowsForTable.filter(
      (r) => r.destinationKind === "PROJECT" && r.sku && /^ETND/i.test(String(r.sku).trim()),
    ).length;
    return { n: rowsForTable.length, totalLoaded: rows.length, sumQty, oqcProjectSerials };
  }, [rows, rowsForTable]);

  const inventoryTableRowsSorted = useMemo(
    () => sortInventoryRows(rowsForTable, inventoryTableSort),
    [rowsForTable, inventoryTableSort],
  );

  const inventoryModalOqc = useMemo(() => parseOqcFromLinksJson(form.linksJson, form.sku), [form.linksJson, form.sku]);

  const inventoryFiltersSummary = useMemo(() => {
    const bits: string[] = [];
    bits.push(filterKind.trim() ? (DESTINO_LABEL[filterKind as InventoryDestinationKind] ?? filterKind) : "Todos los destinos");
    const fp = filterProjectId.trim();
    if (fp) {
      const p = projects.find((x) => x.id === fp);
      bits.push(p ? `Vista tabla: ${p.code}` : "Vista tabla: proyecto");
    } else bits.push("Vista tabla: cualquier proyecto");
    const fq = filterQuoteId.trim();
    if (fq) bits.push("Vista tabla: cotización filtrada");
    if (filterSearch.trim()) bits.push(`Buscar: «${filterSearch.trim().slice(0, 20)}${filterSearch.trim().length > 20 ? "…" : ""}»`);
    if (filterPallet.trim()) bits.push(`Pallet: «${filterPallet.trim().slice(0, 24)}${filterPallet.trim().length > 24 ? "…" : ""}»`);
    if (filterLineSegment) {
      const lab = INVENTORY_LINE_SEGMENT_OPTIONS.find((o) => o.value === filterLineSegment)?.label ?? filterLineSegment;
      bits.push(`Familia: ${lab}`);
    }
    const mo = massOpsProjectId.trim();
    if (mo && canWrite) {
      const p = projects.find((x) => x.id === mo);
      if (p) bits.push(`Herramientas: ${p.code}`);
    }
    return bits.join(" · ");
  }, [
    filterKind,
    filterProjectId,
    filterQuoteId,
    filterSearch,
    filterPallet,
    filterLineSegment,
    massOpsProjectId,
    projects,
    canWrite,
  ]);

  if (authLoading || (!user && !error)) {
    return <p className="p-6 text-sm text-slate-600 dark:text-slate-400">Cargando…</p>;
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-1 flex-col gap-3 overflow-hidden px-4 pb-2 pt-1 md:px-6 md:pb-3 md:pt-2">
      <header className="shrink-0 border-b border-slate-200 pb-3 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-3xl">Logística · Inventario</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Stock por ítem y destino; use <strong className="font-medium text-slate-700 dark:text-slate-300">Familia de línea</strong> para ver en la tabla solo un tipo de carga (planilla con seriales, lista de proveedor, etc.). El catálogo sirve solo como ficha de referencia.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="relative" ref={invPageHelpRef}>
              <button
                type="button"
                onClick={() => setInvPageHelpOpen((v) => !v)}
                aria-expanded={invPageHelpOpen}
                aria-controls="inv-page-help-popover"
                title="Información sobre inventario y catálogo"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-600 shadow-sm transition hover:border-primary-400 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-slate-700 dark:hover:text-primary-200"
              >
                ?
              </button>
              {invPageHelpOpen ? (
                <div
                  id="inv-page-help-popover"
                  role="dialog"
                  aria-label="Información"
                  className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-700 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                >
                  <p>
                    Cada fila es un <strong className="font-medium text-slate-900 dark:text-slate-100">ítem de stock</strong> (cantidad, ubicación, destino). Puede vincular un{" "}
                    <strong className="font-medium text-slate-900 dark:text-slate-100">producto del catálogo</strong> solo como{" "}
                    <strong className="font-medium text-slate-900 dark:text-slate-100">referencia de ficha</strong> (nueva pestaña); el inventario no sustituye el catálogo comercial.
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    Si la planilla trae una columna tipo «Nombre del producto», se guarda y se muestra bajo el serial y en la ficha del ítem. Las columnas de la tabla se eligen solo con el <strong className="font-medium">icono de líneas</strong> junto al botón <strong className="font-medium">+</strong> (panel lateral, como en Planificación).
                  </p>
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    <strong className="font-medium text-slate-700 dark:text-slate-300">Familia de línea:</strong> cambia qué columnas y filas tiene sentido mostrar juntas. Por ejemplo, unas importaciones traen muchas columnas de medidas eléctricas; otras traen pesos y material de proveedor. Si mezcla familias, verá celdas vacías: use el filtro o deje «Todas» y el sistema compacta la vista cuando todo el listado es del mismo tipo.
                  </p>
                </div>
              ) : null}
            </div>
            <Link
              href="/"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800/80"
            >
              Inicio
            </Link>
          </div>
        </div>
      </header>

      {error ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </div>
      ) : null}

      <section className="shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <button
          type="button"
          onClick={() => setInventoryToolsExpanded((v) => !v)}
          className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50/90 dark:hover:bg-slate-800/60"
          aria-expanded={inventoryToolsExpanded}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            aria-hidden
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Filtros y herramientas</span>
            {!inventoryToolsExpanded ? (
              <span className="mt-0.5 line-clamp-1 block text-[11px] font-normal text-slate-500 dark:text-slate-400">{inventoryFiltersSummary}</span>
            ) : null}
          </span>
          <span className="shrink-0 rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {inventoryToolsExpanded ? "Ocultar" : "Mostrar"}
          </span>
        </button>
        {inventoryToolsExpanded ? (
          <div className="max-h-[min(28vh,300px)] overflow-y-auto border-t border-slate-200 suite-scroll dark:border-slate-700">
            <div className="space-y-2.5 p-3">
              <div className="flex items-center justify-end">
                <div className="relative" ref={inventoryFiltrosHelpRef}>
                  <button
                    type="button"
                    onClick={() => setInventoryFiltrosHelpOpen((v) => !v)}
                    aria-expanded={inventoryFiltrosHelpOpen}
                    aria-controls="inventory-filtros-help-popover"
                    title="Ayuda: filtros, importación masiva y herramientas por proyecto"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600 shadow-sm hover:border-primary-400 hover:bg-primary-50 hover:text-primary-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-primary-500 dark:hover:bg-slate-700"
                  >
                    ?
                  </button>
                  {inventoryFiltrosHelpOpen ? (
                    <div
                      id="inventory-filtros-help-popover"
                      role="dialog"
                      aria-label="Ayuda filtros y herramientas"
                      className="absolute right-0 z-50 mt-1 w-[min(100vw-1.5rem,22rem)] max-h-[min(55vh,380px)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-relaxed text-slate-700 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <p>
                        Los filtros aplican al <strong className="font-medium text-slate-900 dark:text-slate-100">destino de cada fila</strong>, no a «todo el proyecto comercial». Use el botón{" "}
                        <strong className="font-medium">+</strong> en la tabla de ítems para importar o exportar.
                      </p>
                      <p className="mt-2 text-slate-600 dark:text-slate-400">
                        «Proyecto» y «Cotización» muestran solo ítems cuyo <strong className="font-normal">destino de stock</strong> coincide. Para cargas grandes, prepare una hoja en <strong className="font-normal">Excel</strong> y use <strong className="font-normal">+</strong> →{" "}
                        <strong className="font-normal">Importar masivo (CSV / XLSX)</strong> (hasta 20&nbsp;000 filas).
                      </p>
                      <p className="mt-2 border-t border-slate-200 pt-2 font-semibold text-slate-900 dark:text-slate-100 dark:border-slate-600">Herramientas por proyecto</p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        El selector <strong className="font-normal">Proyecto (herramientas)</strong> es independiente del filtro de la tabla: elija el proyecto sobre el que quiere analizar duplicados, corregir enlaces o borrar stock. El código corto del proyecto es el que ve al inicio de cada opción del desplegable.
                      </p>
                      <p className="mt-2 text-slate-600 dark:text-slate-400">
                        <strong className="font-medium text-slate-800 dark:text-slate-200">Duplicados:</strong> revisa filas con el mismo número de serie en destino <strong className="font-normal">Proyecto / obra</strong>, por si se importó dos veces la misma planilla.
                      </p>
                      <p className="mt-2 text-slate-600 dark:text-slate-400">
                        <strong className="font-medium text-slate-800 dark:text-slate-200">Corregir catálogo:</strong> alinea las filas importadas desde planillas con la ficha de producto adecuada cuando el sistema detecta datos incoherentes entre lo importado y el catálogo. No borra cantidades ni seriales.
                      </p>
                      <p className="mt-2 text-slate-600 dark:text-slate-400">
                        <strong className="font-medium text-slate-800 dark:text-slate-200">Borrar stock del proyecto:</strong> elimina filas de inventario; no elimina productos del catálogo ni el proyecto comercial. Tras confirmar en el navegador se pedirá un código de seguridad interno.
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Destino
            <select
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
              className="input-field mt-1 w-full text-sm"
            >
              <option value="">Todos</option>
              {(Object.keys(DESTINO_LABEL) as InventoryDestinationKind[]).map((k) => (
                <option key={k} value={k}>
                  {DESTINO_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Familia de línea
            <select
              value={filterLineSegment}
              onChange={(e) => setFilterLineSegment(e.target.value as InventoryLineSegmentFilter)}
              className="input-field mt-1 w-full text-sm"
              title="Solo afecta la vista en pantalla, no vuelve a cargar datos. Separe listas de proveedor, planillas con serial y el resto."
            >
              {INVENTORY_LINE_SEGMENT_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" title="Solo ítems cuyo destino de stock sea este proyecto">
            Proyecto
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="input-field mt-1 w-full text-sm"
            >
              <option value="">— Cualquier proyecto —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400" title="Solo ítems cuyo destino de stock sea esta cotización">
            Cotización
            <select
              value={filterQuoteId}
              onChange={(e) => setFilterQuoteId(e.target.value)}
              className="input-field mt-1 w-full text-sm"
            >
              <option value="">— Cualquier cotización —</option>
              {quotes.map((q) => (
                <option key={q.id} value={q.id}>
                  {(q.commercialNumber ?? q.id).slice(0, 24)} · {q.title.slice(0, 40)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Buscar
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="input-field mt-1 w-full text-sm"
              placeholder="Nombre, SKU, serial…"
            />
          </label>
          <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
            Pallet (ID)
            <input
              value={filterPallet}
              onChange={(e) => setFilterPallet(e.target.value)}
              className="input-field mt-1 w-full text-sm font-mono"
              placeholder="p. ej. 2026123560127001"
            />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => applyFiltersToUrl()} className="btn-primary rounded-lg px-3 py-1.5 text-xs font-semibold">
            Aplicar filtros
          </button>
          <button
            type="button"
            onClick={() => clearAllFilters()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            Limpiar filtros
          </button>
        </div>
        {canWrite ? (
          <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-800/50">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Proyecto (herramientas)
              <select
                value={massOpsProjectId}
                onChange={(e) => setMassOpsProjectId(e.target.value)}
                className="input-field mt-1 w-full max-w-xl py-1.5 text-sm"
              >
                <option value="">— Seleccione —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            {massOpsProjectId.trim() ? (
              <p className="mt-1.5 text-[10px] font-mono font-semibold text-amber-900 dark:text-amber-200">
                Código: {projects.find((p) => p.id === massOpsProjectId)?.code ?? "—"}
              </p>
            ) : null}
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Duplicados (serial)</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!massOpsProjectId.trim() || duplicateScanLoading || dedupeLoading || purgeLoading}
                onClick={() => void scanInventoryDuplicates()}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                {duplicateScanLoading ? "Analizando…" : "Analizar duplicados"}
              </button>
              <button
                type="button"
                disabled={
                  !massOpsProjectId.trim() ||
                  dedupeLoading ||
                  duplicateScanLoading ||
                  purgeLoading ||
                  !duplicateReport ||
                  duplicateReport.extraDuplicateRows === 0
                }
                onClick={() => void runDedupeInventoryOldest()}
                className="rounded-lg border border-red-300/80 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-900 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
              >
                {dedupeLoading ? "Eliminando…" : "Quitar duplicados (antiguo)"}
              </button>
            </div>
            {duplicateReport ? (
              <p className="mt-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                Seriales duplicados: <strong className="text-slate-800 dark:text-slate-200">{duplicateReport.duplicateSerials.length}</strong> · Filas extra:{" "}
                <strong className="text-slate-800 dark:text-slate-200">{duplicateReport.extraDuplicateRows}</strong>
              </p>
            ) : null}
            <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-600">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">Catálogo</p>
              <button
                type="button"
                disabled={!massOpsProjectId.trim() || relinkOqcLoading || duplicateScanLoading || dedupeLoading || purgeLoading}
                onClick={() => void runRelinkOqcCatalog()}
                title="Revisa filas importadas por planilla y alinea el producto del catálogo cuando haya datos que no coinciden. Más detalle en ? arriba."
                className="mt-1 rounded-lg border border-amber-300/90 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-900/50 dark:bg-amber-950/35 dark:text-amber-100 dark:hover:bg-amber-950/55"
              >
                {relinkOqcLoading ? "Aplicando…" : "Corregir enlaces al catálogo"}
              </button>
            </div>
            <div className="mt-2 border-t border-red-200/80 pt-2 dark:border-red-900/45">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-900 dark:text-red-200">Borrar stock del proyecto</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={!massOpsProjectId.trim() || purgeLoading || duplicateScanLoading || dedupeLoading || relinkOqcLoading}
                  onClick={() => requestPurgeProjectInventory("OQC_PANELS_ONLY")}
                  title="Solo filas cargadas desde planillas con número de serie (no listas de proveedor ni otros tipos). Se pedirá código de seguridad."
                  className="rounded-lg border border-red-400/90 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-950 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
                >
                  {purgeLoading ? "Borrando…" : "Solo planillas importadas"}
                </button>
                <button
                  type="button"
                  disabled={!massOpsProjectId.trim() || purgeLoading || duplicateScanLoading || dedupeLoading || relinkOqcLoading}
                  onClick={() => requestPurgeProjectInventory("ALL_PROJECT_DESTINATION")}
                  title="Todo el stock con destino «Proyecto / obra» en este proyecto, venga de planilla, BL, lista o carga manual. Se pedirá código de seguridad."
                  className="rounded-lg border border-red-700/80 bg-red-600/15 px-2.5 py-1 text-[11px] font-semibold text-red-950 hover:bg-red-600/25 disabled:opacity-50 dark:border-red-700 dark:bg-red-950/55 dark:text-red-50 dark:hover:bg-red-950/80"
                >
                  Todo el stock (obra)
                </button>
              </div>
            </div>
          </div>
        ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        <section className="flex min-h-0 flex-1 flex-col overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
          <input
            ref={oqcSpreadsheetInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            aria-hidden
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              ev.target.value = "";
              if (f) void onOqcSpreadsheetChosen(f);
            }}
          />
          <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
            <div className="min-w-0 max-w-full flex-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Ítems ({inventoryTotals.n}
                {inventoryTotals.totalLoaded !== inventoryTotals.n ? ` de ${inventoryTotals.totalLoaded}` : ""})
              </h2>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                Unidades: <strong className="font-medium text-slate-700 dark:text-slate-300">{inventoryTotals.sumQty}</strong>
                {inventoryTotals.oqcProjectSerials > 0 ? (
                  <>
                    {" "}
                    · Seriales en obra (vista): <strong className="font-medium text-slate-700 dark:text-slate-300">{inventoryTotals.oqcProjectSerials}</strong>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
              <button
                type="button"
                onClick={() => setInventoryColsDrawerOpen(true)}
                title="Columnas y vista"
                aria-label="Columnas de la tabla"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                </svg>
              </button>
              {canWrite ? (
                <div ref={inventoryItemsMenuRef} className="relative shrink-0">
                  <button
                    type="button"
                    onClick={() => setInventoryItemsMenuOpen((v) => !v)}
                    aria-expanded={inventoryItemsMenuOpen}
                    aria-haspopup="menu"
                    title="Más: CSV, importación masiva, lectura IA, nuevo ítem"
                    aria-label="Más acciones: exportar CSV, importar archivo masivo, lectura IA o nuevo ítem"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-xl font-light leading-none text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    +
                  </button>
                  {inventoryItemsMenuOpen ? (
                    <div
                      role="menu"
                      className="absolute right-0 z-50 mt-1 min-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={rowsForTable.length === 0}
                        onClick={() => {
                          downloadInventoryCsv(inventoryTableRowsSorted, "inventario-logistica");
                          setInventoryItemsMenuOpen(false);
                        }}
                        className="flex w-full px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        Descargar CSV (vista actual)
                      </button>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                      <button
                        type="button"
                        role="menuitem"
                        disabled={importingSpreadsheet}
                        onClick={() => {
                          setInventoryItemsMenuOpen(false);
                          openInventoryBulkSpreadsheetModal();
                        }}
                        className="flex w-full px-3 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-100 dark:hover:bg-slate-800"
                      >
                        {importingSpreadsheet ? "Importando archivo…" : "Importar masivo (CSV / XLSX)"}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setInventoryItemsMenuOpen(false);
                          setBomPdfModalOpen(true);
                        }}
                        className="flex w-full px-3 py-2.5 text-left text-sm font-semibold text-violet-700 ring-1 ring-inset ring-transparent hover:bg-violet-50 hover:ring-violet-200 dark:text-violet-200 dark:hover:bg-violet-950/50 dark:hover:ring-violet-500/40"
                      >
                        Importar con lectura IA…
                      </button>
                      <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setInventoryItemsMenuOpen(false);
                          openNewItemModal();
                        }}
                        className="flex w-full px-3 py-2.5 text-left text-sm font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-950/40"
                      >
                        Nuevo ítem…
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={rowsForTable.length === 0}
                  onClick={() => downloadInventoryCsv(inventoryTableRowsSorted, "inventario-logistica")}
                  className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  title="UTF-8 con BOM. Respeta filtros actuales."
                >
                  Descargar CSV
                </button>
              )}
            </div>
          </div>
          {loading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center p-6">
              <p className="text-sm text-slate-500 dark:text-slate-400">Cargando inventario…</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6 suite-scroll">
              {hasNarrowingFilters ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-medium">No hay filas con los filtros actuales.</p>
                  <p className="mt-1 text-xs leading-relaxed opacity-95">
                    Si importó <strong className="font-normal">Operación internacional</strong> con el proyecto correcto, el ítem aparece aquí aunque el destino sea «general» (queda vinculado al proyecto por la importación). Si no ve nada, importe de nuevo eligiendo el proyecto o pulse{" "}
                    <strong className="font-normal">Limpiar filtros (ver todo)</strong>. También: si filtra por cotización, el stock general no se lista.
                  </p>
                  <p className="mt-2 text-xs">
                    <Link
                      href={`/vista-previa-suite/logistica/operacion-internacional${
                        filterProjectId.trim() ? `?projectId=${encodeURIComponent(filterProjectId.trim())}` : ""
                      }`}
                      className="font-semibold text-amber-900 underline dark:text-amber-200"
                    >
                      Abrir Operación internacional (importar Excel)
                    </Link>
                  </p>
                  <button
                    type="button"
                    onClick={() => clearAllFilters()}
                    className="mt-2 text-xs font-semibold text-amber-900 underline dark:text-amber-200"
                  >
                    Quitar todos los filtros ahora
                  </button>
                </div>
              ) : null}
              {!hasNarrowingFilters ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200">
                  <p className="font-medium text-slate-900 dark:text-slate-100">La lista está vacía: no hay ítems guardados en el inventario de esta base de datos.</p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    El <strong className="font-normal">inventario</strong> es la lista de stock (seriales, pallets, proyecto). El <strong className="font-normal">catálogo</strong> es solo referencia técnica/comercial del artículo; no sustituye filas de inventario. Use el botón{" "}
                    <strong className="font-normal">+</strong> → <strong className="font-normal">Nuevo ítem</strong>, los atajos del catálogo abajo, o importe en{" "}
                    <Link href="/vista-previa-suite/logistica/operacion-internacional" className="font-semibold text-primary-600 underline dark:text-primary-400">
                      Operación internacional
                    </Link>
                    . Si otra PC tiene los datos, revise <span className="font-mono">/setup</span> (misma URL de API).
                  </p>
                  {process.env.NODE_ENV === "development" ? (
                    <p className="mt-2 break-all font-mono text-[10px] text-slate-500 dark:text-slate-500">API en uso: {getApiBase()}</p>
                  ) : null}
                  {!loading && products.length > 0 ? (
                    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Atajos desde catálogo (productos ACTIVOS — no son filas de inventario hasta que guarde)
                      </p>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {products.slice(0, 12).map((p) => (
                          <div
                            key={p.id}
                            className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-600 dark:bg-slate-900/60"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-2 font-medium text-slate-900 dark:text-slate-100">{p.name}</div>
                              <div className="mt-0.5 font-mono text-[10px] text-slate-500">{p.sku ?? p.internalCode ?? "—"}</div>
                            </div>
                            {canWrite ? (
                              <button
                                type="button"
                                onClick={() => prefillFromProduct(p)}
                                className="shrink-0 rounded-md bg-amber-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                              >
                                Agregar…
                              </button>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        Listado rápido (12 primeros ACTIVOS). Todos los productos:{" "}
                        <Link
                          href="/productos"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-primary-600 underline dark:text-primary-400"
                        >
                          Catálogo → Productos (nueva pestaña)
                        </Link>
                        .
                      </p>
                    </div>
                  ) : !loading && products.length === 0 ? (
                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                      No hay productos ACTIVOS en catálogo para sugerir. Cargue el catálogo o cree un ítem desde el botón <strong className="font-normal">+</strong>.
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  También puede usar el botón <strong className="font-normal">+</strong> → <strong className="font-normal">Nuevo ítem</strong>.
                </p>
              )}
            </div>
          ) : rowsForTable.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto p-8 suite-scroll">
              <div className="max-w-md rounded-xl border border-slate-200 bg-slate-50 p-5 text-center dark:border-slate-600 dark:bg-slate-800/60">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ninguna fila coincide con «Familia de línea»</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Se cargaron <strong className="font-medium text-slate-800 dark:text-slate-200">{rows.length}</strong> ítems con los filtros de servidor actuales; el filtro de familía solo oculta filas en esta vista.
                </p>
                <button
                  type="button"
                  onClick={() => setFilterLineSegment("")}
                  className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                >
                  Ver todas las familias
                </button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-2xl">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5 dark:border-slate-800">
                <div className="min-w-0 flex-1 space-y-1">
                  {homogeneousLayoutWhenAllFamilies ? (
                    <p className="rounded-md border border-violet-400/35 bg-violet-500/[0.07] px-2 py-1 text-[10px] leading-snug text-violet-950 dark:border-violet-400/40 dark:bg-violet-950/45 dark:text-violet-100">
                      Las filas visibles son solo{" "}
                      <strong className="font-semibold">
                        {homogeneousLayoutWhenAllFamilies === "supplier_bom" ? "lista de proveedor" : "planillas con serial"}
                      </strong>
                      : se ocultan columnas que no aplican (así dejan de verse tantos «—»). El filtro{" "}
                      <strong className="font-medium">Familia de línea</strong> sigue en «Todas»; cámbielo si quiere acotar qué filas entran en la tabla.
                    </p>
                  ) : null}
                  <details className="max-w-[min(100%,42rem)] text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                    <summary className="cursor-pointer select-none text-[10px] font-semibold text-slate-600 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400">
                      Ayuda: tabla y exportar
                    </summary>
                    <p className="mt-1.5">
                      Use el icono de <strong className="font-medium">líneas</strong> (a la izquierda del <strong className="font-medium">+</strong>) para mostrar u ocultar columnas. Arrastre la{" "}
                      <strong className="font-medium">franja estrecha</strong> a la derecha del título para cambiar el ancho. Con el filtro{" "}
                      <strong className="font-medium">Familia de línea</strong> en listas de proveedor, la tabla prioriza columnas de material y peso; con planillas de serial prioriza otras columnas.{" "}
                      Con <strong className="font-medium">Todas las familias</strong>, si solo hay un tipo de fila, el ajuste se hace solo.{" "}
                      <strong className="font-medium">Destino</strong> y <strong className="font-medium">Transporte</strong>: más texto al pasar el cursor. La exportación desde <strong className="font-medium">+</strong> respeta filtros y orden.
                    </p>
                  </details>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  {inventoryColumnLayoutDirty ? (
                    <button
                      type="button"
                      onClick={persistInventoryColWidths}
                      className="shrink-0 rounded-lg border border-primary-500/60 bg-primary-500/10 px-3 py-1.5 text-[11px] font-semibold text-primary-800 hover:bg-primary-500/20 dark:text-primary-200 dark:hover:bg-primary-500/15"
                    >
                      Guardar vista previa
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-auto suite-scroll">
                <table
                  className="table-fixed border-collapse text-left text-xs"
                  style={{ width: `max(100%, ${inventoryTableMinPx}px)` }}
                >
                <colgroup>
                  {inventoryVisibleKeys.map((k) => (
                    <col key={k} style={{ width: liveColWidths[k] }} />
                  ))}
                </colgroup>
                <thead className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50 shadow-[0_2px_6px_rgba(15,23,42,0.08)] backdrop-blur-md dark:border-slate-600 dark:bg-slate-800/95 dark:shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
                  <tr className="text-slate-600 dark:text-slate-300">
                    {inventoryVisibleKeys.map((k, colIdx) => {
                      const thProps = {
                        sort: inventoryTableSort,
                        onCycle: cycleInventoryTableSort,
                        onBeginColResize: beginInventoryColResize,
                        showResizeHandle: colIdx < inventoryVisibleKeys.length - 1,
                      };
                      switch (k) {
                        case "serial":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Serial"
                              sortKey="serial"
                              {...thProps}
                              className="sticky left-0 top-0 z-[40] border-r border-slate-200 bg-slate-50 px-2 py-2 text-[10px] shadow-[1px_0_0_rgba(15,23,42,0.06)] dark:border-slate-600 dark:bg-slate-800 dark:shadow-[1px_0_0_rgba(0,0,0,0.35)]"
                            />
                          );
                        case "bomNo":
                          return (
                            <InventoryThSort
                              key={k}
                              label="N° BOM"
                              sortKey="bomNo"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="center"
                            />
                          );
                        case "bomCotiz":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Ref. cotiz."
                              sortKey="bomCotiz"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "bomMatSpec":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Mat. / espec."
                              sortKey="bomMatSpec"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "bomUnitKg":
                          return (
                            <InventoryThSort
                              key={k}
                              label="kg/u"
                              sortKey="bomUnitKg"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "bomTotKg":
                          return (
                            <InventoryThSort
                              key={k}
                              label="kg tot."
                              sortKey="bomTotKg"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "itemN":
                          return (
                            <InventoryThSort
                              key={k}
                              label="N°"
                              sortKey="itemN"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="center"
                            />
                          );
                        case "pallet":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Pallet"
                              sortKey="pallet"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "ff":
                          return (
                            <InventoryThSort
                              key={k}
                              label="FF %"
                              sortKey="ff"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "isc":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Isc"
                              sortKey="isc"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "voc":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Voc"
                              sortKey="voc"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "imp":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Imp"
                              sortKey="imp"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "vmp":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Vmp"
                              sortKey="vmp"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "pm":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Pm W"
                              sortKey="pm"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "informe":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Informe"
                              sortKey="informe"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "transp":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Transp."
                              sortKey="transp"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "proy":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Proy."
                              sortKey="proy"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "modelo":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Modelo"
                              sortKey="modelo"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        case "cant":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Cant."
                              sortKey="cant"
                              {...thProps}
                              className="bg-slate-50 px-1 py-2 text-[10px] dark:bg-slate-800"
                              align="right"
                            />
                          );
                        case "destino":
                          return (
                            <InventoryThSort
                              key={k}
                              label="Destino"
                              sortKey="destino"
                              {...thProps}
                              className="bg-slate-50 px-2 py-2 text-[10px] dark:bg-slate-800"
                            />
                          );
                        default:
                          return null;
                      }
                    })}
                  </tr>
                </thead>
                <tbody>
                  {inventoryTableRowsSorted.map((r) => {
                    const oqcModelLine = inventoryRowOqcModelFromReport(r);
                    const oqc = parseInventoryRowOqc(r);
                    const bom = parseInventoryRowSupplierBom(r);
                    const serialSub = inventorySerialColumnSubtitle(r);
                    const palletDisplay =
                      oqc?.palletNumber?.trim() ||
                      (r.storageLocation?.trim().toLowerCase().startsWith("pallet") ? r.storageLocation.trim() : null);
                    const transportSummary = oqc
                      ? [oqc.tripNumber, oqc.truckLabel, oqc.driverLabel].filter(Boolean).join(" · ") || ""
                      : "";
                    const transportTitle = oqc
                      ? [
                          oqc.tripNumber ? `Viaje: ${oqc.tripNumber}` : "",
                          oqc.truckLabel ? `Camión: ${oqc.truckLabel}` : "",
                          oqc.driverLabel ? `Conductor: ${oqc.driverLabel}` : "",
                        ]
                          .filter(Boolean)
                          .join("\n") || "Pendiente: módulo Logística → Transporte."
                      : "";
                    return (
                    <tr
                      key={r.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => loadRowIntoForm(r)}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          loadRowIntoForm(r);
                        }
                      }}
                      className="group cursor-pointer border-b border-slate-100 transition hover:bg-slate-50/90 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      {inventoryVisibleKeys.map((col) => {
                        switch (col) {
                          case "serial":
                            return (
                              <td
                                key={col}
                                className="sticky left-0 z-[10] max-w-0 overflow-hidden border-r border-slate-100 bg-white/95 px-2 py-1.5 align-middle font-mono text-[11px] font-medium text-slate-900 shadow-[1px_0_0_rgba(15,23,42,0.04)] backdrop-blur-sm group-hover:bg-slate-50/95 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-100 dark:shadow-[1px_0_0_rgba(0,0,0,0.35)] dark:group-hover:bg-slate-800/95"
                              >
                                <span className="block break-all">{r.sku?.trim() || "—"}</span>
                                {serialSub ? (
                                  <div className="mt-0.5 line-clamp-2 font-sans text-[10px] font-normal text-slate-500 dark:text-slate-400" title={serialSub}>
                                    {serialSub}
                                  </div>
                                ) : null}
                                <div className="mt-0.5">
                                  <span
                                    className="inline-flex rounded border border-slate-200 bg-slate-100 px-1 py-px font-sans text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                    title={inventoryLineSegmentTitle(r)}
                                  >
                                    {inventoryLineSegmentShortLabel(r)}
                                  </span>
                                </div>
                                {r.storageLocation && !palletDisplay && !oqc ? (
                                  <div className="mt-0.5 font-sans text-[10px] text-slate-500">{r.storageLocation}</div>
                                ) : null}
                              </td>
                            );
                          case "bomNo":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-center tabular-nums text-slate-700 dark:text-slate-200">
                                {bom?.bomLineNo != null ? bom.bomLineNo : "—"}
                              </td>
                            );
                          case "bomCotiz":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-2 py-1.5 align-middle">
                                {bom?.supplierQuoteRef ? (
                                  <span className="line-clamp-2 break-all font-mono text-[10px] text-slate-600 dark:text-slate-300" title={bom.supplierQuoteRef}>
                                    {bom.supplierQuoteRef}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          case "bomMatSpec":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-2 py-1.5 text-[10px] text-slate-700 dark:text-slate-200">
                                {bom ? (
                                  <span className="line-clamp-3 break-words" title={supplierBomMatSpecSummary(bom) || undefined}>
                                    {supplierBomMatSpecSummary(bom) || "—"}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          case "bomUnitKg":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {bom?.unitWeightKg != null && Number.isFinite(bom.unitWeightKg) ? cellMetric(bom.unitWeightKg, 4) : "—"}
                              </td>
                            );
                          case "bomTotKg":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {bom?.totalWeightKg != null && Number.isFinite(bom.totalWeightKg) ? cellMetric(bom.totalWeightKg, 3) : "—"}
                              </td>
                            );
                          case "itemN":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-center tabular-nums text-slate-700 dark:text-slate-200">
                                {oqc?.itemN != null ? oqc.itemN : "—"}
                              </td>
                            );
                          case "pallet":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-2 py-1.5 align-middle font-mono text-[11px] text-slate-800 dark:text-slate-200">
                                {palletDisplay ? <span className="line-clamp-2 break-all" title={palletDisplay}>{palletDisplay}</span> : "—"}
                              </td>
                            );
                          case "ff":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {oqc?.ffPercent != null && Number.isFinite(oqc.ffPercent) ? `${cellMetric(oqc.ffPercent, 2)}%` : "—"}
                              </td>
                            );
                          case "isc":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {cellMetric(oqc?.isc ?? null, 2)}
                              </td>
                            );
                          case "voc":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {cellMetric(oqc?.voc ?? null, 2)}
                              </td>
                            );
                          case "imp":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {cellMetric(oqc?.imp ?? null, 2)}
                              </td>
                            );
                          case "vmp":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {cellMetric(oqc?.vmp ?? null, 2)}
                              </td>
                            );
                          case "pm":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">
                                {cellMetric(oqc?.pmW ?? null, 2)}
                              </td>
                            );
                          case "informe":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-2 py-1.5 align-middle">
                                {oqc?.reportRef ? (
                                  <span className="line-clamp-2 break-all font-mono text-[10px] text-slate-600 dark:text-slate-300" title={oqc.reportRef}>
                                    {oqc.reportRef}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          case "transp":
                            return (
                              <td
                                key={col}
                                className="max-w-0 overflow-hidden px-2 py-1.5 align-middle text-[10px] leading-snug text-slate-700 dark:text-slate-200"
                                title={transportTitle}
                              >
                                {oqc ? (
                                  transportSummary ? (
                                    <span className="line-clamp-3 break-words text-emerald-800 dark:text-emerald-200/90">{transportSummary}</span>
                                  ) : (
                                    <span className="text-slate-400">Pend.</span>
                                  )
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          case "proy":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-2 py-1.5 align-middle text-[11px]">
                                {r.project ? (
                                  <Link
                                    className="font-semibold text-primary-600 underline dark:text-primary-400"
                                    href={`/vista-previa-suite/proyectos/${r.project.id}`}
                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                  >
                                    {r.project.code}
                                  </Link>
                                ) : r.quote ? (
                                  <Link
                                    className="text-primary-600 underline dark:text-primary-400"
                                    href={`/cotizaciones/${r.quote.id}`}
                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                  >
                                    {(r.quote.commercialNumber ?? "Cot.").slice(0, 10)}
                                  </Link>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          case "modelo":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-2 py-1.5 align-middle text-[10px] leading-snug text-slate-700 dark:text-slate-200">
                                {oqc?.sheetProductName ? (
                                  <span
                                    className="line-clamp-2 block font-medium text-slate-800 dark:text-slate-100"
                                    title={oqc.sheetProductName}
                                  >
                                    {oqc.sheetProductName}
                                  </span>
                                ) : null}
                                {oqcModelLine ? (
                                  <span
                                    className={oqc?.sheetProductName ? "mt-0.5 line-clamp-2 block text-slate-600 dark:text-slate-300" : "line-clamp-2"}
                                    title={oqcModelLine}
                                  >
                                    {oqcModelLine}
                                  </span>
                                ) : null}
                                {r.product ? (
                                  <Link
                                    className="mt-0.5 line-clamp-2 block font-medium text-primary-600 underline dark:text-primary-400"
                                    href={`${LOGISTICA_FICHA_PRODUCTO}/${encodeURIComponent(r.product.id)}`}
                                    title={r.product.name}
                                    onClick={(e: MouseEvent) => e.stopPropagation()}
                                  >
                                    {r.product.name}
                                  </Link>
                                ) : null}
                                {!oqcModelLine && !r.product && !oqc?.sheetProductName ? "—" : null}
                              </td>
                            );
                          case "cant":
                            return (
                              <td key={col} className="max-w-0 overflow-hidden px-1 py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                                {r.quantity}
                                <span className="block text-[9px] font-normal text-slate-500">{r.unit}</span>
                              </td>
                            );
                          case "destino":
                            return (
                              <td
                                key={col}
                                className="max-w-0 overflow-hidden px-2 py-1.5 align-middle text-[10px] leading-tight text-slate-700 dark:text-slate-200"
                                title={r.destinationNote?.trim() || undefined}
                              >
                                <span className="line-clamp-2">{DESTINO_LABEL[r.destinationKind as InventoryDestinationKind] ?? r.destinationKind}</span>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {!canWrite ? (
          <p className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            Solo lectura: su rol no incluye crear o editar inventario.
          </p>
        ) : null}
        {purgePinModal && canWrite ? (
          <div
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="purge-pin-modal-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
              aria-label="Cerrar"
              onClick={() => {
                setPurgePinModal(null);
                setPurgePinInput("");
              }}
            />
            <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
              <h2 id="purge-pin-modal-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
                Código de seguridad
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {purgePinModal.scope === "OQC_PANELS_ONLY" ? (
                  <>
                    Va a borrar solo las filas cargadas desde <strong className="font-medium text-slate-800 dark:text-slate-200">planillas con número de serie</strong> en el proyecto elegido.
                  </>
                ) : (
                  <>
                    Va a borrar <strong className="font-medium text-slate-800 dark:text-slate-200">todo</strong> el stock con destino obra en el proyecto elegido (cualquier origen).
                  </>
                )}{" "}
                Introduzca el código interno autorizado. No se guarda en pantalla.
              </p>
              <input
                type="password"
                autoComplete="off"
                value={purgePinInput}
                onChange={(e) => setPurgePinInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void confirmPurgeWithSecurityPin();
                }}
                className="input-field mt-3 w-full"
              />
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  onClick={() => {
                    setPurgePinModal(null);
                    setPurgePinInput("");
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={purgeLoading}
                  onClick={() => void confirmPurgeWithSecurityPin()}
                  className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  {purgeLoading ? "Borrando…" : "Confirmar borrado"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {itemModalOpen && canSee ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-item-modal-title"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
              aria-label="Cerrar"
              onClick={() => resetForm()}
            />
            <div className="relative flex max-h-[min(92vh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_80px_-20px_rgba(0,0,0,0.35)] ring-1 ring-black/5 dark:border-slate-600/90 dark:bg-[#0c0c0c] dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.65)] dark:ring-white/10">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/90 px-5 py-4 dark:border-slate-700/90">
                <div>
                  <h2 id="inventory-item-modal-title" className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">
                    {editingId ? (canWrite ? "Ítem de inventario" : "Detalle de ítem") : "Nuevo ítem de inventario"}
                  </h2>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {canWrite ? "Pulse fuera o Cerrar para salir sin guardar." : "Solo lectura: no puede modificar este registro."}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {editingId && canWrite ? (
                    <button type="button" onClick={resetForm} className="text-xs font-medium text-primary-600 underline dark:text-primary-400">
                      Cancelar edición
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 suite-scroll">
                <form onSubmit={onSubmitForm} className="space-y-4">
                  {inventoryModalOqc ? (
                    <div className="rounded-2xl border border-sky-200/90 bg-gradient-to-br from-sky-50 via-white to-slate-50 p-4 shadow-sm dark:border-sky-900/45 dark:from-sky-950/30 dark:via-[#101010] dark:to-slate-950/40">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-900 dark:text-sky-200">Datos de planilla</p>
                        <button
                          type="button"
                          onClick={() => setInventoryModalShowOqcDetail((v) => !v)}
                          className="shrink-0 rounded-full border border-sky-300/90 bg-white/90 px-3 py-1 text-[11px] font-semibold text-sky-900 shadow-sm hover:bg-white dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-100 dark:hover:bg-sky-900/70"
                        >
                          {inventoryModalShowOqcDetail ? "Ocultar edición" : "Editar datos de planilla"}
                        </button>
                      </div>
                      {!inventoryModalShowOqcDetail ? (
                        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-3 md:grid-cols-4">
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">N° ítem</dt>
                            <dd className="font-mono font-semibold text-slate-900 dark:text-slate-100">{inventoryModalOqc.itemN ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Pallet</dt>
                            <dd className="break-all font-mono text-slate-900 dark:text-slate-100">{inventoryModalOqc.palletNumber ?? "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">FF %</dt>
                            <dd className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                              {inventoryModalOqc.ffPercent != null && Number.isFinite(inventoryModalOqc.ffPercent)
                                ? `${cellMetric(inventoryModalOqc.ffPercent, 2)}%`
                                : "—"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Isc / Voc</dt>
                            <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                              {cellMetric(inventoryModalOqc.isc, 2)} / {cellMetric(inventoryModalOqc.voc, 2)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Imp / Vmp</dt>
                            <dd className="tabular-nums text-slate-900 dark:text-slate-100">
                              {cellMetric(inventoryModalOqc.imp, 2)} / {cellMetric(inventoryModalOqc.vmp, 2)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Pm (W)</dt>
                            <dd className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">{cellMetric(inventoryModalOqc.pmW, 2)}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-slate-500 dark:text-slate-400">Informe</dt>
                            <dd className="break-all font-mono text-[11px] text-slate-800 dark:text-slate-100">{inventoryModalOqc.reportRef ?? "—"}</dd>
                          </div>
                          <div className="sm:col-span-3">
                            <dt className="text-slate-500 dark:text-slate-400">Nombre producto (planilla)</dt>
                            <dd className="mt-0.5 line-clamp-3 text-slate-900 dark:text-slate-100">{inventoryModalOqc.sheetProductName ?? "—"}</dd>
                          </div>
                        </dl>
                      ) : (
                        <div className="mt-3 space-y-3 rounded-xl border border-sky-200/60 bg-white/60 p-3 dark:border-sky-900/40 dark:bg-slate-950/50">
                          <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                            Los cambios se aplican al guardar. El número de serie va también en el campo <strong className="font-medium">SKU</strong> del ítem.
                          </p>
                          <label className="block w-full min-w-0 text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400">Nombre del producto (columna de planilla)</span>
                            <input
                              className="input-field mt-0.5 w-full text-[11px]"
                              placeholder="p. ej. texto de «Nombre del producto» en el Excel"
                              value={inventoryModalOqc.sheetProductName ?? ""}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, {
                                    sheetProductName: e.target.value.trim() || null,
                                  }),
                                }))
                              }
                              disabled={!canWrite}
                            />
                          </label>
                          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">N° ítem</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px]"
                                inputMode="numeric"
                                value={inventoryModalOqc.itemN ?? ""}
                                onChange={(e) => {
                                  const t = e.target.value.trim();
                                  const n = t === "" ? null : Math.trunc(Number(t.replace(",", ".")));
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { itemN: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0 sm:col-span-2">
                              <span className="text-slate-500 dark:text-slate-400">Serial (panel)</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px]"
                                value={inventoryModalOqc.serialNumber ?? form.sku}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setForm((f) => ({
                                    ...f,
                                    sku: v,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { serialNumber: v.trim() || null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0 sm:col-span-3">
                              <span className="text-slate-500 dark:text-slate-400">Pallet</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px]"
                                value={inventoryModalOqc.palletNumber ?? ""}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { palletNumber: e.target.value.trim() || null }),
                                  }))
                                }
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">FF %</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px] tabular-nums"
                                inputMode="decimal"
                                value={roundFixed(inventoryModalOqc.ffPercent, 4)}
                                onChange={(e) => {
                                  const t = e.target.value.trim().replace(",", ".");
                                  const n = t === "" ? null : Number(t);
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { ffPercent: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">Isc</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px] tabular-nums"
                                inputMode="decimal"
                                value={roundFixed(inventoryModalOqc.isc, 4)}
                                onChange={(e) => {
                                  const t = e.target.value.trim().replace(",", ".");
                                  const n = t === "" ? null : Number(t);
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { isc: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">Voc</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px] tabular-nums"
                                inputMode="decimal"
                                value={roundFixed(inventoryModalOqc.voc, 4)}
                                onChange={(e) => {
                                  const t = e.target.value.trim().replace(",", ".");
                                  const n = t === "" ? null : Number(t);
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { voc: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">Imp</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px] tabular-nums"
                                inputMode="decimal"
                                value={roundFixed(inventoryModalOqc.imp, 4)}
                                onChange={(e) => {
                                  const t = e.target.value.trim().replace(",", ".");
                                  const n = t === "" ? null : Number(t);
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { imp: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">Vmp</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px] tabular-nums"
                                inputMode="decimal"
                                value={roundFixed(inventoryModalOqc.vmp, 4)}
                                onChange={(e) => {
                                  const t = e.target.value.trim().replace(",", ".");
                                  const n = t === "" ? null : Number(t);
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { vmp: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0">
                              <span className="text-slate-500 dark:text-slate-400">Pm (W)</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px] tabular-nums"
                                inputMode="decimal"
                                value={roundFixed(inventoryModalOqc.pmW, 4)}
                                onChange={(e) => {
                                  const t = e.target.value.trim().replace(",", ".");
                                  const n = t === "" ? null : Number(t);
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { pmW: n != null && Number.isFinite(n) ? n : null }),
                                  }));
                                }}
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0 sm:col-span-3">
                              <span className="text-slate-500 dark:text-slate-400">Informe</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px]"
                                value={inventoryModalOqc.reportRef ?? ""}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { reportRef: e.target.value.trim() || null }),
                                  }))
                                }
                                disabled={!canWrite}
                              />
                            </label>
                            <label className="block min-w-0 sm:col-span-3">
                              <span className="text-slate-500 dark:text-slate-400">Viaje / transporte (texto libre)</span>
                              <input
                                className="input-field mt-0.5 w-full font-mono text-[11px]"
                                placeholder="N° viaje, camión, conductor…"
                                value={inventoryModalOqc.tripNumber ?? ""}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { tripNumber: e.target.value.trim() || null }),
                                  }))
                                }
                                disabled={!canWrite}
                              />
                            </label>
                          </div>
                        </div>
                      )}
                      <div className="mt-4 rounded-xl border border-slate-200/90 bg-white/80 p-3 dark:border-slate-600 dark:bg-slate-900/70">
                        <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">Origen de la importación</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                          La planilla no se almacena en el servidor; se conservan el nombre del archivo, las mediciones y quién cargó los datos (cuando la importación se hace desde esta aplicación en la nube).
                        </p>
                        <dl className="mt-2 grid gap-1.5 text-[11px] sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Archivo de origen</dt>
                            <dd className="font-mono text-slate-900 dark:text-slate-100">{inventoryModalOqc.sourceFileHint?.trim() || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Importado por</dt>
                            <dd className="break-all text-slate-900 dark:text-slate-100">{inventoryModalOqc.sourceImportedByEmail?.trim() || "—"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Fecha de importación</dt>
                            <dd className="text-slate-900 dark:text-slate-100">{formatInventoryDateTime(inventoryModalOqc.sourceImportedAt)}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500 dark:text-slate-400">Ítem en inventario</dt>
                            <dd className="text-slate-900 dark:text-slate-100">
                              Alta: {editingInventoryMeta ? formatInventoryDateTime(editingInventoryMeta.createdAt) : "—"} · Última edición:{" "}
                              {editingInventoryMeta ? formatInventoryDateTime(editingInventoryMeta.updatedAt) : "—"}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyToClipboard(inventoryModalOqc.sourceFileHint?.trim() || "")}
                            disabled={!inventoryModalOqc.sourceFileHint?.trim()}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                          >
                            Copiar nombre de archivo
                          </button>
                        </div>
                        {canWrite ? (
                          <label className="mt-3 block text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                            Corregir nombre de archivo (texto en ficha)
                            <input
                              className="input-field mt-0.5 w-full font-mono text-[11px]"
                              value={inventoryModalOqc.sourceFileHint ?? ""}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  linksJson: mergeOqcPatchIntoLinksJson(f.linksJson, { sourceFileHint: e.target.value.trim() || null }),
                                }))
                              }
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <fieldset disabled={!canWrite} className="min-w-0 space-y-3 border-0 p-0 disabled:opacity-[0.88]">
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Nombre del ítem en inventario *
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="input-field mt-1 w-full text-sm"
                  placeholder="p.ej. Lote A — Panel EGE-720W-132N (GM12)"
                />
                <span className="mt-1 block text-[11px] font-normal normal-case text-slate-500 dark:text-slate-400">
                  Aparece en la primera columna de la tabla. Si elige un producto del catálogo abajo, puede repetir el mismo nombre u otro operativo; la ficha técnica se abre desde el enlace (nueva pestaña) sin salir del flujo de inventario.
                </span>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  SKU
                  <input
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="input-field mt-1 w-full text-sm"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Cantidad *
                  <input
                    required
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.quantity}
                    onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                    className="input-field mt-1 w-full text-sm"
                  />
                </label>
              </div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Unidad
                <input
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  className="input-field mt-1 w-full text-sm"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Ubicación física
                <input
                  value={form.storageLocation}
                  onChange={(e) => setForm((f) => ({ ...f, storageLocation: e.target.value }))}
                  className="input-field mt-1 w-full text-sm"
                  placeholder="Estante A, bodega norte…"
                />
              </label>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Destino del stock *
                <select
                  value={form.destinationKind}
                  onChange={(e) => setForm((f) => ({ ...f, destinationKind: e.target.value as InventoryDestinationKind }))}
                  className="input-field mt-1 w-full text-sm"
                >
                  {(Object.keys(DESTINO_LABEL) as InventoryDestinationKind[]).map((k) => (
                    <option key={k} value={k}>
                      {DESTINO_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Si elige <strong className="font-normal">Proyecto</strong>, seleccione proyecto abajo (no aplica a stock general ni mostrador).
                Si elige <strong className="font-normal">Cotización</strong>, seleccione la cotización. <strong className="font-normal">Otro</strong> permite nota libre u otros destinos.
              </p>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Proyecto (si destino = proyecto)
                <select
                  value={form.projectId}
                  onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                  className="input-field mt-1 w-full text-sm"
                  disabled={form.destinationKind !== "PROJECT" && form.destinationKind !== "OTHER"}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} · {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Cotización (si destino = cotización)
                <select
                  value={form.quoteId}
                  onChange={(e) => setForm((f) => ({ ...f, quoteId: e.target.value }))}
                  className="input-field mt-1 w-full text-sm"
                  disabled={form.destinationKind !== "QUOTE" && form.destinationKind !== "OTHER"}
                >
                  <option value="">—</option>
                  {quotes.map((q) => (
                    <option key={q.id} value={q.id}>
                      {(q.commercialNumber ?? "").slice(0, 20)} {q.title.slice(0, 36)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-600 dark:bg-slate-800/40">
                <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">Producto del catálogo (real)</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                  El desplegable apunta al <strong className="font-normal">mismo producto</strong> que en{" "}
                  <strong className="font-normal">Catálogo → Productos</strong>: ficha técnica, especificaciones FV, PDF y precios siguen allí; el inventario solo guarda{" "}
                  <strong className="font-normal">cantidad y logística</strong> de ese artículo. Por defecto se listan categorías típicas de planta FV; puede cambiar ámbito o buscar por nombre/SKU.
                </p>
                {canCreateProduct ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
                    <Link
                      href={buildProductosNuevoHref({ inventoryProjectId: filterProjectId })}
                      className="font-medium text-primary-600 underline dark:text-primary-400"
                      onClick={() => setItemModalOpen(false)}
                    >
                      Crear producto en catálogo
                    </Link>{" "}
                    (mismo flujo que Ventas: paso 1 ficha, paso 2 precio obligatorio). Al terminar volverá al inventario para vincular stock.
                  </p>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Sin permiso para crear productos: el alta de catálogo la debe hacer un usuario con rol de catálogo.
                  </p>
                )}
                <label className="mt-3 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Ámbito del listado
                  <select
                    value={catalogAreaKey}
                    onChange={(e) => setCatalogAreaKey(e.target.value)}
                    className="input-field mt-1 w-full text-sm"
                  >
                    <option value="fv_plant">Planta fotovoltaica (equipo y BOP habitual)</option>
                    <option value="all">Todo el catálogo (todas las categorías)</option>
                    <optgroup label="Una categoría">
                      {categoriesFlat.map((c) => (
                        <option key={c.id} value={`cat:${c.id}`}>
                          {c.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="mt-2 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Buscar en catálogo
                  <input
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="input-field mt-1 w-full text-sm"
                    placeholder="Nombre, SKU o código interno…"
                  />
                </label>
                <label className="mt-2 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  ¿Qué producto del catálogo es este stock? (opcional)
                  <select
                    value={form.productId}
                    onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                    className="input-field mt-1 w-full text-sm"
                    disabled={catalogLoading}
                  >
                    <option value="">— Solo ítem de inventario (sin artículo del catálogo) —</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        [{p.category?.name ?? "—"}] {(p.sku ?? p.internalCode ?? "").slice(0, 14) || "—"}{" "}
                        {p.name.slice(0, 44)}
                      </option>
                    ))}
                  </select>
                </label>
                {form.productId.trim() ? (
                  <p className="mt-2 text-[11px]">
                    <Link
                      href={`${LOGISTICA_FICHA_PRODUCTO}/${encodeURIComponent(form.productId.trim())}`}
                      className="font-medium text-primary-600 underline dark:text-primary-400"
                    >
                      Ver ficha técnica (Logística)
                    </Link>
                  </p>
                ) : null}
                {catalogLoading ? (
                  <p className="mt-2 text-[11px] text-slate-500">Cargando catálogo…</p>
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    {filteredCatalogProducts.length} coincidencia
                    {filteredCatalogProducts.length !== 1 ? "s" : ""}
                    {filteredCatalogProducts.length > MAX_PRODUCT_OPTIONS
                      ? ` · mostrando las primeras ${MAX_PRODUCT_OPTIONS} en el desplegable; refine la búsqueda o elija una categoría.`
                      : null}
                  </p>
                )}
              </div>
              <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Nota / detalle destino
                <textarea
                  value={form.destinationNote}
                  onChange={(e) => setForm((f) => ({ ...f, destinationNote: e.target.value }))}
                  rows={2}
                  className="input-field mt-1 w-full text-sm"
                  placeholder="Reserva para cliente X, devolución proveedor…"
                />
              </label>
              {inventoryModalOqc ? (
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Notas operativas adicionales (opcional)
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="input-field mt-1 w-full text-sm"
                    placeholder="Instrucciones para bodega, mandante o su equipo…"
                  />
                  <span className="mt-1 block text-[10px] font-normal normal-case text-slate-500 dark:text-slate-500">
                    Las notas técnicas de la planilla se mantienen al guardar; aquí solo añada o edite notas libres para su equipo (se guardan aparte).
                  </span>
                </label>
              ) : (
                <label className="block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                  Descripción
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="input-field mt-1 w-full text-sm"
                  />
                </label>
              )}
                  </fieldset>
                  <div className="flex flex-col gap-3 border-t border-slate-200/90 pt-4 dark:border-slate-700/90">
                    {canWrite && editingId ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!editingId) return;
                          void onDelete(editingId);
                        }}
                        className="w-full rounded-xl border border-red-500/50 bg-red-50 py-2.5 text-sm font-semibold text-red-900 hover:bg-red-100 dark:border-red-800/60 dark:bg-red-950/40 dark:text-red-100 dark:hover:bg-red-950/70"
                      >
                        Eliminar del inventario
                      </button>
                    ) : null}
                    {canWrite ? (
                      <button type="submit" disabled={saving} className="btn-primary w-full rounded-xl py-3 text-sm font-semibold disabled:opacity-50">
                        {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear ítem"}
                      </button>
                    ) : null}
                  </div>
            </form>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {oqcImportModal === "spreadsheet" && canWrite ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-import-project-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[1px]"
            aria-label="Cerrar"
            onClick={() => setOqcImportModal(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
            <h2 id="bulk-import-project-title" className="text-base font-bold text-slate-900 dark:text-slate-100">
              Importar masivo (CSV / XLSX)
            </h2>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Elija el <strong className="font-medium text-slate-800 dark:text-slate-200">proyecto destino</strong> de las filas importadas (obra / stock proyecto). Sirve para hojas con columna de número de serie u otros formatos de carga masiva. El proyecto se pre-rellena con el filtro actual o el primero de la lista si aplica.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Proyecto destino *
              <select
                value={oqcImportProjectId}
                onChange={(e) => setOqcImportProjectId(e.target.value)}
                className="input-field mt-1 w-full text-sm"
              >
                <option value="" disabled>
                  — Seleccione —
                </option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setOqcImportModal(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button type="button" onClick={confirmOqcSpreadsheetChooseFile} className="btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
                Continuar y elegir archivo…
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <SupplierBomImportModal
        open={bomPdfModalOpen}
        onClose={() => setBomPdfModalOpen(false)}
        projects={projects}
        defaultProjectId={filterProjectId}
        canWrite={canWrite}
        onImported={() => void reload()}
      />
      <InventoryTableColumnsDrawer
        open={inventoryColsDrawerOpen}
        onClose={() => setInventoryColsDrawerOpen(false)}
        orderedColumnIds={INVENTORY_TABLE_COL_ORDER}
        colLabels={INVENTORY_COL_LABELS}
        colVisible={inventoryColVisible}
        setColVisible={setInventoryColVisible}
        fixedColumnIds={["serial"]}
      />
    </div>
  );
}

export default function LogisticaInventarioPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600 dark:text-slate-400">Cargando inventario…</p>}>
      <LogisticaInventarioInner />
    </Suspense>
  );
}

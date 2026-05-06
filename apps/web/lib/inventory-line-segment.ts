import type { InventoryListRow } from "./api";

/**
 * Mantener alineado con `apps/api/src/modules/inventory/inventory-traceability.constants.ts`
 * (`linksJson.traceability`).
 */
export const TRACEABILITY_OQC_SERIAL_PANEL = "OQC_SERIAL_PANEL";
export const TRACEABILITY_SUPPLIER_BOM_LINE = "SUPPLIER_BOM_LINE";

/** Filtro solo de vista (no se envía al API; se aplica sobre las filas ya cargadas). */
export type InventoryLineSegmentFilter = "" | "oqc_serial_panel" | "supplier_bom" | "catalog_other" | "uncategorized";

export const INVENTORY_LINE_SEGMENT_OPTIONS: { value: InventoryLineSegmentFilter; label: string }[] = [
  { value: "", label: "Todas las familias" },
  { value: "oqc_serial_panel", label: "Planillas con serial (medidas eléctricas, etc.)" },
  { value: "supplier_bom", label: "Lista de material de proveedor" },
  { value: "catalog_other", label: "Vinculado a catálogo (sin planilla ni lista proveedor)" },
  { value: "uncategorized", label: "Sin clasificar" },
];

export function parseInventoryTraceability(linksJson: string | null | undefined): string | null {
  if (!linksJson?.trim()) return null;
  try {
    const o = JSON.parse(linksJson) as { traceability?: unknown };
    return typeof o.traceability === "string" ? o.traceability : null;
  } catch {
    return null;
  }
}

type SegmentId = Exclude<InventoryLineSegmentFilter, "">;

export function inferInventoryLineSegmentId(row: InventoryListRow): SegmentId {
  const t = parseInventoryTraceability(row.linksJson);
  if (t === TRACEABILITY_OQC_SERIAL_PANEL) return "oqc_serial_panel";
  if (t === TRACEABILITY_SUPPLIER_BOM_LINE) return "supplier_bom";
  if (row.productId) return "catalog_other";
  return "uncategorized";
}

export function rowMatchesInventoryLineSegment(row: InventoryListRow, filter: InventoryLineSegmentFilter): boolean {
  if (!filter) return true;
  return inferInventoryLineSegmentId(row) === filter;
}

export function inventoryLineSegmentShortLabel(row: InventoryListRow): string {
  const id = inferInventoryLineSegmentId(row);
  switch (id) {
    case "oqc_serial_panel":
      return "OQC";
    case "supplier_bom":
      return "BOM";
    case "catalog_other":
      return "Cat.";
    default:
      return "—";
  }
}

export function inventoryLineSegmentTitle(row: InventoryListRow): string {
  const id = inferInventoryLineSegmentId(row);
  const opt = INVENTORY_LINE_SEGMENT_OPTIONS.find((o) => o.value === id);
  return opt?.label ?? id;
}

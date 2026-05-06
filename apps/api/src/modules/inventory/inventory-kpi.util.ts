import type { Prisma } from "@prisma/client";
import { INVENTORY_TRACEABILITY } from "./inventory-traceability.constants";

/** @deprecated use INVENTORY_TRACEABILITY.OQC_SERIAL_PANEL */
export const TRACEABILITY_OQC_SERIAL_PANEL = INVENTORY_TRACEABILITY.OQC_SERIAL_PANEL;

export type InventoryKpiDashboardTotals = {
  lineCount: number;
  quantitySum: number;
  /** Suma cantidad × valor unitario estimado (coste > precio compra > precio lista). */
  estimatedStockValue: number;
  /** Moneda del valor estimado si todas las líneas valoradas comparten la misma; si no, null. */
  valuationCurrency: string | null;
  linesWithoutLinkedProduct: number;
  linesWithNonActiveCatalogProduct: number;
};

export type InventoryKpiByProjectRow = {
  projectId: string;
  projectCode: string;
  projectName: string;
  lineCount: number;
  quantitySum: number;
  estimatedStockValue: number;
};

export type InventoryKpiByFamilyRow = {
  key: string;
  label: string;
  lineCount: number;
  quantitySum: number;
};

export type InventoryKpiTopLine = {
  inventoryItemId: string;
  name: string;
  quantity: number;
  estimatedLineValue: number;
  currency: string | null;
  productName: string | null;
};

export type InventoryKpiNonActiveHoldRow = {
  productId: string;
  productName: string;
  commercialStatus: string;
  lineCount: number;
  quantitySum: number;
};

export type InventoryKpiDashboardDto = {
  generatedAt: string;
  /** Si se filtró por proyecto, el id; si no, null (todos los ítems visibles por la consulta). */
  projectIdFilter: string | null;
  totals: InventoryKpiDashboardTotals;
  byProject: InventoryKpiByProjectRow[];
  byFamily: InventoryKpiByFamilyRow[];
  topLinesByEstimatedValue: InventoryKpiTopLine[];
  nonActiveProductHold: InventoryKpiNonActiveHoldRow[];
};

export function parseTraceability(linksJson: string | null | undefined): string | null {
  if (!linksJson?.trim()) return null;
  try {
    const o = JSON.parse(linksJson) as { traceability?: unknown };
    return typeof o.traceability === "string" ? o.traceability : null;
  } catch {
    return null;
  }
}

function toNum(d: Prisma.Decimal | null | undefined): number {
  if (d == null) return 0;
  return Number(d);
}

/** Valor unitario para stock: coste contable preferido, luego compra, luego precio lista. */
export function unitValueFromLatestPriceRow(row: {
  cost: Prisma.Decimal | null;
  purchasePrice: Prisma.Decimal | null;
  price: Prisma.Decimal;
}): number {
  const c = toNum(row.cost);
  if (c > 0) return c;
  const p = toNum(row.purchasePrice);
  if (p > 0) return p;
  return toNum(row.price);
}

function supplierBomLabelFromLinks(linksJson: string | null): string {
  if (!linksJson?.trim()) return "BOM proveedor";
  try {
    const o = JSON.parse(linksJson) as {
      supplierName?: unknown;
      supplierQuoteRef?: unknown;
    };
    const name = typeof o.supplierName === "string" && o.supplierName.trim() ? o.supplierName.trim() : null;
    const ref = typeof o.supplierQuoteRef === "string" && o.supplierQuoteRef.trim() ? o.supplierQuoteRef.trim() : null;
    if (name && ref) return `BOM · ${name} (${ref})`;
    if (name) return `BOM · ${name}`;
    if (ref) return `BOM (${ref})`;
  } catch {
    /* ignore */
  }
  return "BOM proveedor (tracker / estructura)";
}

export function inferFamilyKeyLabel(args: {
  traceability: string | null;
  linksJson: string | null;
  categorySlug: string | null;
  categoryName: string | null;
}): { key: string; label: string } {
  if (args.traceability === INVENTORY_TRACEABILITY.OQC_SERIAL_PANEL) {
    return { key: "oqc_serial_panel", label: "Paneles (trazabilidad OQC por serial)" };
  }
  if (args.traceability === INVENTORY_TRACEABILITY.SUPPLIER_BOM_LINE) {
    return { key: "supplier_bom", label: supplierBomLabelFromLinks(args.linksJson) };
  }
  if (args.categorySlug) {
    return {
      key: `catalog:${args.categorySlug}`,
      label: args.categoryName?.trim() ? args.categoryName.trim() : `Catálogo · ${args.categorySlug}`,
    };
  }
  return { key: "uncategorized", label: "Sin catálogo / sin familia definida" };
}

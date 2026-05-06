import type { Prisma } from "@prisma/client";
import { INVENTORY_TRACEABILITY } from "./inventory-traceability.constants";
import {
  isEge2026Oqc720ReportRef,
  OQC_PRESET_EGE2026_2356_META,
  type OqcPresetPanelRow,
} from "./oqc-preset-ege2026-2356";

export function buildOqcInventoryUncheckedCreateInput(args: {
  row: OqcPresetPanelRow;
  projectId: string;
  projectCode: string;
  productId: string | null;
  reportRef: string;
  sourceFileHint: string | null;
  preset: string | null;
  /** Quién ejecutó la importación y cuándo (auditoría en nube). */
  importMeta?: { importedByEmail: string | null; importedAtIso: string } | null;
}): Prisma.InventoryItemUncheckedCreateInput {
  const { row, projectId, projectCode, productId, reportRef, sourceFileHint, preset, importMeta } = args;
  const serial = row.serialNumber.trim();

  const measLine = [
    row.ffPercent != null ? `FF ${row.ffPercent}%` : null,
    row.isc != null ? `Isc ${row.isc} A` : null,
    row.voc != null ? `Voc ${row.voc} V` : null,
    row.imp != null ? `Imp ${row.imp} A` : null,
    row.vmp != null ? `Vmp ${row.vmp} V` : null,
    row.pmW != null ? `Pm ${row.pmW} W` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const useEge720Meta = preset === "EGE2026_OQC_2356" || isEge2026Oqc720ReportRef(reportRef);

  const description = [
    useEge720Meta
      ? `Modelo fabricante: ${OQC_PRESET_EGE2026_2356_META.productModel}. ${OQC_PRESET_EGE2026_2356_META.productSpecsShort}`
      : null,
    `Informe OQC: ${reportRef}`,
    row.palletNumber && row.palletNumber !== "—" ? `Pallet: ${row.palletNumber}` : null,
    measLine || null,
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);

  const linksObj: Record<string, unknown> = {
    traceability: INVENTORY_TRACEABILITY.OQC_SERIAL_PANEL,
    presetId: preset,
    reportRef,
    sourceFileHint,
    projectCode,
    itemN: row.itemN,
    serialNumber: serial,
    palletNumber: row.palletNumber !== "—" ? row.palletNumber : null,
    ffPercent: row.ffPercent ?? null,
    isc: row.isc ?? null,
    voc: row.voc ?? null,
    imp: row.imp ?? null,
    vmp: row.vmp ?? null,
    pmW: row.pmW ?? null,
  };
  if (useEge720Meta) {
    linksObj.manufacturer = OQC_PRESET_EGE2026_2356_META.manufacturer;
    linksObj.productModel = OQC_PRESET_EGE2026_2356_META.productModel;
    linksObj.productSpecsShort = OQC_PRESET_EGE2026_2356_META.productSpecsShort;
  }
  if (importMeta?.importedAtIso) {
    linksObj.sourceImportedAt = importMeta.importedAtIso;
    if (importMeta.importedByEmail) linksObj.sourceImportedByEmail = importMeta.importedByEmail;
  }

  const sheetPn = row.sheetProductName?.trim();
  if (sheetPn) {
    linksObj.sheetProductName = sheetPn.slice(0, 240);
  }

  const name = sheetPn
    ? `${sheetPn.slice(0, 280)} · ${serial}`.slice(0, 500)
    : `Panel OQC #${row.itemN} · ${serial} · ${projectCode}`.slice(0, 500);
  const storageLocation =
    row.palletNumber && row.palletNumber !== "—" ? `Pallet ${row.palletNumber}`.slice(0, 500) : null;

  return {
    sku: serial,
    name,
    description: description || null,
    quantity: 1,
    unit: "unidad",
    storageLocation,
    destinationKind: "PROJECT",
    destinationNote: `Trazabilidad OQC — ${reportRef}`.slice(0, 2000),
    projectId,
    quoteId: null,
    productId,
    linksJson: JSON.stringify(linksObj),
  };
}

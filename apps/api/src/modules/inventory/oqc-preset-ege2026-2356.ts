/** Fila normalizada para import OQC (preset o cuerpo `panels`). */
export type OqcPresetPanelRow = {
  itemN: number;
  serialNumber: string;
  palletNumber: string;
  ffPercent?: number;
  isc?: number;
  voc?: number;
  imp?: number;
  vmp?: number;
  pmW?: number;
  /** Texto de columna tipo «Nombre del producto» en la planilla (si existe). */
  sheetProductName?: string | null;
};

/** Detecta referencias de informe OQC Eco Green 720 W / pedido 2356 aunque el import sea por Excel (sin preset). */
export function isEge2026Oqc720ReportRef(reportRef: string): boolean {
  const t = reportRef.trim();
  if (!t) return false;
  if (/720\s*w|720w/i.test(t)) return true;
  if (/20262356/i.test(t)) return true;
  if (/ege2026[\s_-]*oqc/i.test(t)) return true;
  if (/order\s*n[\s_-]*2356/i.test(t)) return true;
  return false;
}

export const OQC_PRESET_EGE2026_2356_META = {
  presetId: "EGE2026_OQC_2356" as const,
  reportRef: "EGE2026-OQC-PV-Order N-2356",
  manufacturer: "Eco Green Energy Ltd.",
  /** Modelo según tabla de unidades producidas del informe OQC (no confundir con variantes 630 W). */
  productModel: "EGE-720W-132N (GM12)",
  /** Resumen compacto tabla producción / empaque (referencia documento). */
  productSpecsShort:
    "Dimensiones 2382×1303×33 mm; 38,7 kg/u; potencia media ref. ~723,55 W; empaque 33 u/caja, 1 caja/pallet; lote ref. 5940 u / 180 pallets.",
  /** Nombre orientativo del archivo en unidad I:; la app no lee rutas locales del cliente. */
  sourceFileHint: "20262356-720W出货检验报告.pdf",
} as const;

export const OQC_PRESET_EGE2026_2356_PANELS: OqcPresetPanelRow[] = [
  { itemN: 1, serialNumber: "ETND1314459920147", palletNumber: "2026123560127001", ffPercent: 80.2, isc: 18.36, voc: 49.13, imp: 17.35, vmp: 41.69, pmW: 723.56 },
  { itemN: 2, serialNumber: "ETND1314459922491", palletNumber: "2026123560127001", ffPercent: 80.21, isc: 18.4, voc: 49.01, imp: 17.4, vmp: 41.58, pmW: 723.38 },
  { itemN: 3, serialNumber: "ETND1314459921604", palletNumber: "2026123560127001", ffPercent: 79.98, isc: 18.44, voc: 49.07, imp: 17.46, vmp: 41.44, pmW: 723.63 },
  { itemN: 4, serialNumber: "ETND1314459922725", palletNumber: "2026123560127001", ffPercent: 80.23, isc: 18.38, voc: 49.05, imp: 17.47, vmp: 41.4, pmW: 723.25 },
  { itemN: 5, serialNumber: "ETND1314459921887", palletNumber: "2026123560127001", ffPercent: 80.14, isc: 18.45, voc: 48.93, imp: 17.41, vmp: 41.54, pmW: 723.25 },
  { itemN: 6, serialNumber: "ETND1314459922628", palletNumber: "2026123560127001", ffPercent: 80.19, isc: 18.44, voc: 48.93, imp: 17.43, vmp: 41.52, pmW: 723.59 },
  { itemN: 7, serialNumber: "ETND1314459920303", palletNumber: "2026123560127001", ffPercent: 80.75, isc: 18.5, voc: 48.45, imp: 17.46, vmp: 41.45, pmW: 723.7 },
  { itemN: 8, serialNumber: "ETND1314459922490", palletNumber: "2026123560127001", ffPercent: 80.4, isc: 18.49, voc: 48.7, imp: 17.48, vmp: 41.43, pmW: 723.95 },
  { itemN: 9, serialNumber: "ETND1314459922800", palletNumber: "2026123560127001", ffPercent: 80.01, isc: 18.5, voc: 48.87, imp: 17.38, vmp: 41.62, pmW: 723.36 },
  { itemN: 10, serialNumber: "ETND1314459922199", palletNumber: "2026123560127001", ffPercent: 80.57, isc: 18.39, voc: 48.8, imp: 17.37, vmp: 41.62, pmW: 723.0 },
  { itemN: 11, serialNumber: "ETND1314459921879", palletNumber: "2026123560127001", ffPercent: 80.33, isc: 18.46, voc: 48.78, imp: 17.41, vmp: 41.55, pmW: 723.48 },
  { itemN: 12, serialNumber: "ETND1314459921516", palletNumber: "2026123560127001", ffPercent: 80.55, isc: 18.41, voc: 48.75, imp: 17.4, vmp: 41.53, pmW: 722.85 },
  { itemN: 13, serialNumber: "ETND1314459922446", palletNumber: "2026123560127001", ffPercent: 80.18, isc: 18.47, voc: 48.8, imp: 17.44, vmp: 41.45, pmW: 722.88 },
  { itemN: 14, serialNumber: "ETND1314459922759", palletNumber: "2026123560127001", ffPercent: 80.09, isc: 18.4, voc: 49.04, imp: 17.45, vmp: 41.43, pmW: 722.82 },
];

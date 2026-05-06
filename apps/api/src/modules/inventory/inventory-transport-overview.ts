import { INVENTORY_TRACEABILITY } from "./inventory-traceability.constants";

/** Campos de transporte guardados en `linksJson` (paneles OQC / trazabilidad operativa). */
export type InventoryTransportSummaryDto = {
  tripNumber: string | null;
  guideNumber: string | null;
  truckPlate: string | null;
  trailerPlate: string | null;
  conductor: string | null;
  driverRut: string | null;
  driverPhone: string | null;
  transportCompany: string | null;
  logisticsTransportStatus: string | null;
  pickupOrigin: string | null;
  deliveryDestination: string | null;
  deliveryObservation: string | null;
};

export type InventoryTransportOverviewGroupDto = {
  groupKey: string;
  project: { id: string; code: string; name: string } | null;
  palletId: string | null;
  lineCount: number;
  quantitySum: number;
  linesWithTripNumber: number;
  sampleSkus: string[];
  traceabilityLabels: string[];
  logisticsSnapshotId: string | null;
  orderRef: string | null;
  groundTransportRow: Record<string, unknown> | null;
  /** Valores ya persistidos en inventario (primera línea del grupo). */
  inventoryTransportSummary: InventoryTransportSummaryDto;
};

export type InventoryTransportOverviewDto = {
  groups: InventoryTransportOverviewGroupDto[];
  totals: {
    inventoryLinesScanned: number;
    linesIncluded: number;
    groupCount: number;
  };
};

export function parseLinksJsonObject(linksJson: string | null): Record<string, unknown> | null {
  if (!linksJson?.trim()) return null;
  try {
    return JSON.parse(linksJson) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function palletIdFromLinks(links: Record<string, unknown> | null): string | null {
  if (!links) return null;
  const p = links.palletNumber ?? links.palletId ?? links.pallet;
  const s = p != null ? String(p).trim() : "";
  return s || null;
}

export function tripNumberFromLinks(links: Record<string, unknown> | null): string | null {
  if (!links) return null;
  const t = links.tripNumber ?? links.transportTripNumber ?? links.viajeNumero;
  const s = t != null ? String(t).trim() : "";
  return s || null;
}

export function transportSummaryFromLinks(links: Record<string, unknown> | null): InventoryTransportSummaryDto {
  if (!links) {
    return {
      tripNumber: null,
      guideNumber: null,
      truckPlate: null,
      trailerPlate: null,
      conductor: null,
      driverRut: null,
      driverPhone: null,
      transportCompany: null,
      logisticsTransportStatus: null,
      pickupOrigin: null,
      deliveryDestination: null,
      deliveryObservation: null,
    };
  }
  const str = (v: unknown): string | null => {
    if (v == null || v === "") return null;
    const s = String(v).trim();
    return s || null;
  };
  return {
    tripNumber: tripNumberFromLinks(links),
    guideNumber: str(links.guideNumber ?? links.guia ?? links.guiaDespacho),
    truckPlate: str(links.truckPlate ?? links.camion ?? links.vehiclePlate),
    trailerPlate: str(links.trailerPlate ?? links.rampla ?? links.patenteRampla),
    conductor: str(links.conductor ?? links.driverName ?? links.chofer),
    driverRut: str(links.driverRut ?? links.rutConductor),
    driverPhone: str(
      links.driverPhone ?? links.conductorPhone ?? links.telefonoConductor ?? links.telefonoChofer ?? links.celularConductor,
    ),
    transportCompany: str(links.transportCompany ?? links.transportista),
    logisticsTransportStatus: str(links.logisticsTransportStatus ?? links.transportStatus),
    pickupOrigin: str(links.pickupOrigin ?? links.origen ?? links.origenCarga),
    deliveryDestination: str(links.deliveryDestination),
    deliveryObservation: str(links.deliveryObservation ?? links.observacionTransporte ?? links.observacionesTransporte),
  };
}

/** Campos canónicos en `linksJson` al guardar desde el módulo Transporte. */
export function transportPatchForLinksJson(patch: {
  tripNumber?: string | null;
  guideNumber?: string | null;
  truckPlate?: string | null;
  trailerPlate?: string | null;
  conductor?: string | null;
  driverRut?: string | null;
  driverPhone?: string | null;
  transportCompany?: string | null;
  logisticsTransportStatus?: string | null;
  pickupOrigin?: string | null;
  deliveryDestination?: string | null;
  deliveryObservation?: string | null;
}): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (patch.tripNumber !== undefined) out.tripNumber = patch.tripNumber?.trim() || null;
  if (patch.guideNumber !== undefined) out.guideNumber = patch.guideNumber?.trim() || null;
  if (patch.truckPlate !== undefined) out.truckPlate = patch.truckPlate?.trim() || null;
  if (patch.trailerPlate !== undefined) out.trailerPlate = patch.trailerPlate?.trim() || null;
  if (patch.conductor !== undefined) out.conductor = patch.conductor?.trim() || null;
  if (patch.driverRut !== undefined) out.driverRut = patch.driverRut?.trim() || null;
  if (patch.driverPhone !== undefined) out.driverPhone = patch.driverPhone?.trim() || null;
  if (patch.transportCompany !== undefined) out.transportCompany = patch.transportCompany?.trim() || null;
  if (patch.logisticsTransportStatus !== undefined)
    out.logisticsTransportStatus = patch.logisticsTransportStatus?.trim() || null;
  if (patch.pickupOrigin !== undefined) out.pickupOrigin = patch.pickupOrigin?.trim() || null;
  if (patch.deliveryDestination !== undefined) out.deliveryDestination = patch.deliveryDestination?.trim() || null;
  if (patch.deliveryObservation !== undefined)
    out.deliveryObservation = patch.deliveryObservation?.trim() || null;
  return out;
}

export function mergeTransportPatchIntoLinksJson(linksJson: string | null, patch: Record<string, string | null>): string {
  let o: Record<string, unknown> = {};
  if (linksJson?.trim()) {
    try {
      o = JSON.parse(linksJson) as Record<string, unknown>;
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

export function findGroundTransportRowIndex(rows: Record<string, unknown>[], palletId: string | null): number {
  const needle = palletId?.trim();
  if (!needle) return -1;
  for (let i = 0; i < rows.length; i++) {
    for (const [k, v] of Object.entries(rows[i])) {
      const lk = k.toLowerCase();
      if (!lk.includes("pallet") || !lk.includes("id")) continue;
      if (String(v ?? "").trim() === needle) return i;
    }
  }
  return -1;
}

function findKeyLike(row: Record<string, unknown>, re: RegExp): string | undefined {
  return Object.keys(row).find((k) => re.test(k.toLowerCase()));
}

function setByMatcher(row: Record<string, unknown>, matcher: RegExp, value: string | null | undefined) {
  const key = findKeyLike(row, matcher);
  if (!key) return;
  if (value === "" || value == null) delete row[key];
  else row[key] = value;
}

/**
 * Inserta o actualiza la fila del pallet en el array «Registro Transporte» (cabeceras flexibles tipo Excel).
 */
export function upsertGroundTransportRowForPallet(
  rows: Record<string, unknown>[],
  palletId: string,
  patch: {
    transportCompany: string | null;
    conductor: string | null;
    driverRut: string | null;
    driverPhone: string | null;
    truckPlate: string | null;
    trailerPlate: string | null;
    tripNumber: string | null;
    guideNumber: string | null;
    logisticsTransportStatus: string | null;
    deliveryDestination: string | null;
    deliveryObservation: string | null;
  },
): Record<string, unknown>[] {
  const pid = palletId.trim();
  const idx = findGroundTransportRowIndex(rows, pid);
  const noteBits = [patch.guideNumber, patch.tripNumber, patch.deliveryDestination, patch.deliveryObservation]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);

  if (idx < 0 && rows.length === 0) {
    const fresh: Record<string, unknown> = {
      "N° Pallet (ID)": pid,
      Transportista: patch.transportCompany ?? "",
      Conductor: patch.conductor ?? "",
      "RUT Conductor": patch.driverRut ?? "",
      Teléfono: patch.driverPhone ?? "",
      "Patente Camión": patch.truckPlate ?? "",
      "Patente Rampla": patch.trailerPlate ?? "",
      Estado: patch.logisticsTransportStatus ?? "",
      "Observ. Transporte": noteBits.join(" · "),
      Guía: patch.guideNumber ?? "",
    };
    return [fresh];
  }

  const template = idx >= 0 ? { ...rows[idx] } : { ...rows[0] };
  if (idx < 0) {
    const pk = findKeyLike(template, /pallet.*\(id\)/) ?? findKeyLike(template, /pallet/) ?? "N° Pallet (ID)";
    template[pk] = pid;
  }

  setByMatcher(template, /transportista/i, patch.transportCompany ?? undefined);
  setByMatcher(template, /^conductor$/i, patch.conductor ?? undefined);
  setByMatcher(template, /rut.*conductor|conductor.*rut/i, patch.driverRut ?? undefined);
  setByMatcher(template, /tel[eé]fono|celular|móvil|movil/i, patch.driverPhone ?? undefined);
  setByMatcher(template, /patente.*camion|camión/i, patch.truckPlate ?? undefined);
  setByMatcher(template, /patente.*rampla|rampla/i, patch.trailerPlate ?? undefined);
  setByMatcher(template, /^estado$/i, patch.logisticsTransportStatus ?? undefined);
  setByMatcher(template, /^guia|guía/i, patch.guideNumber ?? undefined);
  if (noteBits.length) {
    setByMatcher(template, /observ.*transporte/i, noteBits.join(" · "));
    if (!findKeyLike(template, /observ.*transporte/i)) {
      setByMatcher(template, /observaciones/i, noteBits.join(" · "));
    }
  }

  const next = [...rows];
  if (idx >= 0) next[idx] = template;
  else next.push(template);
  return next;
}

export function rowMatchesTransportOverview(
  links: Record<string, unknown> | null,
  trace: string | null,
  logisticsSnapshotId: string | null,
): boolean {
  if (trace === INVENTORY_TRACEABILITY.OQC_SERIAL_PANEL) return true;
  if (trace === INVENTORY_TRACEABILITY.SUPPLIER_BOM_LINE) return true;
  if (logisticsSnapshotId) return true;
  if (links && String(links.type ?? "").trim() === "international_logistics") return true;
  return false;
}

export function traceabilityLabelForRow(
  trace: string | null,
  logisticsSnapshotId: string | null,
  links: Record<string, unknown> | null,
): string {
  if (trace === INVENTORY_TRACEABILITY.OQC_SERIAL_PANEL) return "OQC";
  if (trace === INVENTORY_TRACEABILITY.SUPPLIER_BOM_LINE) return "BOM proveedor";
  if (logisticsSnapshotId || String(links?.type ?? "") === "international_logistics") return "Importación";
  return "Otro";
}

export function parseGroundTransportJson(transportJson: string | null | undefined): Record<string, unknown>[] {
  if (!transportJson?.trim()) return [];
  try {
    const a = JSON.parse(transportJson) as unknown[];
    if (!Array.isArray(a)) return [];
    return a.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === "object");
  } catch {
    return [];
  }
}

/** Busca fila de Registro Transporte cuyo campo de ID pallet coincide (cabeceras flexibles). */
export function findGroundTransportRowForPallet(
  rows: Record<string, unknown>[],
  palletId: string | null,
): Record<string, unknown> | null {
  const needle = palletId?.trim();
  if (!needle) return null;
  for (const r of rows) {
    for (const [k, v] of Object.entries(r)) {
      const lk = k.toLowerCase();
      if (!lk.includes("pallet") || !lk.includes("id")) continue;
      if (String(v ?? "").trim() === needle) return r;
    }
  }
  return null;
}

export function conductorSummaryFromTransportRow(row: Record<string, unknown> | null): string | null {
  if (!row) return null;
  let transportista = "";
  let conductor = "";
  let patente = "";
  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    const val = String(v ?? "").trim();
    if (!val) continue;
    if (lk.includes("transportista")) transportista = val;
    if (lk === "conductor" || (lk.includes("conductor") && !lk.includes("rut"))) conductor = val;
    if (lk.includes("patente") && lk.includes("camion")) patente = val;
  }
  const s = [transportista, conductor, patente].filter(Boolean).join(" · ");
  return s || null;
}

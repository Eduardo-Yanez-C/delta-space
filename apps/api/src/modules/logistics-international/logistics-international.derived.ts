/**
 * Cruza Base Pallets, Base Paneles y Registro Transporte para una vista de trazabilidad
 * alineada a la planilla de control (contenedor → pallet → paneles + viaje terrestre).
 */

export type PalletTraceabilityRow = {
  palletId: string;
  container: string | null;
  estado: string | null;
  panelCount: number;
  /** Hasta 3 seriales de ejemplo (paneles del pallet). */
  sampleSerials: string[];
  transportista: string | null;
  conductor: string | null;
  rutConductor: string | null;
  patenteCamion: string | null;
  patenteRampla: string | null;
  fechaSalidaChina: string | null;
  fechaLlegadaChile: string | null;
  fechaDesconsolidacion: string | null;
  fechaSalidaCoyhaique: string | null;
  fechaLlegadaCoyhaique: string | null;
  fechaDespachoReal: string | null;
  diasMaritimos: string | null;
  diasCoyhaique: string | null;
  diasEnRuta: string | null;
  cantidadPaneles: string | null;
  potenciaTotalW: string | null;
  potenciaPromedioW: string | null;
  /** Valor tal como viene del Excel, si existe la columna. */
  trazabilidadExcel: string | null;
  /** Regla: hitos marítimos + Coyhaique salida/llegada + datos mínimos de transporte terrestre. */
  trazabilidadCompletaCalc: boolean;
  fuentePdf: string | null;
  observaciones: string | null;
};

export type LogisticsDerivedPayload = {
  pallets: PalletTraceabilityRow[];
  stats: {
    palletRows: number;
    panelRows: number;
    transportRows: number;
    panelsLinkedToPallet: number;
    palletsCompleteBySheet: number;
    palletsCompleteByCalc: number;
  };
};

function normKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return String(v).trim();
}

function valueByPatterns(row: Record<string, unknown>, patterns: RegExp[]): string | null {
  for (const key of Object.keys(row)) {
    const n = normKey(key);
    for (const re of patterns) {
      if (re.test(n)) {
        const s = cellStr(row[key]);
        if (s) return s;
      }
    }
  }
  return null;
}

function getPalletIdFromRow(row: Record<string, unknown>): string {
  return (
    valueByPatterns(row, [/pallet\s*\(id\)/, /n[°º]?\s*pallet/, /^id\s*pallet$/, /^pallet\s*id$/]) ?? ""
  );
}

function getPanelSerial(row: Record<string, unknown>): string {
  return (
    valueByPatterns(row, [/numero de serie/, /n[°º]?\s*serie/, /^serial$/]) ??
    valueByPatterns(row, [/serie/]) ??
    ""
  );
}

function mergeDateFields(
  pallet: Record<string, unknown> | null,
  transport: Record<string, unknown> | null,
  patterns: RegExp[],
): string | null {
  const a = pallet ? valueByPatterns(pallet, patterns) : null;
  const b = transport ? valueByPatterns(transport, patterns) : null;
  return a || b || null;
}

function isTruthyTraceabilityExcel(v: string | null): boolean {
  if (!v) return false;
  const t = v.toLowerCase();
  return t === "sí" || t === "si" || t === "yes" || t === "s" || t === "1" || t === "true" || t === "completa";
}

function computeCompletaCalc(
  pallet: Record<string, unknown> | null,
  transport: Record<string, unknown> | null,
): boolean {
  const china = mergeDateFields(pallet, transport, [/fecha\s+salida\s+china/]);
  const chile = mergeDateFields(pallet, transport, [/fecha\s+llegada\s+chile/]);
  const decons = mergeDateFields(pallet, transport, [/fecha\s+desconsolid/]);
  const salCoy = mergeDateFields(pallet, transport, [/fecha\s+salida\s+coyhaique/, /despacho\s+terrestre/]);
  const llegCoy = mergeDateFields(pallet, transport, [/fecha\s+llegada\s+coyhaique/]);
  const transportista = transport ? valueByPatterns(transport, [/transportista/]) : null;
  const conductor = transport ? valueByPatterns(transport, [/conductor$/]) : null;
  const patente = transport ? valueByPatterns(transport, [/patente\s+camion/, /patente camion/]) : null;
  return Boolean(
    china && chile && decons && salCoy && llegCoy && transportista && conductor && patente,
  );
}

export function buildLogisticsTraceabilityDerived(
  panels: unknown[],
  pallets: unknown[],
  groundTransport: unknown[],
): LogisticsDerivedPayload {
  const palletRows = pallets.filter((x) => typeof x === "object" && x !== null) as Record<string, unknown>[];
  const panelRows = panels.filter((x) => typeof x === "object" && x !== null) as Record<string, unknown>[];
  const transportRows = groundTransport.filter((x) => typeof x === "object" && x !== null) as Record<string, unknown>[];

  const palletById = new Map<string, Record<string, unknown>>();
  for (const pr of palletRows) {
    const id = getPalletIdFromRow(pr);
    if (id && !palletById.has(id)) palletById.set(id, pr);
  }

  const transportByPallet = new Map<string, Record<string, unknown>>();
  for (const tr of transportRows) {
    const id = getPalletIdFromRow(tr);
    if (id && !transportByPallet.has(id)) transportByPallet.set(id, tr);
  }

  const panelsByPallet = new Map<string, string[]>();
  let panelsLinkedToPallet = 0;
  for (const p of panelRows) {
    const pid = getPalletIdFromRow(p);
    const serial = getPanelSerial(p);
    if (!pid) continue;
    panelsLinkedToPallet += 1;
    const list = panelsByPallet.get(pid) ?? [];
    if (serial) list.push(serial);
    panelsByPallet.set(pid, list);
  }

  const allIds = new Set<string>([...palletById.keys(), ...transportByPallet.keys(), ...panelsByPallet.keys()]);
  const sortedIds = [...allIds].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  let palletsCompleteBySheet = 0;
  let palletsCompleteByCalc = 0;

  const out: PalletTraceabilityRow[] = sortedIds.map((palletId) => {
    const pr = palletById.get(palletId) ?? null;
    const tr = transportByPallet.get(palletId) ?? null;
    const serials = panelsByPallet.get(palletId) ?? [];

    const trExcel = pr
      ? valueByPatterns(pr, [/trazabilidad\s+completa/, /^trazabilidad$/])
      : valueByPatterns(tr ?? {}, [/trazabilidad\s+completa/]);
    if (isTruthyTraceabilityExcel(trExcel)) palletsCompleteBySheet += 1;

    const calcOk = computeCompletaCalc(pr, tr);
    if (calcOk) palletsCompleteByCalc += 1;

    return {
      palletId,
      container: valueByPatterns(pr ?? {}, [/^contenedor$/]) ?? valueByPatterns(tr ?? {}, [/^contenedor$/]),
      estado: valueByPatterns(pr ?? {}, [/^estado$/]) ?? valueByPatterns(tr ?? {}, [/^estado$/]),
      panelCount: serials.length,
      sampleSerials: serials.slice(0, 3),
      transportista: tr ? valueByPatterns(tr, [/transportista/]) : null,
      conductor: tr ? valueByPatterns(tr, [/conductor$/]) : null,
      rutConductor: tr ? valueByPatterns(tr, [/rut\s+conductor/]) : null,
      patenteCamion: tr ? valueByPatterns(tr, [/patente\s+camion/, /patente camion/]) : null,
      patenteRampla: tr ? valueByPatterns(tr, [/patente\s+rampla/, /rampla/]) : null,
      fechaSalidaChina: mergeDateFields(pr, tr, [/fecha\s+salida\s+china/]),
      fechaLlegadaChile: mergeDateFields(pr, tr, [/fecha\s+llegada\s+chile/]),
      fechaDesconsolidacion: mergeDateFields(pr, tr, [/fecha\s+desconsolid/]),
      fechaSalidaCoyhaique: mergeDateFields(pr, tr, [/fecha\s+salida\s+coyhaique/, /despacho\s+terrestre/]),
      fechaLlegadaCoyhaique: mergeDateFields(pr, tr, [/fecha\s+llegada\s+coyhaique/]),
      fechaDespachoReal: tr ? valueByPatterns(tr, [/fecha\s+despacho\s+real/, /despacho\s+real/]) : null,
      diasMaritimos: valueByPatterns(pr ?? {}, [/dias\s+maritimos/, /días\s+mar[ií]timos/]),
      diasCoyhaique: valueByPatterns(pr ?? {}, [/dias\s+a\s+coyhaique/, /días\s+a\s+coyhaique/, /dias\s+coyhaique/]),
      diasEnRuta: tr ? valueByPatterns(tr, [/dias\s+en\s+ruta/, /días\s+en\s+ruta/]) : null,
      cantidadPaneles:
        valueByPatterns(pr ?? {}, [/cantidad\s+paneles/, /paneles$/]) ??
        (serials.length ? String(serials.length) : null),
      potenciaTotalW: valueByPatterns(pr ?? {}, [/potencia\s+total/]),
      potenciaPromedioW: valueByPatterns(pr ?? {}, [/potencia\s+promedio/, /potencia\s+prom/]),
      trazabilidadExcel: trExcel,
      trazabilidadCompletaCalc: calcOk,
      fuentePdf: valueByPatterns(pr ?? {}, [/fuente\s+pdf/, /^pdf/]) ?? valueByPatterns(tr ?? {}, [/fuente\s+pdf/]),
      observaciones:
        valueByPatterns(pr ?? {}, [/observaciones$/]) ?? valueByPatterns(tr ?? {}, [/observ\.\s*transporte/, /observaciones/]),
    };
  });

  return {
    pallets: out,
    stats: {
      palletRows: palletRows.length,
      panelRows: panelRows.length,
      transportRows: transportRows.length,
      panelsLinkedToPallet,
      palletsCompleteBySheet,
      palletsCompleteByCalc,
    },
  };
}

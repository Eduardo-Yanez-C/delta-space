/**
 * Dimensiones de panel para el mapa: unifica fuentes (selector vs snapshot del diseño)
 * y corrige el caso frecuente de metros guardados en campos pensados para mm (p. ej. 1.7 → 1700).
 * Sin esto, los polígonos quedan ~1000× más pequeños que el techo en coordenadas geográficas.
 */

import type { ImplantationDesign } from "../../../../lib/api";
import type { SelectedPanelSnapshot } from "./PanelCatalogSelect";

export function parseMmRaw(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v > 0 ? v : 0;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

export type PanelNormalizationKind =
  | "none"
  | "meters_as_mm"
  | "centimeters_as_mm";

/**
 * Si ambos lados son pequeños (< 5) pero > 0.15, asumimos que están en metros
 * (p. ej. 1.7 x 1.13 m) y se convierten a mm. Los paneles reales en mm suelen ser ≥ 400 mm por lado.
 *
 * Segunda corrección (factor ×10 en planta, no ×1000):
 * Valores enteros tipo 170 × 113 en columnas "mm" suelen ser en realidad **centímetros**
 * (17,0 × 11,3 dm) mal cargados: el mapa usaría 0,17 m × 0,113 m en lugar de 1,7 m × 1,13 m.
 * Eso deja el bloque ~10× demasiado pequeño respecto al techo (misma fórmula mm→grados; falla la magnitud).
 * Criterios conservadores: rectángulo tipo módulo FV (relación largo/ancho ~1,15–2,8), lado largo 150–249,
 * lado corto 80–194 (excluye pares ya coherentes en mm p. ej. 200×240).
 */
export function normalizeLikelyMetersToMm(
  lengthMm: number,
  widthMm: number,
): {
  lengthMm: number;
  widthMm: number;
  kind: PanelNormalizationKind;
} {
  let l = lengthMm;
  let w = widthMm;
  if (l <= 0 || w <= 0) return { lengthMm: 0, widthMm: 0, kind: "none" };
  if (l < 5 && w < 5 && l > 0.15 && w > 0.15) {
    return { lengthMm: l * 1000, widthMm: w * 1000, kind: "meters_as_mm" };
  }

  const li = Math.round(l);
  const wi = Math.round(w);
  if (li === l && wi === w) {
    const max = Math.max(l, w);
    const min = Math.min(l, w);
    const aspect = max / min;
    if (
      max >= 150 &&
      max <= 249 &&
      min >= 80 &&
      min <= 194 &&
      aspect >= 1.15 &&
      aspect <= 2.8
    ) {
      return { lengthMm: l * 10, widthMm: w * 10, kind: "centimeters_as_mm" };
    }
  }

  return { lengthMm: l, widthMm: w, kind: "none" };
}

export type PanelDimensionsMeta = {
  lengthMm: number;
  widthMm: number;
  rawLengthMm: number;
  rawWidthMm: number;
  kind: PanelNormalizationKind;
};

/**
 * Misma prioridad que el resumen técnico: primero panel seleccionado; si no hay medidas válidas, snapshot del diseño guardado.
 * Incluye valores crudos y tipo de normalización (para diagnóstico de escala en mapa).
 */
export function panelDimensionsMmWithMeta(
  selected: SelectedPanelSnapshot | null,
  design: ImplantationDesign | null | undefined,
): PanelDimensionsMeta {
  const tryPair = (a: unknown, b: unknown): PanelDimensionsMeta | null => {
    const l0 = parseMmRaw(a);
    const w0 = parseMmRaw(b);
    if (l0 <= 0 || w0 <= 0) return null;
    const n = normalizeLikelyMetersToMm(l0, w0);
    return {
      lengthMm: n.lengthMm,
      widthMm: n.widthMm,
      rawLengthMm: l0,
      rawWidthMm: w0,
      kind: n.kind,
    };
  };

  if (selected) {
    const p = tryPair(selected.lengthMm, selected.widthMm);
    if (p && p.lengthMm > 0 && p.widthMm > 0) return p;
  }
  const d = tryPair(design?.panelLengthMmSnapshot, design?.panelWidthMmSnapshot);
  if (d && d.lengthMm > 0 && d.widthMm > 0) return d;
  return { lengthMm: 0, widthMm: 0, rawLengthMm: 0, rawWidthMm: 0, kind: "none" };
}

export function effectivePanelDimensionsMm(
  selected: SelectedPanelSnapshot | null,
  design: ImplantationDesign | null | undefined,
): { lengthMm: number; widthMm: number } {
  const m = panelDimensionsMmWithMeta(selected, design);
  return { lengthMm: m.lengthMm, widthMm: m.widthMm };
}

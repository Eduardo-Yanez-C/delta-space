export type OrgStrokeStyle = {
  stroke: string;
  strokeWidth: number;
  /** Vacío = línea continua (sin stroke-dasharray). */
  dashArray: string;
};

export type OrgBuiltinLineStyles = {
  hierarchy: OrgStrokeStyle;
  advisory: OrgStrokeStyle;
};

/** Clave propia del producto cotizaciones (no colisionar con otras apps en el mismo origen). */
const STORAGE_KEY = "pv_quoting.orgChart.builtinLines.v1";

export const DEFAULT_ORG_BUILTIN_LINE_STYLES: OrgBuiltinLineStyles = {
  hierarchy: { stroke: "#1e293b", strokeWidth: 2.25, dashArray: "" },
  advisory: { stroke: "#4f46e5", strokeWidth: 2, dashArray: "7 6" },
};

export function loadOrgBuiltinLineStyles(): OrgBuiltinLineStyles {
  if (typeof window === "undefined") return DEFAULT_ORG_BUILTIN_LINE_STYLES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ORG_BUILTIN_LINE_STYLES;
    const j = JSON.parse(raw) as Partial<OrgBuiltinLineStyles>;
    return {
      hierarchy: { ...DEFAULT_ORG_BUILTIN_LINE_STYLES.hierarchy, ...j.hierarchy },
      advisory: { ...DEFAULT_ORG_BUILTIN_LINE_STYLES.advisory, ...j.advisory },
    };
  } catch {
    return DEFAULT_ORG_BUILTIN_LINE_STYLES;
  }
}

export function saveOrgBuiltinLineStyles(s: OrgBuiltinLineStyles) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

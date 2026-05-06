/**
 * Etiquetas y copy de escenario FV para UI. La validación de negocio vive en el backend.
 */

export type FvScenarioLabelInput = {
  systemType: "ON_GRID" | "HYBRID" | "OFF_GRID";
  utilityGridAvailable: boolean;
  gridExportEnabled: boolean;
};

/** Valores de systemScenario que devuelve la API (derivado en servidor). */
export type FvSystemScenario =
  | "OFFGRID_ISOLATED"
  | "OFFGRID_WITH_GRID_SUPPORT"
  | "HYBRID_WITH_EXPORT"
  | "HYBRID_NO_EXPORT"
  | "ONGRID_WITH_EXPORT"
  | "ONGRID_NO_EXPORT";

/** Modo del sistema — mismo texto en formulario, detalle e informe. */
export const FV_SCENARIO_USER_LABELS: Record<FvSystemScenario, string> = {
  OFFGRID_ISOLATED: "Off-grid aislado",
  OFFGRID_WITH_GRID_SUPPORT: "Off-grid con red de apoyo",
  HYBRID_WITH_EXPORT: "Híbrido con inyección",
  HYBRID_NO_EXPORT: "Híbrido sin inyección",
  ONGRID_WITH_EXPORT: "On-grid con inyección",
  ONGRID_NO_EXPORT: "On-grid sin inyección",
};

/** Texto explicativo para informe / contexto (una frase por escenario). */
export const FV_SCENARIO_EXECUTIVE_NARRATIVE: Record<FvSystemScenario, string> = {
  OFFGRID_ISOLATED:
    "Sistema aislado de la red eléctrica, sin red de apoyo ni inyección de excedentes; la operación depende de generación local y, en la práctica, de almacenamiento dimensionado acorde.",
  OFFGRID_WITH_GRID_SUPPORT:
    "Sistema off-grid con red eléctrica disponible como apoyo o respaldo; no se contempla inyección de energía a la red.",
  HYBRID_NO_EXPORT:
    "Sistema híbrido con baterías y conexión a red; la red está disponible pero no se considera exportación (sin inyección de excedentes).",
  HYBRID_WITH_EXPORT:
    "Sistema híbrido con baterías y conexión a red; puede inyectar excedentes a la red según normativa, medición y condiciones del punto de conexión.",
  ONGRID_NO_EXPORT:
    "Sistema conectado a red sin exportación considerada en este estudio: el solar cubre en parte el consumo, sin ingreso por venta de excedentes.",
  ONGRID_WITH_EXPORT:
    "Sistema conectado a red con posibilidad de inyectar excedentes según normativa, medición y arancel de inyección considerado en el estudio.",
};

function normalizeSystemType(raw: string | null | undefined): "ON_GRID" | "HYBRID" | "OFF_GRID" {
  if (raw == null || String(raw).trim() === "") return "ON_GRID";
  const u = String(raw)
    .trim()
    .toUpperCase()
    .replace(/-/g, "_");
  if (u === "HYBRID" || u === "HIBRIDO" || u === "HÍBRIDO") return "HYBRID";
  if (u === "OFF_GRID" || u === "OFFGRID" || u === "AISLADO") return "OFF_GRID";
  if (u === "ON_GRID" || u === "ONGRID") return "ON_GRID";
  return "ON_GRID";
}

function scenarioFromFlags(
  st: "ON_GRID" | "HYBRID" | "OFF_GRID",
  utilityGridAvailable: boolean,
  gridExportEnabled: boolean,
): FvSystemScenario | null {
  if (gridExportEnabled && !utilityGridAvailable) return null;
  if (st === "OFF_GRID" && gridExportEnabled) return null;
  if ((st === "ON_GRID" || st === "HYBRID") && !utilityGridAvailable) return null;
  if (st === "OFF_GRID") {
    return utilityGridAvailable ? "OFFGRID_WITH_GRID_SUPPORT" : "OFFGRID_ISOLATED";
  }
  if (st === "HYBRID") {
    return gridExportEnabled ? "HYBRID_WITH_EXPORT" : "HYBRID_NO_EXPORT";
  }
  return gridExportEnabled ? "ONGRID_WITH_EXPORT" : "ONGRID_NO_EXPORT";
}

/**
 * Flags coherentes con el modelo persistido (misma lógica que el formulario al cargar estudio).
 */
export function getStudyGridDisplayFlags(study: {
  systemType?: string | null;
  utilityGridAvailable?: boolean;
  gridExportEnabled?: boolean;
}): { utilityGridAvailable: boolean; gridExportEnabled: boolean } {
  const st = normalizeSystemType(study.systemType);
  if (st === "OFF_GRID") {
    return {
      utilityGridAvailable: study.utilityGridAvailable === true,
      gridExportEnabled: false,
    };
  }
  return {
    utilityGridAvailable: true,
    gridExportEnabled: study.gridExportEnabled !== false,
  };
}

/**
 * Escenario coherente con los flags persistidos y el tipo de sistema (mismos criterios que el backend).
 * Se deriva siempre desde `study` para que modo, red e inyección coincidan en detalle e informe.
 */
export function resolveScenarioFromStudy(study: {
  systemType?: string | null;
  utilityGridAvailable?: boolean;
  gridExportEnabled?: boolean;
}): FvSystemScenario | null {
  const flags = getStudyGridDisplayFlags(study);
  const st = normalizeSystemType(study.systemType);
  return scenarioFromFlags(st, flags.utilityGridAvailable, flags.gridExportEnabled);
}

export function formatSiNo(value: boolean): string {
  return value ? "Sí" : "No";
}

export function getScenarioUserLabel(scenario: FvSystemScenario | null): string {
  if (!scenario) return "—";
  return FV_SCENARIO_USER_LABELS[scenario];
}

export function getExecutiveScenarioNarrative(scenario: FvSystemScenario | null): string | null {
  if (!scenario) return null;
  return FV_SCENARIO_EXECUTIVE_NARRATIVE[scenario];
}

export function getScenarioLabel(input: FvScenarioLabelInput): string {
  const s = scenarioFromFlags(input.systemType, input.utilityGridAvailable, input.gridExportEnabled);
  return getScenarioUserLabel(s);
}

/**
 * Claves gestionadas por el formulario MARGIN (technicalBasicsJson).
 * Cualquier otra clave se preserva vía merge (unknown bucket + JSON avanzado).
 */
export const MARGIN_TECHNICAL_KNOWN_KEYS = [
  "referenciaProyecto",
  "notasInstalacion",
  "systemType",
  "potenciaOrientativaKwp",
  "connectionType",
  "mountStructureType",
] as const;

export type MarginTechnicalKnownKey = (typeof MARGIN_TECHNICAL_KNOWN_KEYS)[number];

const KNOWN_SET = new Set<string>(MARGIN_TECHNICAL_KNOWN_KEYS);

export type MarginSystemType = "ON_GRID" | "HYBRID" | "OFF_GRID";
export type MarginConnectionType = "MONOFASICO" | "TRIFASICO" | "NO_DEFINIDO";
export type MarginMountStructureType = "STANDARD" | "ANGULAR" | "MIXTA";

export type MarginTechnicalFormValues = {
  referenciaProyecto: string;
  notasInstalacion: string;
  /** Vacío = no guardar clave */
  systemType: "" | MarginSystemType;
  /** Texto vacío o número; vacío = no guardar clave */
  potenciaOrientativaKwp: string;
  /** Vacío = no guardar; NO_DEFINIDO guarda explícitamente */
  connectionType: "" | MarginConnectionType;
  /** Vacío = no guardar clave */
  mountStructureType: "" | MarginMountStructureType;
};

export const MARGIN_SYSTEM_TYPE_OPTIONS: { value: MarginSystemType; label: string }[] = [
  { value: "ON_GRID", label: "On grid" },
  { value: "HYBRID", label: "Híbrido" },
  { value: "OFF_GRID", label: "Off grid" },
];

export const MARGIN_CONNECTION_OPTIONS: { value: MarginConnectionType; label: string }[] = [
  { value: "MONOFASICO", label: "Monofásico" },
  { value: "TRIFASICO", label: "Trifásico" },
  { value: "NO_DEFINIDO", label: "No definido (explícito)" },
];

export const MARGIN_MOUNT_STRUCTURE_OPTIONS: { value: MarginMountStructureType; label: string }[] = [
  { value: "STANDARD", label: "Estructura estándar" },
  { value: "ANGULAR", label: "Estructura angular" },
  { value: "MIXTA", label: "Mixta (estándar + angular)" },
];

/** Etiquetas para detalle / accesibilidad */
export const MARGIN_TECHNICAL_LABELS: Record<MarginTechnicalKnownKey, string> = {
  referenciaProyecto: "Referencia de proyecto",
  notasInstalacion: "Notas de instalación / sitio",
  systemType: "Tipo de sistema",
  potenciaOrientativaKwp: "Potencia orientativa (kWp)",
  connectionType: "Tipo de conexión",
  mountStructureType: "Tipo de estructura de montaje",
};

export const MARGIN_SYSTEM_TYPE_LABELS: Record<MarginSystemType, string> = {
  ON_GRID: "On grid",
  HYBRID: "Híbrido",
  OFF_GRID: "Off grid",
};

export const MARGIN_CONNECTION_LABELS: Record<MarginConnectionType, string> = {
  MONOFASICO: "Monofásico",
  TRIFASICO: "Trifásico",
  NO_DEFINIDO: "No definido",
};

export const MARGIN_MOUNT_STRUCTURE_LABELS: Record<MarginMountStructureType, string> = {
  STANDARD: "Estructura estándar",
  ANGULAR: "Estructura angular",
  MIXTA: "Mixta (estándar + angular)",
};

export function emptyMarginTechnicalForm(): MarginTechnicalFormValues {
  return {
    referenciaProyecto: "",
    notasInstalacion: "",
    systemType: "",
    potenciaOrientativaKwp: "",
    connectionType: "",
    mountStructureType: "",
  };
}

function parseSystemType(raw: unknown): "" | MarginSystemType {
  if (raw !== "ON_GRID" && raw !== "HYBRID" && raw !== "OFF_GRID") return "";
  return raw;
}

function parseConnectionType(raw: unknown): "" | MarginConnectionType {
  if (raw !== "MONOFASICO" && raw !== "TRIFASICO" && raw !== "NO_DEFINIDO") return "";
  return raw;
}

function parseMountStructureType(raw: unknown): "" | MarginMountStructureType {
  if (raw !== "STANDARD" && raw !== "ANGULAR" && raw !== "MIXTA") return "";
  return raw;
}

/**
 * Parte `technicalBasicsJson` en claves desconocidas + valores iniciales del formulario.
 */
export function splitMarginTechnicalBasics(
  src: Record<string, unknown> | null | undefined,
): { unknown: Record<string, unknown>; form: MarginTechnicalFormValues } {
  const obj =
    src != null && typeof src === "object" && !Array.isArray(src) ? { ...src } : {};
  const unknown: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!KNOWN_SET.has(k)) unknown[k] = v;
  }
  return {
    unknown,
    form: jsonRecordToFormValues(obj),
  };
}

function jsonRecordToFormValues(obj: Record<string, unknown>): MarginTechnicalFormValues {
  const ref = obj.referenciaProyecto;
  const notas = obj.notasInstalacion;
  let potenciaStr = "";
  const p = obj.potenciaOrientativaKwp;
  if (typeof p === "number" && Number.isFinite(p)) potenciaStr = String(p);
  else if (typeof p === "string" && p.trim() !== "") potenciaStr = p.trim();

  return {
    referenciaProyecto: typeof ref === "string" ? ref : "",
    notasInstalacion: typeof notas === "string" ? notas : "",
    systemType: parseSystemType(obj.systemType),
    potenciaOrientativaKwp: potenciaStr,
    connectionType: parseConnectionType(obj.connectionType),
    mountStructureType: parseMountStructureType(obj.mountStructureType),
  };
}

/**
 * Quita claves conocidas de un objeto (p. ej. tras parsear JSON avanzado).
 */
export function stripKnownMarginKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...obj };
  for (const k of MARGIN_TECHNICAL_KNOWN_KEYS) delete out[k];
  return out;
}

/**
 * Merge: desconocidas + campos del formulario.
 * Campos vacíos del formulario no añaden clave (equivalente a borrar respecto al resultado).
 */
export function mergeMarginTechnicalBasics(
  unknown: Record<string, unknown>,
  form: MarginTechnicalFormValues,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...unknown };
  for (const k of MARGIN_TECHNICAL_KNOWN_KEYS) delete out[k];

  const ref = form.referenciaProyecto.trim();
  if (ref) out.referenciaProyecto = ref;

  const notas = form.notasInstalacion.trim();
  if (notas) out.notasInstalacion = notas;

  if (form.systemType) out.systemType = form.systemType;

  const kwp = form.potenciaOrientativaKwp.trim().replace(",", ".");
  if (kwp !== "") {
    const n = Number(kwp);
    if (Number.isFinite(n)) out.potenciaOrientativaKwp = n;
  }

  if (form.connectionType) out.connectionType = form.connectionType;

  if (form.mountStructureType) out.mountStructureType = form.mountStructureType;

  return out;
}

export function parseMarginAdvancedJson(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; message: string } {
  const t = text.trim();
  if (t === "") return { ok: true, value: {} };
  try {
    const parsed: unknown = JSON.parse(t);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {
        ok: false,
        message: "Los datos adicionales deben tener forma de objeto (no una lista ni un valor suelto).",
      };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, message: "El texto no tiene un formato válido." };
  }
}

/** Formatea un valor suelto para la vista detalle */
export function formatTechnicalBasicsValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.trim() === "" ? "—" : value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

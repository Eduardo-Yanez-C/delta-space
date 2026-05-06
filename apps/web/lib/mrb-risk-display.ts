import {
  buildMrbMatrixV1,
  parseMrbMatrixJson,
  MRB_PROBABILITY_LEVELS,
  type MrbMatrixV1,
} from "./mrb-matrix";

export type RiskLike = {
  description: string;
  severity: string;
  probability: string;
  mitigation?: string | null;
  mrbMatrix?: Record<string, unknown> | null;
};

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function probabilityFieldToLabel(probability: string): string {
  const n = Number(String(probability).trim());
  if (Number.isFinite(n) && n >= 1 && n <= 5) {
    const hit = MRB_PROBABILITY_LEVELS.find((x) => x.value === n);
    if (hit) return hit.label;
  }
  return "Moderado";
}

function severityFieldToImpactLabel(severity: string): string {
  const u = stripDiacritics(severity).trim().toUpperCase().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    EXTREMO: "Catastrófico",
    ALTO: "Mayores",
    MODERADO: "Moderados",
    MODERADA: "Moderados",
    BAJO: "Menores",
    HIGH: "Mayores",
    MEDIUM: "Moderados",
    LOW: "Menores",
    CRITICAL: "Catastrófico",
    CRITICA: "Catastrófico",
    CRITICO: "Catastrófico",
    ALTA: "Mayores",
    MEDIA: "Moderados",
    BAJA: "Menores",
  };
  return map[u] ?? "Moderados";
}

/** Fila persistida con matriz MRB v1, o riesgo legacy sin JSON (se estima P/I para la vista). */
export function riskToMrbMatrixV1(row: RiskLike): { matrix: MrbMatrixV1; source: "mrb" | "legacy" } {
  const raw = row.mrbMatrix;
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).version === 1) {
    const parsed = parseMrbMatrixJson(raw);
    if (parsed) return { matrix: parsed, source: "mrb" };
  }
  const matrix = buildMrbMatrixV1({
    version: 1,
    event: row.description,
    cause: "",
    consequence: "",
    probabilityLabel: probabilityFieldToLabel(row.probability),
    impactLabel: severityFieldToImpactLabel(row.severity),
    keyControl: row.mitigation ?? "",
    treatmentActions: row.mitigation ?? "",
  });
  return { matrix, source: "legacy" };
}


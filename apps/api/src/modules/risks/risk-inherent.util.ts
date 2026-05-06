import { buildMrbMatrixV1, MRB_PROBABILITY_LEVELS, parseMrbMatrixJson } from "../../common/mrb-matrix";

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

/** Alineado a la vista web `riskToMrbMatrixV1` para KPIs ejecutivos. */
export function riskInherentFromRow(row: {
  description: string;
  severity: string;
  probability: string;
  mrbMatrix: unknown;
}): { severity: string; value: number } {
  const raw =
    typeof row.mrbMatrix === "string"
      ? (() => {
          try {
            return JSON.parse(row.mrbMatrix) as unknown;
          } catch {
            return null;
          }
        })()
      : row.mrbMatrix;
  if (raw && typeof raw === "object" && (raw as Record<string, unknown>).version === 1) {
    const parsed = parseMrbMatrixJson(raw);
    if (parsed) return { severity: parsed.inherentSeverity, value: parsed.inherentValue };
  }
  const matrix = buildMrbMatrixV1({
    event: row.description,
    cause: "",
    consequence: "",
    probabilityLabel: probabilityFieldToLabel(row.probability),
    impactLabel: severityFieldToImpactLabel(row.severity),
    keyControl: "",
  });
  return { severity: matrix.inherentSeverity, value: matrix.inherentValue };
}

export function isHighInherentSeverity(severity: string): boolean {
  const u = severity.toUpperCase();
  return u.includes("EXTREMO") || u.includes("ALTO");
}

export function isRiskOpen(status: string): boolean {
  const u = status.toUpperCase();
  return u !== "CLOSED" && u !== "MITIGATED";
}


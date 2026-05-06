/**
 * Versión local del paquete `mrb-matrix` (proyecto base).
 * Se mantiene aquí para evitar dependencia workspace.
 */

export const MRB_PROBABILITY_LEVELS = [
  { label: "Casi certeza", value: 5 },
  { label: "Posible", value: 4 },
  { label: "Moderado", value: 3 },
  { label: "Improbable", value: 2 },
  { label: "Muy Improbable", value: 1 },
] as const;

export const MRB_IMPACT_LEVELS = [
  { label: "Catastrófico", value: 5 },
  { label: "Mayores", value: 4 },
  { label: "Moderados", value: 3 },
  { label: "Menores", value: 2 },
  { label: "Insignificantes", value: 1 },
] as const;

const INHERENT_GRID: { severity: string; value: number }[][] = [
  [
    { severity: "EXTREMO", value: 25 },
    { severity: "EXTREMO", value: 20 },
    { severity: "EXTREMO", value: 15 },
    { severity: "ALTO", value: 10 },
    { severity: "ALTO", value: 5 },
  ],
  [
    { severity: "EXTREMO", value: 20 },
    { severity: "EXTREMO", value: 16 },
    { severity: "ALTO", value: 12 },
    { severity: "ALTO", value: 8 },
    { severity: "MODERADO", value: 4 },
  ],
  [
    { severity: "EXTREMO", value: 15 },
    { severity: "EXTREMO", value: 12 },
    { severity: "ALTO", value: 9 },
    { severity: "MODERADO", value: 6 },
    { severity: "BAJO", value: 3 },
  ],
  [
    { severity: "EXTREMO", value: 10 },
    { severity: "ALTO", value: 8 },
    { severity: "MODERADO", value: 6 },
    { severity: "BAJO", value: 4 },
    { severity: "BAJO", value: 2 },
  ],
  [
    { severity: "ALTO", value: 5 },
    { severity: "ALTO", value: 4 },
    { severity: "MODERADO", value: 3 },
    { severity: "BAJO", value: 2 },
    { severity: "BAJO", value: 1 },
  ],
];

export type MrbMatrixV1 = {
  version: 1;
  event: string;
  cause: string;
  consequence: string;
  criticalRiskText?: string;
  probabilityLabel: string;
  impactLabel: string;
  probabilityValue: number;
  impactValue: number;
  inherentSeverity: string;
  inherentValue: number;
  keyControl: string;
  controlPeriodicity: string;
  controlOpportunity: string;
  controlAutomation: string;
  effectivenessClass: string;
  effectivenessValue: number;
  residualClass: string;
  residualQuotient: number;
  genericStrategy: string;
  validationDate: string | null;
  validator: string;
  treatmentRisk: string;
  treatmentStrategy: string;
  treatmentObjective: string;
  treatmentActions: string;
  treatmentResponsible: string;
  treatmentDeadline: string | null;
  treatmentProgressPct: number | null;
  treatmentEvidence: string;
};

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function lookupProbabilityValue(label: string): number | null {
  const f = MRB_PROBABILITY_LEVELS.find((x) => norm(x.label) === norm(label));
  return f ? f.value : null;
}

export function lookupImpactValue(label: string): number | null {
  const f = MRB_IMPACT_LEVELS.find((x) => norm(x.label) === norm(label));
  return f ? f.value : null;
}

export function inherentFromValues(pv: number, iv: number): { severity: string; value: number } {
  if (pv < 1 || pv > 5 || iv < 1 || iv > 5) return { severity: "—", value: 0 };
  const row = INHERENT_GRID[pv - 1]?.[iv - 1];
  return row ?? { severity: "—", value: pv * iv };
}

const EFFECTIVENESS_MAP = new Map<string, { classification: string; value: number }>([
  ["permanente|preventivo|manual", { classification: "Óptimo", value: 5 }],
  ["permanente|preventivo|semi automáticos", { classification: "Óptimo", value: 5 }],
  ["permanente|preventivo|automáticos", { classification: "Óptimo", value: 5 }],
  ["permanente|correctivo|manual", { classification: "Óptimo", value: 5 }],
  ["permanente|correctivo|semi automáticos", { classification: "Óptimo", value: 5 }],
  ["permanente|correctivo|automáticos", { classification: "Óptimo", value: 5 }],
]);

export function effectivenessFromDesign(
  periodicity: string,
  opportunity: string,
  automation: string,
): { classification: string; value: number } {
  const key = `${norm(periodicity)}|${norm(opportunity)}|${norm(automation)}`;
  return EFFECTIVENESS_MAP.get(key) ?? { classification: "Óptimo", value: 5 };
}

export function residualClassFromQuotient(q: number): string {
  if (q < 2.9999) return "Menor";
  if (q < 3.9999) return "Media";
  if (q < 7.9999) return "Mayor";
  return "No Aceptable";
}

export function composeCriticalRiskText(event: string, cause: string, consequence: string): string {
  const e = event.trim();
  const c = cause.trim();
  const z = consequence.trim();
  if (!e && !c && !z) return "";
  return `${e}${c ? `, debido a ${c}` : ""}${z ? ` genera ${z}` : ""}`.trim();
}

export function buildMrbMatrixV1(
  partial: Partial<MrbMatrixV1> & Pick<MrbMatrixV1, "event" | "cause" | "consequence">,
): MrbMatrixV1 {
  const event = partial.event ?? "";
  const cause = partial.cause ?? "";
  const consequence = partial.consequence ?? "";
  const criticalRiskText = partial.criticalRiskText?.trim() || composeCriticalRiskText(event, cause, consequence);
  const probabilityLabel = partial.probabilityLabel ?? "Moderado";
  const impactLabel = partial.impactLabel ?? "Moderados";
  const pv = lookupProbabilityValue(probabilityLabel) ?? 3;
  const iv = lookupImpactValue(impactLabel) ?? 3;
  const inh = inherentFromValues(pv, iv);
  const periodicity = partial.controlPeriodicity ?? "Permanente";
  const opportunity = partial.controlOpportunity ?? "Preventivo";
  const automation = partial.controlAutomation ?? "Manual";
  const eff = effectivenessFromDesign(periodicity, opportunity, automation);
  const quotient = eff.value > 0 ? inh.value / eff.value : 0;
  const residualClass = residualClassFromQuotient(quotient);
  return {
    version: 1,
    event,
    cause,
    consequence,
    criticalRiskText,
    probabilityLabel: MRB_PROBABILITY_LEVELS.find((x) => x.value === pv)?.label ?? String(probabilityLabel),
    impactLabel: MRB_IMPACT_LEVELS.find((x) => x.value === iv)?.label ?? String(impactLabel),
    probabilityValue: pv,
    impactValue: iv,
    inherentSeverity: inh.severity,
    inherentValue: inh.value,
    keyControl: partial.keyControl ?? "",
    controlPeriodicity: periodicity,
    controlOpportunity: opportunity,
    controlAutomation: automation,
    effectivenessClass: eff.classification,
    effectivenessValue: eff.value,
    residualClass,
    residualQuotient: Number(quotient.toFixed(4)),
    genericStrategy: partial.genericStrategy ?? "",
    validationDate: partial.validationDate ?? null,
    validator: partial.validator ?? "",
    treatmentRisk: partial.treatmentRisk ?? criticalRiskText,
    treatmentStrategy: partial.treatmentStrategy ?? partial.genericStrategy ?? "",
    treatmentObjective: partial.treatmentObjective ?? "",
    treatmentActions: partial.treatmentActions ?? "",
    treatmentResponsible: partial.treatmentResponsible ?? "",
    treatmentDeadline: partial.treatmentDeadline ?? null,
    treatmentProgressPct: partial.treatmentProgressPct ?? null,
    treatmentEvidence: partial.treatmentEvidence ?? "",
  };
}

export function mrbMatrixToLegacyFields(m: MrbMatrixV1): { description: string; severity: string; probability: string } {
  return {
    description: m.criticalRiskText || composeCriticalRiskText(m.event, m.cause, m.consequence) || "Riesgo MRB",
    severity: m.inherentSeverity,
    probability: String(m.probabilityValue),
  };
}

export function parseMrbMatrixJson(raw: unknown): MrbMatrixV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  try {
    return buildMrbMatrixV1({
      version: 1,
      event: String(o.event ?? ""),
      cause: String(o.cause ?? ""),
      consequence: String(o.consequence ?? ""),
      criticalRiskText: o.criticalRiskText != null ? String(o.criticalRiskText) : undefined,
      probabilityLabel: String(o.probabilityLabel ?? "Moderado"),
      impactLabel: String(o.impactLabel ?? "Moderados"),
      keyControl: String(o.keyControl ?? ""),
      controlPeriodicity: String(o.controlPeriodicity ?? "Permanente"),
      controlOpportunity: String(o.controlOpportunity ?? "Preventivo"),
      controlAutomation: String(o.controlAutomation ?? "Manual"),
      genericStrategy: String(o.genericStrategy ?? ""),
      validationDate: o.validationDate != null ? String(o.validationDate) : null,
      validator: String(o.validator ?? ""),
      treatmentRisk: o.treatmentRisk != null ? String(o.treatmentRisk) : undefined,
      treatmentStrategy: o.treatmentStrategy != null ? String(o.treatmentStrategy) : undefined,
      treatmentObjective: String(o.treatmentObjective ?? ""),
      treatmentActions: String(o.treatmentActions ?? ""),
      treatmentResponsible: String(o.treatmentResponsible ?? ""),
      treatmentDeadline: o.treatmentDeadline != null ? String(o.treatmentDeadline) : null,
      treatmentProgressPct: typeof o.treatmentProgressPct === "number" ? o.treatmentProgressPct : null,
      treatmentEvidence: String(o.treatmentEvidence ?? ""),
    });
  } catch {
    return null;
  }
}


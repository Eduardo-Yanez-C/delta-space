export const RISK_CATEGORY_CODES = [
  "OPERATIONAL",
  "STRATEGIC",
  "FINANCIAL",
  "COMPLIANCE_LEGAL",
  "REPUTATIONAL",
] as const;

export type RiskCategoryCode = (typeof RISK_CATEGORY_CODES)[number];

export function normalizeRiskCategory(input?: string | null): RiskCategoryCode {
  const u = input?.trim().toUpperCase();
  if (u && (RISK_CATEGORY_CODES as readonly string[]).includes(u)) return u as RiskCategoryCode;
  return "OPERATIONAL";
}

export const MATRIX_KIND_CODES = ["MRB", "HSEC"] as const;

export type MatrixKindCode = (typeof MATRIX_KIND_CODES)[number];

export function normalizeMatrixKind(input?: string | null): MatrixKindCode {
  const u = input?.trim().toUpperCase();
  if (u === "HSEC") return "HSEC";
  return "MRB";
}


/** Slug URL → código API (Prisma `Risk.riskCategory`). */
export const RISK_CATEGORY_ENTRIES = [
  { slug: "operacional", code: "OPERATIONAL" as const },
  { slug: "estrategico", code: "STRATEGIC" as const },
  { slug: "financiero", code: "FINANCIAL" as const },
  { slug: "cumplimiento-legal", code: "COMPLIANCE_LEGAL" as const },
  { slug: "reputacional", code: "REPUTATIONAL" as const },
] as const;

export type RiskCategorySlug = (typeof RISK_CATEGORY_ENTRIES)[number]["slug"];
export type RiskCategoryCode = (typeof RISK_CATEGORY_ENTRIES)[number]["code"];

export function slugToRiskCategoryCode(slug: string): RiskCategoryCode | null {
  const hit = RISK_CATEGORY_ENTRIES.find((e) => e.slug === slug);
  return hit?.code ?? null;
}

export function riskCategoryCodeToSlug(code: string): RiskCategorySlug | null {
  const hit = RISK_CATEGORY_ENTRIES.find((e) => e.code === code);
  return hit?.slug ?? null;
}


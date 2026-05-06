import { hasGlobalAdminPrivileges } from "../auth/role-constants";

const SENSITIVE_KEYS = [
  "purchasePrice",
  "cost",
  "suggestedMarginPercent",
  "supplierDiscountPercent",
  "logisticCostEstimate",
  "customsCostEstimate",
  "totalLandedCost",
  "internalCommercialNotes",
  "updatedBy",
  "updatedById",
] as const;

export function stripSensitiveFromPrice<T extends Record<string, unknown>>(price: T) {
  const out = { ...price };
  for (const key of SENSITIVE_KEYS) {
    if (key in out) {
      delete out[key];
    }
  }
  return out;
}

export function stripSensitiveFromPrices<T extends Record<string, unknown>>(prices: T[]) {
  return prices.map((p) => stripSensitiveFromPrice(p));
}

export function isAdmin(roles: string[] | undefined) {
  return hasGlobalAdminPrivileges(roles ?? []);
}

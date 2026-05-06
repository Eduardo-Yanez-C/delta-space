declare const SENSITIVE_KEYS: readonly ["purchasePrice", "cost", "suggestedMarginPercent", "supplierDiscountPercent", "logisticCostEstimate", "customsCostEstimate", "totalLandedCost", "internalCommercialNotes", "updatedBy", "updatedById"];
export declare function stripSensitiveFromPrice<T extends Record<string, unknown>>(price: T): Omit<T, (typeof SENSITIVE_KEYS)[number]>;
export declare function stripSensitiveFromPrices<T extends Record<string, unknown>>(prices: T[]): Omit<T, (typeof SENSITIVE_KEYS)[number]>[];
export declare function isAdmin(roles: string[] | undefined): boolean;
export {};

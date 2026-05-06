"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripSensitiveFromPrice = stripSensitiveFromPrice;
exports.stripSensitiveFromPrices = stripSensitiveFromPrices;
exports.isAdmin = isAdmin;
const role_constants_1 = require("../auth/role-constants");
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
];
function stripSensitiveFromPrice(price) {
    const out = { ...price };
    for (const key of SENSITIVE_KEYS) {
        if (key in out) {
            delete out[key];
        }
    }
    return out;
}
function stripSensitiveFromPrices(prices) {
    return prices.map((p) => stripSensitiveFromPrice(p));
}
function isAdmin(roles) {
    return (0, role_constants_1.hasGlobalAdminPrivileges)(roles ?? []);
}

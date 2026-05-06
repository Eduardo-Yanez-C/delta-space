"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineCostTotalMoney = lineCostTotalMoney;
exports.lineUtilityAndMarginPercent = lineUtilityAndMarginPercent;
exports.mainItemEffectiveSaleTotal = mainItemEffectiveSaleTotal;
exports.mainItemMarginBlockEconomics = mainItemMarginBlockEconomics;
exports.versionCostTotalFromRows = versionCostTotalFromRows;
function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d) {
        return d.toNumber();
    }
    return Number(d);
}
function lineCostTotalMoney(quantity, unitCost) {
    const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
    const c = unitCost != null && Number.isFinite(unitCost) && unitCost >= 0
        ? unitCost
        : 0;
    return Math.round(q * c * 100) / 100;
}
function lineUtilityAndMarginPercent(lineTotalSale, quantity, unitCost) {
    const sale = Number.isFinite(lineTotalSale) ? lineTotalSale : 0;
    const lineCostTotal = lineCostTotalMoney(quantity, unitCost);
    const lineUtility = Math.round((sale - lineCostTotal) * 100) / 100;
    const lineMarginPercent = sale > 0 ? Math.round((lineUtility / sale) * 10000) / 100 : null;
    return { lineCostTotal, lineUtility, lineMarginPercent };
}
function mainItemEffectiveSaleTotal(totalMode, totalOverride, lines) {
    if (totalMode === "SUM_LINES") {
        const sum = lines.reduce((s, l) => s + toNum(l.lineTotalSnapshot), 0);
        return Math.round(sum * 100) / 100;
    }
    return Math.round(toNum(totalOverride) * 100) / 100;
}
function mainItemMarginBlockEconomics(totalMode, totalOverride, lines) {
    const blockCostTotal = Math.round(lines.reduce((sum, l) => {
        const q = toNum(l.quantity);
        const uc = l.unitCostSnapshot != null ? toNum(l.unitCostSnapshot) : null;
        return sum + lineCostTotalMoney(q, uc);
    }, 0) * 100) / 100;
    const blockSaleTotal = mainItemEffectiveSaleTotal(totalMode, totalOverride, lines);
    const blockUtility = Math.round((blockSaleTotal - blockCostTotal) * 100) / 100;
    const blockMarginPercent = blockSaleTotal > 0 ? Math.round((blockUtility / blockSaleTotal) * 10000) / 100 : null;
    return { blockCostTotal, blockSaleTotal, blockUtility, blockMarginPercent };
}
function versionCostTotalFromRows(items, mainItems) {
    let sum = 0;
    for (const i of items) {
        const q = toNum(i.quantity);
        const uc = i.unitCostSnapshot != null ? toNum(i.unitCostSnapshot) : null;
        sum += lineCostTotalMoney(q, uc);
    }
    for (const m of mainItems) {
        for (const l of m.lines ?? []) {
            const q = toNum(l.quantity);
            const uc = l.unitCostSnapshot != null ? toNum(l.unitCostSnapshot) : null;
            sum += lineCostTotalMoney(q, uc);
        }
    }
    return Math.round(sum * 100) / 100;
}

export declare function lineCostTotalMoney(quantity: number, unitCost: number | null | undefined): number;
export type LineMarginEconomics = {
    lineCostTotal: number;
    lineUtility: number;
    lineMarginPercent: number | null;
};
export declare function lineUtilityAndMarginPercent(lineTotalSale: number, quantity: number, unitCost: number | null | undefined): LineMarginEconomics;
export declare function mainItemEffectiveSaleTotal(totalMode: string, totalOverride: unknown, lines: Array<{
    lineTotalSnapshot: unknown;
}>): number;
export declare function mainItemMarginBlockEconomics(totalMode: string, totalOverride: unknown, lines: Array<{
    quantity: unknown;
    unitCostSnapshot: unknown;
    lineTotalSnapshot: unknown;
}>): {
    blockCostTotal: number;
    blockSaleTotal: number;
    blockUtility: number;
    blockMarginPercent: number | null;
};
export declare function versionCostTotalFromRows(items: Array<{
    quantity: unknown;
    unitCostSnapshot: unknown;
}>, mainItems: Array<{
    lines: Array<{
        quantity: unknown;
        unitCostSnapshot: unknown;
    }>;
}>): number;

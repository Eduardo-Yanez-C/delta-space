function toNum(d: unknown) {
  if (d == null) return 0;
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d) {
    return (d as { toNumber: () => number }).toNumber();
  }
  return Number(d);
}

export function lineCostTotalMoney(quantity: unknown, unitCost: unknown) {
  const q = Number.isFinite(quantity as number) && (quantity as number) > 0 ? (quantity as number) : 0;
  const c =
    unitCost != null && Number.isFinite(unitCost as number) && (unitCost as number) >= 0
      ? (unitCost as number)
      : 0;
  return Math.round(q * c * 100) / 100;
}

export function lineUtilityAndMarginPercent(
  lineTotalSale: number,
  quantity: unknown,
  unitCost: unknown,
) {
  const sale = Number.isFinite(lineTotalSale) ? lineTotalSale : 0;
  const lineCostTotal = lineCostTotalMoney(quantity, unitCost);
  const lineUtility = Math.round((sale - lineCostTotal) * 100) / 100;
  const lineMarginPercent = sale > 0 ? Math.round((lineUtility / sale) * 10000) / 100 : null;
  return { lineCostTotal, lineUtility, lineMarginPercent };
}

export function mainItemEffectiveSaleTotal(
  totalMode: string,
  totalOverride: unknown,
  lines: { lineTotalSnapshot: unknown }[],
) {
  if (totalMode === "SUM_LINES") {
    const sum = lines.reduce((s, l) => s + toNum(l.lineTotalSnapshot), 0);
    return Math.round(sum * 100) / 100;
  }
  return Math.round(toNum(totalOverride) * 100) / 100;
}

export function mainItemMarginBlockEconomics(
  totalMode: string,
  totalOverride: unknown,
  lines: { quantity: unknown; unitCostSnapshot: unknown; lineTotalSnapshot: unknown }[],
) {
  const blockCostTotal = Math.round(
    lines.reduce((sum, l) => {
      const q = toNum(l.quantity);
      const uc = l.unitCostSnapshot != null ? toNum(l.unitCostSnapshot) : null;
      return sum + lineCostTotalMoney(q, uc);
    }, 0) * 100,
  ) / 100;
  const blockSaleTotal = mainItemEffectiveSaleTotal(totalMode, totalOverride, lines);
  const blockUtility = Math.round((blockSaleTotal - blockCostTotal) * 100) / 100;
  const blockMarginPercent =
    blockSaleTotal > 0 ? Math.round((blockUtility / blockSaleTotal) * 10000) / 100 : null;
  return { blockCostTotal, blockSaleTotal, blockUtility, blockMarginPercent };
}

export function versionCostTotalFromRows(
  items: { quantity: unknown; unitCostSnapshot: unknown }[],
  mainItems: { lines?: { quantity: unknown; unitCostSnapshot: unknown }[] }[],
) {
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

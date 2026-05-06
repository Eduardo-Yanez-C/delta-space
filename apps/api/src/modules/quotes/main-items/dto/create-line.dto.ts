export class CreateLineDto {
  source!: "MANUAL" | "FROM_CATALOG";
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  quantity!: number;
  unitPriceSnapshot?: number;
  discountPercentSnapshot?: number;
  currencySnapshot?: string;
  unitCostSnapshot?: number | null;
  productId?: string;
  priceId?: string;
  unitPriceOverride?: number;
}

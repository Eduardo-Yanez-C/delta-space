export class CreateQuoteItemDto {
  productId?: string;
  priceId?: string;
  unitPriceOverride?: number;
  discountPercent?: number;
  quantity!: number;
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  categoryNameSnapshot?: string;
  brandNameSnapshot?: string;
  modelNameSnapshot?: string;
  currencySnapshot?: string;
  unitPriceSnapshot?: number;
}

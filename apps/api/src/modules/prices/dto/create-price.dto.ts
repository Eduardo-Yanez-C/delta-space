/** Paridad con dist: sin class-validator. */
export class CreatePriceDto {
  productId?: string;
  supplierId?: string | null;
  price?: number | string;
  cost?: number | string | null;
  purchasePrice?: number | string | null;
  currency?: string;
  priceListType?: string;
  validFrom!: string;
  validTo?: string | null;
  lastQuoteReceivedAt?: string | null;
  lastUpdatedAt?: string | null;
  suggestedMarginPercent?: number | string | null;
  supplierDiscountPercent?: number | string | null;
  logisticCostEstimate?: number | string | null;
  customsCostEstimate?: number | string | null;
  totalLandedCost?: number | string | null;
  moq?: string | null;
  warranty?: string | null;
  quoteReference?: string | null;
  quoteReceivedAt?: string | null;
  validityIndicator?: string | null;
  internalCommercialNotes?: string | null;
  updatedById?: string | null;
}

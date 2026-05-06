export declare class CreatePriceDto {
    productId: string;
    supplierId?: string;
    price: number;
    cost?: number;
    purchasePrice?: number;
    currency?: string;
    priceListType?: string;
    validFrom: string;
    validTo?: string;
    lastQuoteReceivedAt?: string;
    lastUpdatedAt?: string;
    suggestedMarginPercent?: number;
    supplierDiscountPercent?: number;
    logisticCostEstimate?: number;
    customsCostEstimate?: number;
    totalLandedCost?: number;
    moq?: string;
    warranty?: string;
    quoteReference?: string;
    quoteReceivedAt?: string;
    validityIndicator?: string;
    internalCommercialNotes?: string;
    updatedById?: string;
}

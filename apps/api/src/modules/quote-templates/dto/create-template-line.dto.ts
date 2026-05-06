export class CreateTemplateLineDto {
  source!: "MANUAL" | "FROM_CATALOG";
  productId?: string;
  productNameSnapshot?: string;
  productDescriptionSnapshot?: string;
  quantityRule!: "FIXED" | "DERIVED_FROM_POWER";
  quantityFixed?: number;
  potenciaPorPanelWp?: number;
  unitPriceDefault?: number;
  currency?: string;
  visibleInFinalQuoteDefault?: boolean;
}

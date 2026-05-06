export class CreateQuoteTemplateDto {
  name!: string;
  quoteKind?: "STANDARD" | "MARGIN";
  systemType!: "ON_GRID" | "OFF_GRID" | "HYBRID";
  targetPowerKwp?: number;
  description?: string;
}

export class CreateTemplateFromQuoteDto {
  quoteId!: string;
  versionId!: string;
  name!: string;
  systemType?: "ON_GRID" | "OFF_GRID" | "HYBRID";
  targetPowerKwp?: number;
}

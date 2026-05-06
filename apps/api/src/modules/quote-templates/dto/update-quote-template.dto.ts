export class UpdateQuoteTemplateDto {
  name?: string;
  systemType?: "ON_GRID" | "OFF_GRID" | "HYBRID";
  targetPowerKwp?: number;
  description?: string;
  active?: boolean;
}

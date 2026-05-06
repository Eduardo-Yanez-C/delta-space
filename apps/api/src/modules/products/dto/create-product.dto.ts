/** Paridad con dist: payloads anidados opcionales. */
export class PanelSpecsDto {
  powerW?: number | null;
  efficiencyPercent?: number | null;
  vmpV?: number | null;
  impA?: number | null;
  vocV?: number | null;
  iscA?: number | null;
  bifacialityPercent?: number | null;
  cellType?: string | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  weightKg?: number | null;
}

export class InverterSpecsDto {
  inverterType?: string | null;
  powerAcW?: number | null;
  maxPvVoltageV?: number | null;
  startupVoltageV?: number | null;
  mpptVoltageMinV?: number | null;
  mpptVoltageMaxV?: number | null;
  maxDcCurrentA?: number | null;
  efficiencyPercent?: number | null;
  connectionType?: string | null;
  ipRating?: string | null;
  communication?: string | null;
}

export class BatterySpecsDto {
  capacityKwh?: number | null;
  nominalVoltageV?: number | null;
  maxChargeDischargePowerW?: number | null;
  chemistry?: string | null;
  cycles?: number | null;
  weightKg?: number | null;
  dimensionsMm?: string | null;
}

export class CreateProductDto {
  name?: string;
  description?: string | null;
  internalCode?: string | null;
  sku?: string | null;
  technicalSheetUrl?: string | null;
  realManufacturer?: string | null;
  commercialStatus?: string | null;
  defaultCurrency?: string | null;
  unit?: string;
  purchaseUnit?: string | null;
  warranty?: string | null;
  leadTimeDays?: number | null;
  stockReference?: string | null;
  origin?: string | null;
  internalNotes?: string | null;
  categoryId?: number;
  brandId?: number | null;
  brandNameFree?: string | null;
  modelId?: number | null;
  modelNameFree?: string | null;
  primarySupplierId?: string | null;
  technicalType?: string | null;
  powerW?: number | null;
  maxCurrentA?: number | null;
  efficiencyPercent?: number | null;
  panelSpecs?: PanelSpecsDto | null;
  inverterSpecs?: InverterSpecsDto | null;
  batterySpecs?: BatterySpecsDto | null;
}

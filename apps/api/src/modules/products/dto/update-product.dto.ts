import type {
  BatterySpecsDto,
  InverterSpecsDto,
  PanelSpecsDto,
} from "./create-product.dto";

export class UpdateProductDto {
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

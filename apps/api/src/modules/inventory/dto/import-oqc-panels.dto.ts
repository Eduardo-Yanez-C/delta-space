import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";

const OQC_PRESET_IDS = ["EGE2026_OQC_2356"] as const;

export class OqcPanelRowDto {
  @IsString()
  @MinLength(4)
  @MaxLength(80)
  serialNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  palletNumber?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  itemN?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  ffPercent?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  isc?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  voc?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  imp?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  vmp?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pmW?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  sheetProductName?: string | null;
}

export class ImportOqcPanelsDto {
  /** Código único de proyecto (p. ej. CSO). Obligatorio salvo que envíe projectId. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  projectCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  projectId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  reportRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceFileHint?: string | null;

  @IsOptional()
  @IsString()
  @IsIn([...OQC_PRESET_IDS])
  preset?: (typeof OQC_PRESET_IDS)[number];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(15_000)
  @ValidateNested({ each: true })
  @Type(() => OqcPanelRowDto)
  panels?: OqcPanelRowDto[];
}

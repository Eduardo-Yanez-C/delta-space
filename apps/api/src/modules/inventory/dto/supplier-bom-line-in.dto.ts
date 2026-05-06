import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

/** Una línea de la vista previa (misma forma que devuelve el borrador de extracción). */
export class SupplierBomLineInDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  bomLineNo?: number | null;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0.000001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  materialGrade?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  componentLabel?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  spareQty?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  qtyPerKit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitKit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitWeightKg?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  totalWeightKg?: number | null;
}

export class ImportSupplierBomConfirmedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  supplierName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  supplierQuoteRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceFileName?: string | null;

  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SupplierBomLineInDto)
  lines!: SupplierBomLineInDto[];
}

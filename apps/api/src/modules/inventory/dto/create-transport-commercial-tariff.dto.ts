import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateTransportCommercialTariffDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierId?: string | null;

  @IsString()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  originHint?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  destinationHint?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  baseAmount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-100)
  fuelAdjustmentPercent?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

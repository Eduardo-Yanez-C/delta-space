import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class UpdateTransportTariffOverrideDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  baseTariffItemId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  action?: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  taxMode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  legalRef?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  documentRef?: string | null;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

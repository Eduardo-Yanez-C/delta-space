import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateTransportTariffOverrideDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  baseTariffItemId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  /** ADDITION | REPLACE_BASE | SUPPRESS_BASE */
  action?: string;

  @IsString()
  @MaxLength(400)
  label!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  @MaxLength(32)
  unit!: string;

  @IsString()
  @MaxLength(24)
  taxMode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  legalRef?: string | null;

  @IsString()
  @MaxLength(2000)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  documentRef?: string | null;

  @IsDateString()
  validFrom!: string;

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

import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateTransportTariffItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string | null;

  @IsString()
  @MaxLength(400)
  label!: string;

  @IsString()
  @MaxLength(32)
  /** TRIP | CONTAINER | DAY | HOUR | KM | FIXED | UF_PER_TON_MONTH | PCT | OTHER */
  unit!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsString()
  @MaxLength(24)
  /** NONE | VAT_EXTRA | VAT_INCLUDED */
  taxMode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  legalRef?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsDateString()
  activeFrom?: string | null;

  @IsOptional()
  @IsDateString()
  activeTo?: string | null;
}

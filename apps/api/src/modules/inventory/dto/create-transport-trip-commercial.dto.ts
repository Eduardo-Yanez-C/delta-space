import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTransportTripCommercialDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  projectId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  groupKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  palletId?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  tripNumber!: string;

  @IsOptional()
  @IsDateString()
  tripDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  scenario?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kmUsed?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  litersUsed?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  extraChargesNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string | null;
}

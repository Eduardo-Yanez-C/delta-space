import { Type } from "class-transformer";
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateTransportVariableValueDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  value?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  unit?: string | null;

  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @IsOptional()
  @IsDateString()
  validTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  profileId?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  source?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}

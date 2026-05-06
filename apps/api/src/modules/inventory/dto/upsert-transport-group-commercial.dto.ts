import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpsertTransportGroupCommercialDto {
  @IsString()
  @MaxLength(256)
  groupKey!: string;

  @IsString()
  @MaxLength(64)
  projectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  palletId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tariffId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  contractVersionId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  fuelSurchargePercent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  agreedAmount?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @IsOptional()
  @IsBoolean()
  manualPrice?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  commercialNotes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  commercialStatus?: string;
}

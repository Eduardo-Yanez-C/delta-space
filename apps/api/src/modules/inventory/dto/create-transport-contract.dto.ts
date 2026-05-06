import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateTransportContractDto {
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
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractNumber?: string | null;

  @IsOptional()
  @IsDateString()
  signedAt?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  paymentTerms?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  jurisdiction?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  defaultCurrency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  vatRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

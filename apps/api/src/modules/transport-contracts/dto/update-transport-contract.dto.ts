import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateTransportContractDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  contractNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  clientLegalName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  contractorLegalName?: string | null;

  @IsOptional()
  @IsDateString()
  signedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
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
  defaultVatPercent?: number;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Perfil de variables de mercado (Fase 2); null desvincula. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  transportVariableProfileId?: string | null;
}

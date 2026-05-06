import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTransportContractVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  /** Si se indica, copia ítems de esa versión (mismo contrato). */
  copyFromVersionId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string | null;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

import { IsDateString, IsNumber, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  client?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsObject()
  taskStatusConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  logisticsTransportStatusConfig?: Record<string, unknown>;

  /** Perfil de variables de transporte (Fase 2); null desvincula. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  transportVariableProfileId?: string | null;
}

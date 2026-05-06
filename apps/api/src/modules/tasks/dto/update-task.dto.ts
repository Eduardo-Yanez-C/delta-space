import { Allow, IsDateString, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from "class-validator";

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  contextNote?: string | null;

  @IsOptional()
  @Allow()
  customFields?: unknown;

  /** Añade líneas al historial de actividad (sin reemplazar el log completo). */
  @IsOptional()
  @Allow()
  appendActivityEntries?: unknown;

  /** Usuario asignado (id de User) o null para quitar asignación. */
  @IsOptional()
  @Allow()
  assigneeUserId?: string | null;

  /** Tarea de la que depende esta (mismo proyecto) o null para quitar. */
  @IsOptional()
  @Allow()
  dependencyTaskId?: string | null;
}

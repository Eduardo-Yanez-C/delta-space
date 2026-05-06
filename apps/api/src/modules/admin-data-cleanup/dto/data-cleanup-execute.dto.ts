import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { CLEANUP_MODULE_KEYS, type CleanupModuleKey } from "../admin-data-cleanup.constants";

export class DataCleanupExecuteDto {
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn([...CLEANUP_MODULE_KEYS], { each: true })
  modules?: CleanupModuleKey[];

  @IsString()
  @MinLength(1)
  password!: string;

  @IsString()
  confirmPhrase!: string;

  /** Obligatoria si el plan incluye USERS: valor exacto `DESACTIVAR_USUARIOS` (desactivación masiva, no borrado físico). */
  @IsOptional()
  @IsString()
  confirmUsersPhrase?: string;
}

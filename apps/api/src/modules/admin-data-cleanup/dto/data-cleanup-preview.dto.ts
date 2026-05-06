import { IsArray, IsBoolean, IsIn, IsOptional } from "class-validator";
import { CLEANUP_MODULE_KEYS, type CleanupModuleKey } from "../admin-data-cleanup.constants";

export class DataCleanupPreviewDto {
  @IsOptional()
  @IsBoolean()
  all?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn([...CLEANUP_MODULE_KEYS], { each: true })
  modules?: CleanupModuleKey[];
}

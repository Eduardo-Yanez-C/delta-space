import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import {
  MARGIN_MOUNT_STRUCTURE_TYPES,
  MARGIN_SYSTEM_TYPES,
} from "../margin-hierarchy.constants";

const SYSTEM_VALUES = [...MARGIN_SYSTEM_TYPES];
const MOUNT_VALUES = [...MARGIN_MOUNT_STRUCTURE_TYPES];

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return value as boolean | undefined;
}

export class ApplyCleanDto {
  @IsIn(SYSTEM_VALUES, {
    message: `systemType debe ser uno de: ${SYSTEM_VALUES.join(", ")}`,
  })
  systemType!: string;

  @IsIn(MOUNT_VALUES, {
    message: `mountStructureType debe ser uno de: ${MOUNT_VALUES.join(", ")}`,
  })
  mountStructureType!: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  replaceExisting?: boolean;
}

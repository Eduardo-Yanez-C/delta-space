import { IsBoolean, IsOptional } from "class-validator";

export class ApplyLatestMarginSnapshotDto {
  @IsOptional()
  @IsBoolean()
  replaceExisting?: boolean;
}

import { Type } from "class-transformer";
import { IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";

export class BulkImportScheduleRowDto {
  @IsString()
  @MaxLength(500)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  wbsCode?: string | null;
}

export class BulkImportScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkImportScheduleRowDto)
  rows!: BulkImportScheduleRowDto[];
}

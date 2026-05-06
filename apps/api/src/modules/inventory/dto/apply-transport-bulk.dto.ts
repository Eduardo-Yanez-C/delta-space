import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { TransportFieldsPatchDto } from "./apply-transport-group.dto";

export class TransportBulkTargetDto {
  @IsString()
  @MaxLength(64)
  projectId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  palletId?: string | null;
}

export class ApplyTransportBulkDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(400)
  @ValidateNested({ each: true })
  @Type(() => TransportBulkTargetDto)
  targets!: TransportBulkTargetDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  snapshotId?: string | null;

  @ValidateNested()
  @Type(() => TransportFieldsPatchDto)
  patch!: TransportFieldsPatchDto;
}

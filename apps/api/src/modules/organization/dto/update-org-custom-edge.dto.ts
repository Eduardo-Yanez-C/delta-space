import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

export class UpdateOrgCustomEdgeDto {
  @IsOptional()
  @IsString()
  @MaxLength(32)
  color?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.5)
  strokeWidth?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  dashPattern?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(-800)
  @Max(800)
  midOffsetX?: number;

  @IsOptional()
  @IsNumber()
  @Min(-800)
  @Max(800)
  midOffsetY?: number;
}

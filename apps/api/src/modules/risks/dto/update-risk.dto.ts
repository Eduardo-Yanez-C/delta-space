import { IsDateString, IsIn, IsObject, IsOptional, IsString } from "class-validator";
import { MATRIX_KIND_CODES, RISK_CATEGORY_CODES } from "../risk-category.constants";

export class UpdateRiskDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  probability?: string;

  @IsOptional()
  @IsObject()
  mrbMatrix?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  mitigation?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsIn([...RISK_CATEGORY_CODES])
  riskCategory?: (typeof RISK_CATEGORY_CODES)[number];

  @IsOptional()
  @IsIn([...MATRIX_KIND_CODES])
  matrixKind?: (typeof MATRIX_KIND_CODES)[number];
}


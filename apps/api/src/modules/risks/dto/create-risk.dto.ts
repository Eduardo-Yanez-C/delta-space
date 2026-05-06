import { IsString, IsOptional, IsDateString, IsObject, IsIn } from "class-validator";
import { MATRIX_KIND_CODES, RISK_CATEGORY_CODES } from "../risk-category.constants";

export class CreateRiskDto {
  @IsString()
  description: string;

  @IsString()
  severity: string;

  @IsString()
  probability: string;

  /** Opcional: fila matriz MRB v1 en JSON; si viene, se recalculan campos legacy. */
  @IsOptional()
  @IsObject()
  mrbMatrix?: Record<string, unknown>;

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


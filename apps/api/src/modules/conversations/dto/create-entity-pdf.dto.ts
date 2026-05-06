import { IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateEntityPdfDto {
  @IsString()
  @IsIn(["PRODUCT", "SUPPLIER", "CLIENT", "FV_STUDY", "QUOTE", "QUOTE_TEMPLATE"])
  entityType!:
    | "PRODUCT"
    | "SUPPLIER"
    | "CLIENT"
    | "FV_STUDY"
    | "QUOTE"
    | "QUOTE_TEMPLATE";

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsObject()
  summary?: Record<string, unknown>;
}

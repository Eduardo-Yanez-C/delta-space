import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class CreateSharedEntityDto {
  @IsString()
  @IsIn([
    "PRODUCT",
    "SUPPLIER",
    "CLIENT",
    "FV_STUDY",
    "QUOTE",
    "QUOTE_TEMPLATE",
  ])
  entityType!:
    | "PRODUCT"
    | "SUPPLIER"
    | "CLIENT"
    | "FV_STUDY"
    | "QUOTE"
    | "QUOTE_TEMPLATE";

  @IsObject()
  snapshot!: Record<string, unknown>;

  @IsObject()
  proposedImport!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  sourceEntityId?: string;
}

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  body?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(25)
  mentions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  quoteIds?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSharedEntityDto)
  sharedEntity?: CreateSharedEntityDto;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;
}

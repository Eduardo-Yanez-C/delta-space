import { IsIn, IsNumber, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator";
import { INVENTORY_DESTINATION_KINDS } from "../inventory.constants";

export class CreateInventoryItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  sku?: string | null;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;

  @IsNumber()
  @Min(0)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  storageLocation?: string | null;

  @IsOptional()
  @IsString()
  @IsIn([...INVENTORY_DESTINATION_KINDS])
  destinationKind?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  destinationNote?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  projectId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  quoteId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  productId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  linksJson?: string | null;

  /** Vínculo opcional a importación logística internacional (Operación internacional). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  logisticsInternationalSnapshotId?: string | null;
}

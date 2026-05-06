import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsString, MaxLength, MinLength } from "class-validator";

/** Refina en servidor el borrador BOM ya extraído (misma forma que líneas del borrador). */
export class RefineSupplierBomDraftAiDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(400)
  @IsObject({ each: true })
  lines!: Record<string, unknown>[];

  @IsString()
  @MinLength(4)
  @MaxLength(4000)
  instruction!: string;
}

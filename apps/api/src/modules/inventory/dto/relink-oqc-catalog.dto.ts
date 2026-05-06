import { IsString, MinLength } from "class-validator";

export class RelinkOqcCatalogDto {
  @IsString()
  @MinLength(1)
  projectId!: string;
}

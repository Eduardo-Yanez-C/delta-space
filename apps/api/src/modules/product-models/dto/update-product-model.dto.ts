import { IsInt, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProductModelDto {
  @IsOptional()
  @IsInt()
  brandId?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;
}

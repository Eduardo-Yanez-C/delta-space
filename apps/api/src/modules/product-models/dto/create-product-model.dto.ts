import { IsInt, IsString, MaxLength, MinLength } from "class-validator";

export class CreateProductModelDto {
  @IsInt()
  brandId!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;
}

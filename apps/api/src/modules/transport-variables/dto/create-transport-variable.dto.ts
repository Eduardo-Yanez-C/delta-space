import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateTransportVariableDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  defaultUnit?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

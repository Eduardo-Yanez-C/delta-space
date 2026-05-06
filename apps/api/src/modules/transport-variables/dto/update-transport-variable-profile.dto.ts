import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateTransportVariableProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

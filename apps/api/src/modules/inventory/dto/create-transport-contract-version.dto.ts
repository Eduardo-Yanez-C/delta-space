import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateTransportContractVersionDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

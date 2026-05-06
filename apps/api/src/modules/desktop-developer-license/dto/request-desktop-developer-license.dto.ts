import { Type } from "class-transformer";
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class RequestDesktopDeveloperLicenseDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(256)
  password!: string;

  @IsUUID("4")
  installationId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  requestedDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  appVersion?: string;
}

import { IsNotEmpty, IsString } from "class-validator";

export class UploadLicenseDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}

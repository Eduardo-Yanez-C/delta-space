import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { DesktopDeveloperLicenseService } from "./desktop-developer-license.service";
import { RequestDesktopDeveloperLicenseDto } from "./dto/request-desktop-developer-license.dto";

@Controller("v1/desktop-developer-license")
export class DesktopDeveloperLicenseController {
  constructor(private readonly service: DesktopDeveloperLicenseService) {}

  @Post()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async issue(@Body() dto: RequestDesktopDeveloperLicenseDto) {
    return this.service.issueSignedRecord(dto);
  }
}

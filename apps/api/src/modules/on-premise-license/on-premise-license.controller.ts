import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ROLE_ADMIN, ROLE_ADMIN_DEV } from "../auth/role-constants";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UploadLicenseDto } from "./dto/upload-license.dto";
import { OnPremiseLicenseService } from "./on-premise-license.service";

@Controller("admin/on-premise-license")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
export class OnPremiseLicenseController {
  constructor(private readonly license: OnPremiseLicenseService) {}

  @Get("status")
  status() {
    return this.license.getStatus();
  }

  @Post("upload")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  upload(@Body() dto: UploadLicenseDto) {
    const r = this.license.saveLicenseToken(dto.token);
    if (r.ok === false) {
      throw new BadRequestException({
        code: "LICENSE_UPLOAD_REJECTED",
        message: r.message,
      });
    }
    return { ok: true };
  }
}

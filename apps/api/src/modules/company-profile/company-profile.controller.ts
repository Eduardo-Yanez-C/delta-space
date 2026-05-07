import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ROLE_ADMIN, ROLE_ADMIN_DEV } from "../auth/role-constants";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserPayload } from "../auth/auth.service";
import { CompanyProfileService } from "./company-profile.service";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

@Controller("company-profile")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  @Get()
  getProfile(@CurrentUser() user: AuthUserPayload) {
    return this.companyProfileService.findOne(user.companyId);
  }

  @Patch()
  updateProfile(@CurrentUser() user: AuthUserPayload, @Body() dto: UpdateCompanyProfileDto) {
    return this.companyProfileService.update(user.companyId, dto);
  }

  @Post("logo")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadLogo(
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size?: number } | undefined,
    @CurrentUser() user: AuthUserPayload,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(
        "Se requiere un archivo de imagen (campo 'file').",
      );
    }
    return this.companyProfileService.uploadLogo(user.companyId, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      size: file.size,
    });
  }

  @Delete("logo")
  deleteLogo(@CurrentUser() user: AuthUserPayload) {
    return this.companyProfileService.deleteLogo(user.companyId);
  }

  @Get("logo")
  async getLogo(@CurrentUser() user: AuthUserPayload, @Res() res: Response) {
    const { buffer, mime } = await this.companyProfileService.getLogoFile(user.companyId);
    const contentType = mime.startsWith("image/")
      ? mime
      : "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  }
}

import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import {
  ROLE_ADMIN,
  ROLE_ADMIN_DEV,
  ROLE_INGENIERIA,
  ROLE_LECTURA,
  ROLE_VENDEDOR_TECNICO,
  ROLE_VENTAS_LEGACY,
} from "../auth/role-constants";
import { CompanyProfileService } from "../company-profile/company-profile.service";

@Controller("quotes/document")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  ROLE_ADMIN_DEV,
  ROLE_ADMIN,
  ROLE_VENDEDOR_TECNICO,
  ROLE_VENTAS_LEGACY,
  ROLE_INGENIERIA,
  ROLE_LECTURA,
)
export class QuoteDocumentCompanyProfileController {
  constructor(
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  @Get("company-profile")
  getForDocument() {
    return this.companyProfileService.findOne();
  }

  @Get("company-profile/logo")
  async getLogo(@Res() res: Response) {
    const { buffer, mime } = await this.companyProfileService.getLogoFile();
    const contentType = mime.startsWith("image/")
      ? mime
      : "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  }
}

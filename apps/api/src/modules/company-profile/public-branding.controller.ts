import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { CompanyProfileService } from "./company-profile.service";

/**
 * Branding sin JWT: pantalla de login y shell previo a sesión.
 * Solo expone existencia de logo + bytes del archivo (misma política que descarga en documentos).
 */
@Controller("public/branding")
export class PublicBrandingController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}
  // Login no conoce tenant aún: usamos branding de empresa default.
  private readonly defaultCompanyId = "company_default";

  @Get("company-profile")
  async companyProfileSummary() {
    const p = await this.companyProfileService.findOne(this.defaultCompanyId);
    return { hasLogo: p.hasLogo === true };
  }

  @Get("company-logo")
  async companyLogo(@Res() res: Response) {
    const { buffer, mime } = await this.companyProfileService.getLogoFile(this.defaultCompanyId);
    const contentType = mime.startsWith("image/")
      ? mime
      : "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(buffer);
  }
}

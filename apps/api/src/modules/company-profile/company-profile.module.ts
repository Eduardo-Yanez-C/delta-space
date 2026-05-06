import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { CompanyProfileController } from "./company-profile.controller";
import { CompanyProfileService } from "./company-profile.service";
import { PublicBrandingController } from "./public-branding.controller";

@Module({
  imports: [PrismaModule],
  controllers: [CompanyProfileController, PublicBrandingController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}

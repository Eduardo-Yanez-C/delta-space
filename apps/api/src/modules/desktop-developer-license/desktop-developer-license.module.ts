import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DesktopDeveloperLicenseController } from "./desktop-developer-license.controller";
import { DesktopDeveloperLicenseService } from "./desktop-developer-license.service";
import { DesktopLicenseDebugController } from "./desktop-license-debug.controller";

@Module({
  imports: [AuthModule],
  controllers: [
    DesktopDeveloperLicenseController,
    DesktopLicenseDebugController,
  ],
  providers: [DesktopDeveloperLicenseService],
})
export class DesktopDeveloperLicenseModule {}

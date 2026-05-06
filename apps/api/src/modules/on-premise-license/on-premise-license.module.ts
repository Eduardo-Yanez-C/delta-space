import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "../auth/auth.module";
import { OnPremiseLicenseController } from "./on-premise-license.controller";
import { OnPremiseLicenseGuard } from "./on-premise-license.guard";
import { OnPremiseLicenseService } from "./on-premise-license.service";

@Module({
  imports: [AuthModule],
  controllers: [OnPremiseLicenseController],
  providers: [
    OnPremiseLicenseService,
    {
      provide: APP_GUARD,
      useClass: OnPremiseLicenseGuard,
    },
  ],
  exports: [OnPremiseLicenseService],
})
export class OnPremiseLicenseModule {}

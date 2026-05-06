import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { InstallationsController } from "./installations.controller";
import { InstallationsService } from "./installations.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [InstallationsController],
  providers: [InstallationsService],
  exports: [InstallationsService],
})
export class InstallationsModule {}

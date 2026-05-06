import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { AdminDataCleanupController } from "./admin-data-cleanup.controller";
import { AdminDataCleanupService } from "./admin-data-cleanup.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminDataCleanupController],
  providers: [AdminDataCleanupService],
})
export class AdminDataCleanupModule {}

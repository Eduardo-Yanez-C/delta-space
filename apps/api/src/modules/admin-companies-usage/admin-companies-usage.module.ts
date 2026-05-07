import { Module } from "@nestjs/common";
import { AdminCompaniesUsageController } from "./admin-companies-usage.controller";
import { AdminCompaniesUsageService } from "./admin-companies-usage.service";

@Module({
  controllers: [AdminCompaniesUsageController],
  providers: [AdminCompaniesUsageService],
})
export class AdminCompaniesUsageModule {}


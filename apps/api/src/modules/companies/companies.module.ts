import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { AuditLogModule } from "../audit-log/audit-log.module";

@Module({
  imports: [AuditLogModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}


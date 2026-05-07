import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AuditLogService } from "./audit-log.service";

@Controller("admin/audit-logs")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN_DEV", "ADMIN")
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  @Get()
  findRecent(
    @Query("take") take?: string,
    @Query("companyId") companyId?: string,
    @Query("userId") userId?: string,
    @Query("entityType") entityType?: string,
    @Query("entityId") entityId?: string,
  ) {
    return this.audit.findRecent({
      take: take ? Number(take) : undefined,
      companyId: companyId?.trim() || undefined,
      userId: userId?.trim() || undefined,
      entityType: entityType?.trim() || undefined,
      entityId: entityId?.trim() || undefined,
    });
  }
}


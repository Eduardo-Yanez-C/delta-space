import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AdminCompaniesUsageService } from "./admin-companies-usage.service";

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return { from, to };
}

@Controller("admin/companies/usage")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN_DEV", "ADMIN")
export class AdminCompaniesUsageController {
  constructor(private readonly usage: AdminCompaniesUsageService) {}

  @Get()
  getUsage(@Query("from") fromRaw?: string, @Query("to") toRaw?: string) {
    const def = defaultRange();
    return this.usage.getUsage({
      from: (fromRaw?.trim() || def.from),
      to: (toRaw?.trim() || def.to),
    });
  }
}


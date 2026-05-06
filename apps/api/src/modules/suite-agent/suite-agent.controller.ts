import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserPayload } from "../auth/auth.service";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { SuiteAgentService } from "./suite-agent.service";

@Controller("suite-agent")
export class SuiteAgentController {
  constructor(private readonly suiteAgent: SuiteAgentService) {}

  /** Consumo del mes (UTC) del usuario autenticado; opcional ?year=2026&month=5 */
  @Get("usage/me")
  @UseGuards(JwtAuthGuard)
  usageMe(
    @CurrentUser() user: AuthUserPayload,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return this.suiteAgent.getUsageMe(user, year, month);
  }

  /** Por usuario + serie diaria; solo ADMIN / ADMIN_DEV. ?year=&month=&userId=opcional */
  @Get("usage/admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  usageAdmin(
    @CurrentUser() user: AuthUserPayload,
    @Query("year") year: string,
    @Query("month") month: string,
    @Query("userId") userId?: string,
  ) {
    const y = parseInt(year, 10);
    const m = parseInt(month, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m)) {
      throw new BadRequestException("Parámetros year y month son obligatorios (números).");
    }
    return this.suiteAgent.getUsageAdmin(user, y, m, userId?.trim() || undefined);
  }

  /** Chat con modelo externo + herramientas (tareas de proyecto cuando hay contexto). */
  @Post("chat")
  @UseGuards(JwtAuthGuard)
  chat(@CurrentUser() user: AuthUserPayload, @Body() body: unknown) {
    return this.suiteAgent.chat(user, body);
  }
}

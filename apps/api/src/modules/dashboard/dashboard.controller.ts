import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserPayload } from "../auth/auth.service";
import { DashboardService } from "./dashboard.service";
import { ExternalIndicatorsService } from "./external-indicators.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
    constructor(
        private readonly dashboardService: DashboardService,
        private readonly externalIndicatorsService: ExternalIndicatorsService,
    ) {}

    @Get()
    getDashboard(@CurrentUser() user: AuthUserPayload) {
        return this.dashboardService.getDashboard(user);
    }

    @Get("external-indicators")
    getExternalIndicators() {
        return this.externalIndicatorsService.getExternalIndicators();
    }

    @Get("external-indicators/series")
    getExternalIndicatorsSeries(@Query("period") period: string | undefined) {
        const p = (period ?? "monthly").toLowerCase();
        if (p !== "weekly" && p !== "monthly" && p !== "yearly")
            return this.externalIndicatorsService.getExternalIndicatorsSeries("monthly");
        return this.externalIndicatorsService.getExternalIndicatorsSeries(p);
    }
}

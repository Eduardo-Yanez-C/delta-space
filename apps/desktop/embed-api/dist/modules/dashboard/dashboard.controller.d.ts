import type { AuthUserPayload } from "../auth/auth.service";
import { DashboardService } from "./dashboard.service";
import { ExternalIndicatorsService } from "./external-indicators.service";
export declare class DashboardController {
    private readonly dashboardService;
    private readonly externalIndicatorsService;
    constructor(dashboardService: DashboardService, externalIndicatorsService: ExternalIndicatorsService);
    getDashboard(user: AuthUserPayload): Promise<import("./dashboard.service").DashboardData>;
    getExternalIndicators(): Promise<import("./external-indicators.service").ExternalIndicatorsResponse>;
    getExternalIndicatorsSeries(period?: string): Promise<import("./external-indicators.service").ExternalIndicatorsSeriesResponse>;
}

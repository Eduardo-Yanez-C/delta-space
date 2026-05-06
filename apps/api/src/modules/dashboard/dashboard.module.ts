import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { ExternalIndicatorsService } from "./external-indicators.service";

@Module({
    controllers: [DashboardController],
    providers: [DashboardService, ExternalIndicatorsService],
    exports: [DashboardService],
})
export class DashboardModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { CommercialPerformanceController } from "./commercial-performance.controller";
import { CommercialPerformanceService } from "./commercial-performance.service";

@Module({
    imports: [PrismaModule],
    controllers: [CommercialPerformanceController],
    providers: [CommercialPerformanceService],
})
export class CommercialPerformanceModule {}

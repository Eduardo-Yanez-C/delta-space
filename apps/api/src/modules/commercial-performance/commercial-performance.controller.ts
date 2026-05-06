import { Controller, Get, Query, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ROLE_ADMIN, ROLE_ADMIN_DEV } from "../auth/role-constants";
import { CommercialPerformanceService } from "./commercial-performance.service";
import { CommercialPerformanceQueryDto } from "./dto/commercial-performance-query.dto";

@Controller("admin/commercial-performance")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
export class CommercialPerformanceController {
    constructor(private readonly commercialPerformanceService: CommercialPerformanceService) {}

    @Get()
    @UsePipes(
        new ValidationPipe({
            transform: true,
            whitelist: true,
            forbidNonWhitelisted: false,
        }),
    )
    getPanel(@Query() query: CommercialPerformanceQueryDto) {
        return this.commercialPerformanceService.getPanel(query);
    }
}

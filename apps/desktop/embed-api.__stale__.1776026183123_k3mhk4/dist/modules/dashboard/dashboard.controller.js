"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const dashboard_service_1 = require("./dashboard.service");
const external_indicators_service_1 = require("./external-indicators.service");
let DashboardController = class DashboardController {
    constructor(dashboardService, externalIndicatorsService) {
        this.dashboardService = dashboardService;
        this.externalIndicatorsService = externalIndicatorsService;
    }
    getDashboard(user) {
        return this.dashboardService.getDashboard(user);
    }
    getExternalIndicators() {
        return this.externalIndicatorsService.getExternalIndicators();
    }
    getExternalIndicatorsSeries(period) {
        const p = (period ?? "monthly").toLowerCase();
        if (p !== "weekly" && p !== "monthly" && p !== "yearly")
            return this.externalIndicatorsService.getExternalIndicatorsSeries("monthly");
        return this.externalIndicatorsService.getExternalIndicatorsSeries(p);
    }
};
exports.DashboardController = DashboardController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)("external-indicators"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getExternalIndicators", null);
__decorate([
    (0, common_1.Get)("external-indicators/series"),
    __param(0, (0, common_1.Query)("period")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DashboardController.prototype, "getExternalIndicatorsSeries", null);
exports.DashboardController = DashboardController = __decorate([
    (0, common_1.Controller)("dashboard"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [dashboard_service_1.DashboardService,
        external_indicators_service_1.ExternalIndicatorsService])
], DashboardController);

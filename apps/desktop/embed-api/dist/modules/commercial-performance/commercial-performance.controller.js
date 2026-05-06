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
exports.CommercialPerformanceController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const role_constants_1 = require("../auth/role-constants");
const commercial_performance_service_1 = require("./commercial-performance.service");
const commercial_performance_query_dto_1 = require("./dto/commercial-performance-query.dto");
let CommercialPerformanceController = class CommercialPerformanceController {
    constructor(commercialPerformanceService) {
        this.commercialPerformanceService = commercialPerformanceService;
    }
    getPanel(query) {
        return this.commercialPerformanceService.getPanel(query);
    }
};
exports.CommercialPerformanceController = CommercialPerformanceController;
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: false,
    })),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [commercial_performance_query_dto_1.CommercialPerformanceQueryDto]),
    __metadata("design:returntype", void 0)
], CommercialPerformanceController.prototype, "getPanel", null);
exports.CommercialPerformanceController = CommercialPerformanceController = __decorate([
    (0, common_1.Controller)("admin/commercial-performance"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_constants_1.ROLE_ADMIN_DEV, role_constants_1.ROLE_ADMIN),
    __metadata("design:paramtypes", [commercial_performance_service_1.CommercialPerformanceService])
], CommercialPerformanceController);

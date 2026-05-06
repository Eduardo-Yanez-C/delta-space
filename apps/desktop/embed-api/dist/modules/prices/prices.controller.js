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
exports.PricesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const role_constants_1 = require("../auth/role-constants");
const prices_service_1 = require("./prices.service");
const close_price_validity_dto_1 = require("./dto/close-price-validity.dto");
const create_price_dto_1 = require("./dto/create-price.dto");
let PricesController = class PricesController {
    constructor(pricesService) {
        this.pricesService = pricesService;
    }
    findAll(productId, supplierId, validAt, supplyOrigin, user) {
        return this.pricesService.findAll({
            productId: productId || undefined,
            supplierId: supplierId || undefined,
            validAt: validAt || undefined,
            supplyOrigin: supplyOrigin || undefined,
        }, user);
    }
    closeValidity(id, body, user) {
        return this.pricesService.closeOpenValidity(id, body ?? {}, user);
    }
    findOne(id, user) {
        return this.pricesService.findOne(id, user);
    }
    create(dto) {
        return this.pricesService.create(dto);
    }
};
exports.PricesController = PricesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("productId")),
    __param(1, (0, common_1.Query)("supplierId")),
    __param(2, (0, common_1.Query)("validAt")),
    __param(3, (0, common_1.Query)("supplyOrigin")),
    __param(4, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, Object]),
    __metadata("design:returntype", void 0)
], PricesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Patch)(":id/close-validity"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
    })),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, close_price_validity_dto_1.ClosePriceValidityDto, Object]),
    __metadata("design:returntype", void 0)
], PricesController.prototype, "closeValidity", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PricesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_price_dto_1.CreatePriceDto]),
    __metadata("design:returntype", void 0)
], PricesController.prototype, "create", null);
exports.PricesController = PricesController = __decorate([
    (0, common_1.Controller)("prices"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prices_service_1.PricesService])
], PricesController);

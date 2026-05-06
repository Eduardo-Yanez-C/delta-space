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
exports.ProductModelsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const product_models_service_1 = require("./product-models.service");
const create_product_model_dto_1 = require("./dto/create-product-model.dto");
const update_product_model_dto_1 = require("./dto/update-product-model.dto");
let ProductModelsController = class ProductModelsController {
    constructor(productModelsService) {
        this.productModelsService = productModelsService;
    }
    findAll(brandId) {
        const brandIdNum = brandId ? parseInt(brandId, 10) : undefined;
        return this.productModelsService.findAll(brandIdNum !== undefined && Number.isNaN(brandIdNum)
            ? undefined
            : brandIdNum);
    }
    create(dto) {
        return this.productModelsService.create(dto);
    }
    findOne(id) {
        return this.productModelsService.findOne(id);
    }
    update(id, dto) {
        return this.productModelsService.update(id, dto);
    }
    remove(id) {
        return this.productModelsService.remove(id);
    }
};
exports.ProductModelsController = ProductModelsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("brandId")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProductModelsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN_DEV", "ADMIN"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_product_model_dto_1.CreateProductModelDto]),
    __metadata("design:returntype", void 0)
], ProductModelsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProductModelsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN_DEV", "ADMIN"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_product_model_dto_1.UpdateProductModelDto]),
    __metadata("design:returntype", void 0)
], ProductModelsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN_DEV", "ADMIN"),
    __param(0, (0, common_1.Param)("id", common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], ProductModelsController.prototype, "remove", null);
exports.ProductModelsController = ProductModelsController = __decorate([
    (0, common_1.Controller)("product-models"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [product_models_service_1.ProductModelsService])
], ProductModelsController);

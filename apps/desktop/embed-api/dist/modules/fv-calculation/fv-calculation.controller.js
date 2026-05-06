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
exports.FvCalculationController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const fv_calculation_service_1 = require("./fv-calculation.service");
const create_fv_calculation_dto_1 = require("./dto/create-fv-calculation.dto");
let FvCalculationController = class FvCalculationController {
    constructor(fvCalculation) {
        this.fvCalculation = fvCalculation;
    }
    async findOne(quoteId, versionId, user) {
        const result = await this.fvCalculation.findByQuote(quoteId, versionId, user);
        return result;
    }
    async create(quoteId, dto, user) {
        const quoteVersionId = dto.quoteVersionId;
        return this.fvCalculation.save(quoteId, dto, user, quoteVersionId);
    }
};
exports.FvCalculationController = FvCalculationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Query)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], FvCalculationController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_fv_calculation_dto_1.CreateFvCalculationDto, Object]),
    __metadata("design:returntype", Promise)
], FvCalculationController.prototype, "create", null);
exports.FvCalculationController = FvCalculationController = __decorate([
    (0, common_1.Controller)("quotes/:quoteId/fv-calculation"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [fv_calculation_service_1.FvCalculationService])
], FvCalculationController);

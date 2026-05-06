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
exports.FvStudyController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const fv_study_service_1 = require("./fv-study.service");
const solar_explorer_service_1 = require("./solar-explorer.service");
const create_fv_study_dto_1 = require("./dto/create-fv-study.dto");
const update_fv_study_dto_1 = require("./dto/update-fv-study.dto");
const role_constants_1 = require("../auth/role-constants");
let FvStudyController = class FvStudyController {
    constructor(fvStudyService, solarExplorerService) {
        this.fvStudyService = fvStudyService;
        this.solarExplorerService = solarExplorerService;
    }
    findAll(clientId, user) {
        return this.fvStudyService.findAll(clientId, user);
    }
    async requestExternalEstimate(id, user) {
        console.log("[SOLAR-DEBUG] POST /fv-studies/:id/solar-resource/external-estimate hit, id =", id);
        const context = await this.fvStudyService.getSolarResourceExternalContext(id, user);
        const validation = this.solarExplorerService.validateContext(context);
        if (!validation.valid) {
            throw new common_1.BadRequestException(validation.message ?? "Contexto insuficiente para estimación externa.");
        }
        return this.solarExplorerService.requestExternalEstimate(context);
    }
    getSolarResourceExternalContext(id, user) {
        return this.fvStudyService.getSolarResourceExternalContext(id, user);
    }
    findOne(id, user) {
        return this.fvStudyService.findOne(id, user);
    }
    createQuoteFromStudy(id, body, user) {
        const createWithSuggestedItems = body?.createWithSuggestedItems !== false;
        const quoteKind = body?.quoteKind === "MARGIN" ? "MARGIN" : "STANDARD";
        return this.fvStudyService.createQuoteFromStudy(id, createWithSuggestedItems, user, { quoteKind });
    }
    create(dto, user) {
        return this.fvStudyService.create(dto, user);
    }
    archive(id, user) {
        return this.fvStudyService.archive(id, user);
    }
    update(id, dto, user) {
        return this.fvStudyService.update(id, dto, user);
    }
    remove(id, user) {
        return this.fvStudyService.remove(id, user);
    }
};
exports.FvStudyController = FvStudyController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)("clientId")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(":id/solar-resource/external-estimate"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], FvStudyController.prototype, "requestExternalEstimate", null);
__decorate([
    (0, common_1.Get)(":id/solar-resource/external-context"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "getSolarResourceExternalContext", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(":id/create-quote"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "createQuoteFromStudy", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_fv_study_dto_1.CreateFvStudyDto, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id/archive"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "archive", null);
__decorate([
    (0, common_1.Patch)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_fv_study_dto_1.UpdateFvStudyDto, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(":id"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(...role_constants_1.OPERATIONAL_WRITE_ROLES),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], FvStudyController.prototype, "remove", null);
exports.FvStudyController = FvStudyController = __decorate([
    (0, common_1.Controller)("fv-studies"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [fv_study_service_1.FvStudyService,
        solar_explorer_service_1.SolarExplorerService])
], FvStudyController);

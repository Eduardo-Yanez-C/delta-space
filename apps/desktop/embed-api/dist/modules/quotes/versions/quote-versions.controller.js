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
exports.QuoteVersionsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../../auth/decorators/roles.decorator");
const roles_guard_1 = require("../../auth/roles.guard");
const quote_addons_service_1 = require("../../quote-addons/quote-addons.service");
const set_addon_inputs_dto_1 = require("../../quote-addons/dto/set-addon-inputs.dto");
const quote_versions_service_1 = require("./quote-versions.service");
const technical_validations_service_1 = require("../technical-validations/technical-validations.service");
const create_version_dto_1 = require("./dto/create-version.dto");
const update_version_dto_1 = require("./dto/update-version.dto");
/** Orden de rutas alineado con dist (segmentos específicos antes que `:versionId` plano). */
let QuoteVersionsController = class QuoteVersionsController {
    constructor(versionsService, quoteAddOnsService, technicalValidationsService) {
        this.versionsService = versionsService;
        this.quoteAddOnsService = quoteAddOnsService;
        this.technicalValidationsService = technicalValidationsService;
    }
    findAll(quoteId, user) {
        return this.versionsService.findAll(quoteId, user);
    }
    getAddonInputs(quoteId, versionId, user) {
        return this.quoteAddOnsService.getAddOnInputs(quoteId, versionId, user);
    }
    setAddonInputs(quoteId, versionId, dto, user) {
        return this.quoteAddOnsService.setAddOnInputs(quoteId, versionId, dto, user);
    }
    getAddonSuggestions(quoteId, versionId, user) {
        return this.quoteAddOnsService.getAddOnSuggestions(quoteId, versionId, user);
    }
    evaluateAddonSuggestions(quoteId, versionId, user) {
        return this.quoteAddOnsService.evaluateAddOnSuggestions(quoteId, versionId, user);
    }
    acceptAddonSuggestion(quoteId, versionId, suggestionId, user) {
        return this.versionsService.acceptAddonSuggestion(quoteId, versionId, suggestionId, user);
    }
    rejectAddonSuggestion(quoteId, versionId, suggestionId, user) {
        return this.versionsService.rejectAddonSuggestion(quoteId, versionId, suggestionId, user);
    }
    getTechnicalValidations(quoteId, versionId, user) {
        return this.technicalValidationsService.getAlerts(quoteId, versionId, user);
    }
    findOne(quoteId, versionId, user) {
        return this.versionsService.findOne(quoteId, versionId, user);
    }
    create(quoteId, dto, user) {
        return this.versionsService.create(quoteId, dto, user.id, user);
    }
    update(quoteId, versionId, dto, user) {
        return this.versionsService.update(quoteId, versionId, dto, user);
    }
    refreshFromStudy(quoteId, versionId, user) {
        return this.versionsService.refreshVersionFromStudy(quoteId, versionId, user);
    }
};
exports.QuoteVersionsController = QuoteVersionsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(":versionId/addon-inputs"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "getAddonInputs", null);
__decorate([
    (0, common_1.Put)(":versionId/addon-inputs"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, set_addon_inputs_dto_1.SetAddonInputsDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "setAddonInputs", null);
__decorate([
    (0, common_1.Get)(":versionId/addon-suggestions"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "getAddonSuggestions", null);
__decorate([
    (0, common_1.Post)(":versionId/addon-suggestions/evaluate"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "evaluateAddonSuggestions", null);
__decorate([
    (0, common_1.Post)(":versionId/addon-suggestions/:suggestionId/accept"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("suggestionId")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "acceptAddonSuggestion", null);
__decorate([
    (0, common_1.Post)(":versionId/addon-suggestions/:suggestionId/reject"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Param)("suggestionId")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "rejectAddonSuggestion", null);
__decorate([
    (0, common_1.Get)(":versionId/technical-validations"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "getTechnicalValidations", null);
__decorate([
    (0, common_1.Get)(":versionId"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_version_dto_1.CreateVersionDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":versionId"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, update_version_dto_1.UpdateVersionDto, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(":versionId/refresh-from-study"),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS", "INGENIERIA"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], QuoteVersionsController.prototype, "refreshFromStudy", null);
exports.QuoteVersionsController = QuoteVersionsController = __decorate([
    (0, common_1.Controller)("quotes/:quoteId/versions"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [quote_versions_service_1.QuoteVersionsService,
        quote_addons_service_1.QuoteAddOnsService,
        technical_validations_service_1.TechnicalValidationsService])
], QuoteVersionsController);

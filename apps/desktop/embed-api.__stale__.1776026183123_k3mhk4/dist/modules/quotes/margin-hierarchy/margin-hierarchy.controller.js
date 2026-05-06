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
exports.MarginHierarchyController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../../auth/decorators/roles.decorator");
const roles_guard_1 = require("../../auth/roles.guard");
const role_constants_1 = require("../../auth/role-constants");
const apply_clean_dto_1 = require("./dto/apply-clean.dto");
const margin_hierarchy_service_1 = require("./margin-hierarchy.service");
let MarginHierarchyController = class MarginHierarchyController {
    constructor(marginHierarchyService) {
        this.marginHierarchyService = marginHierarchyService;
    }
    applyClean(quoteId, versionId, dto, user) {
        return this.marginHierarchyService.applyCleanHierarchy(quoteId, versionId, dto, user);
    }
};
exports.MarginHierarchyController = MarginHierarchyController;
__decorate([
    (0, common_1.Post)("apply-clean"),
    __param(0, (0, common_1.Param)("quoteId")),
    __param(1, (0, common_1.Param)("versionId")),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, apply_clean_dto_1.ApplyCleanDto, Object]),
    __metadata("design:returntype", void 0)
], MarginHierarchyController.prototype, "applyClean", null);
exports.MarginHierarchyController = MarginHierarchyController = __decorate([
    (0, common_1.Controller)("quotes/:quoteId/versions/:versionId/margin-hierarchy"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_constants_1.ROLE_ADMIN_DEV, role_constants_1.ROLE_ADMIN, role_constants_1.ROLE_VENDEDOR_TECNICO),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __metadata("design:paramtypes", [margin_hierarchy_service_1.MarginHierarchyService])
], MarginHierarchyController);

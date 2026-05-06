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
exports.MarginSnapshotsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../../auth/decorators/roles.decorator");
const roles_guard_1 = require("../../auth/roles.guard");
const role_constants_1 = require("../../auth/role-constants");
const margin_snapshots_service_1 = require("./margin-snapshots.service");
let MarginSnapshotsController = class MarginSnapshotsController {
    constructor(marginSnapshotsService) {
        this.marginSnapshotsService = marginSnapshotsService;
    }
    async getLatest(user) {
        const snapshot = await this.marginSnapshotsService.findLatestForUser(user.id);
        return { snapshot };
    }
    list(user) {
        return this.marginSnapshotsService.listForUser(user.id);
    }
};
exports.MarginSnapshotsController = MarginSnapshotsController;
__decorate([
    (0, common_1.Get)("latest"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MarginSnapshotsController.prototype, "getLatest", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarginSnapshotsController.prototype, "list", null);
exports.MarginSnapshotsController = MarginSnapshotsController = __decorate([
    (0, common_1.Controller)("margin-snapshots"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_constants_1.ROLE_ADMIN_DEV, role_constants_1.ROLE_ADMIN, role_constants_1.ROLE_VENDEDOR_TECNICO),
    __metadata("design:paramtypes", [margin_snapshots_service_1.MarginSnapshotsService])
], MarginSnapshotsController);

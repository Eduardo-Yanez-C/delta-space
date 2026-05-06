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
exports.OnPremiseLicenseController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const role_constants_1 = require("../auth/role-constants");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const upload_license_dto_1 = require("./dto/upload-license.dto");
const on_premise_license_service_1 = require("./on-premise-license.service");
let OnPremiseLicenseController = class OnPremiseLicenseController {
    constructor(license) {
        this.license = license;
    }
    status() {
        return this.license.getStatus();
    }
    upload(dto) {
        const r = this.license.saveLicenseToken(dto.token);
        if (r.ok === false) {
            throw new common_1.BadRequestException({
                code: "LICENSE_UPLOAD_REJECTED",
                message: r.message,
            });
        }
        return { ok: true };
    }
};
exports.OnPremiseLicenseController = OnPremiseLicenseController;
__decorate([
    (0, common_1.Get)("status"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], OnPremiseLicenseController.prototype, "status", null);
__decorate([
    (0, common_1.Post)("upload"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [upload_license_dto_1.UploadLicenseDto]),
    __metadata("design:returntype", void 0)
], OnPremiseLicenseController.prototype, "upload", null);
exports.OnPremiseLicenseController = OnPremiseLicenseController = __decorate([
    (0, common_1.Controller)("admin/on-premise-license"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_constants_1.ROLE_ADMIN_DEV, role_constants_1.ROLE_ADMIN),
    __metadata("design:paramtypes", [on_premise_license_service_1.OnPremiseLicenseService])
], OnPremiseLicenseController);

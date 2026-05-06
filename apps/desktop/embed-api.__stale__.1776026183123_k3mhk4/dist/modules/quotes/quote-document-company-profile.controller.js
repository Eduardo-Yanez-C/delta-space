"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteDocumentCompanyProfileController = void 0;
const common_1 = require("@nestjs/common");
const path = __importStar(require("path"));
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const role_constants_1 = require("../auth/role-constants");
const company_profile_service_1 = require("../company-profile/company-profile.service");
let QuoteDocumentCompanyProfileController = class QuoteDocumentCompanyProfileController {
    constructor(companyProfileService) {
        this.companyProfileService = companyProfileService;
    }
    getForDocument() {
        return this.companyProfileService.findOne();
    }
    async getLogo(res) {
        const { absolutePath, mime } = await this.companyProfileService.getLogoFilePath();
        const ext = path.extname(absolutePath).toLowerCase();
        const contentType = mime.startsWith("image/")
            ? mime
            : ext === ".jpg" || ext === ".jpeg"
                ? "image/jpeg"
                : ext === ".webp"
                    ? "image/webp"
                    : "image/png";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "private, max-age=3600");
        res.sendFile(absolutePath);
    }
};
exports.QuoteDocumentCompanyProfileController = QuoteDocumentCompanyProfileController;
__decorate([
    (0, common_1.Get)("company-profile"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], QuoteDocumentCompanyProfileController.prototype, "getForDocument", null);
__decorate([
    (0, common_1.Get)("company-profile/logo"),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuoteDocumentCompanyProfileController.prototype, "getLogo", null);
exports.QuoteDocumentCompanyProfileController = QuoteDocumentCompanyProfileController = __decorate([
    (0, common_1.Controller)("quotes/document"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(role_constants_1.ROLE_ADMIN_DEV, role_constants_1.ROLE_ADMIN, role_constants_1.ROLE_VENDEDOR_TECNICO, role_constants_1.ROLE_VENTAS_LEGACY, role_constants_1.ROLE_INGENIERIA, role_constants_1.ROLE_LECTURA),
    __metadata("design:paramtypes", [company_profile_service_1.CompanyProfileService])
], QuoteDocumentCompanyProfileController);

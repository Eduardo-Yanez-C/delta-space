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
exports.ImplantationScreenshotController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const path = __importStar(require("path"));
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const roles_guard_1 = require("../auth/roles.guard");
const implantation_design_service_1 = require("./implantation-design.service");
let ImplantationScreenshotController = class ImplantationScreenshotController {
    constructor(implantationDesignService) {
        this.implantationDesignService = implantationDesignService;
    }
    ping() {
        return { ok: true };
    }
    async upload(fvStudyId, file, user) {
        if (!file?.buffer) {
            throw new common_1.BadRequestException("Se requiere un archivo de imagen (campo 'file').");
        }
        const mimetype = file.mimetype === "image/png" || file.mimetype === "image/jpeg" ? file.mimetype : "image/png";
        return this.implantationDesignService.updateScreenshot(fvStudyId, { buffer: file.buffer, mimetype }, user);
    }
    async get(fvStudyId, user, res) {
        const filePath = await this.implantationDesignService.getScreenshotPath(fvStudyId, user);
        if (!filePath) {
            res.status(404).json({ message: "No hay captura guardada" });
            return;
        }
        const ext = path.extname(filePath).toLowerCase();
        const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
        res.sendFile(filePath, { headers: { "Content-Type": contentType } });
    }
};
exports.ImplantationScreenshotController = ImplantationScreenshotController;
__decorate([
    (0, common_1.Get)("ping"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ImplantationScreenshotController.prototype, "ping", null);
__decorate([
    (0, common_1.Post)(":fvStudyId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("ADMIN", "VENTAS", "INGENIERIA"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file")),
    __param(0, (0, common_1.Param)("fvStudyId")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ImplantationScreenshotController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(":fvStudyId"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Param)("fvStudyId")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], ImplantationScreenshotController.prototype, "get", null);
exports.ImplantationScreenshotController = ImplantationScreenshotController = __decorate([
    (0, common_1.Controller)("implantation-screenshots"),
    __metadata("design:paramtypes", [implantation_design_service_1.ImplantationDesignService])
], ImplantationScreenshotController);

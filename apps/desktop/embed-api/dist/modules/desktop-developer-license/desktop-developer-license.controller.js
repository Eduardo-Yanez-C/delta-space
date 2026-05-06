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
exports.DesktopDeveloperLicenseController = void 0;
const common_1 = require("@nestjs/common");
const desktop_developer_license_service_1 = require("./desktop-developer-license.service");
const request_desktop_developer_license_dto_1 = require("./dto/request-desktop-developer-license.dto");
let DesktopDeveloperLicenseController = class DesktopDeveloperLicenseController {
    constructor(service) {
        this.service = service;
    }
    async issue(dto) {
        return this.service.issueSignedRecord(dto);
    }
};
exports.DesktopDeveloperLicenseController = DesktopDeveloperLicenseController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [request_desktop_developer_license_dto_1.RequestDesktopDeveloperLicenseDto]),
    __metadata("design:returntype", Promise)
], DesktopDeveloperLicenseController.prototype, "issue", null);
exports.DesktopDeveloperLicenseController = DesktopDeveloperLicenseController = __decorate([
    (0, common_1.Controller)("v1/desktop-developer-license"),
    __metadata("design:paramtypes", [desktop_developer_license_service_1.DesktopDeveloperLicenseService])
], DesktopDeveloperLicenseController);

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopDeveloperLicenseModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const desktop_developer_license_controller_1 = require("./desktop-developer-license.controller");
const desktop_developer_license_service_1 = require("./desktop-developer-license.service");
const desktop_license_debug_controller_1 = require("./desktop-license-debug.controller");
let DesktopDeveloperLicenseModule = class DesktopDeveloperLicenseModule {
};
exports.DesktopDeveloperLicenseModule = DesktopDeveloperLicenseModule;
exports.DesktopDeveloperLicenseModule = DesktopDeveloperLicenseModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule],
        controllers: [
            desktop_developer_license_controller_1.DesktopDeveloperLicenseController,
            desktop_license_debug_controller_1.DesktopLicenseDebugController,
        ],
        providers: [desktop_developer_license_service_1.DesktopDeveloperLicenseService],
    })
], DesktopDeveloperLicenseModule);

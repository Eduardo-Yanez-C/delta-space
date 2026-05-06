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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnPremiseLicenseGuard = void 0;
const common_1 = require("@nestjs/common");
const on_premise_license_service_1 = require("./on-premise-license.service");
let OnPremiseLicenseGuard = class OnPremiseLicenseGuard {
    constructor(license) {
        this.license = license;
    }
    canActivate(context) {
        if (!this.license.isLicenseEnforcementEnabled()) {
            return true;
        }
        const req = context.switchToHttp().getRequest();
        const pathStr = this.normalizePath(req);
        if (this.isAllowlisted(pathStr)) {
            return true;
        }
        const status = this.license.getStatus();
        if (status.state === "OK") {
            return true;
        }
        throw new common_1.HttpException({
            statusCode: common_1.HttpStatus.FORBIDDEN,
            code: "ON_PREMISE_LICENSE_BLOCKED",
            licenseState: status.state,
            message: status.message,
        }, common_1.HttpStatus.FORBIDDEN);
    }
    normalizePath(req) {
        let p = req.path;
        if (!p || p.length === 0) {
            const raw = (req.originalUrl ?? req.url ?? "/").split("?")[0];
            p = raw || "/";
        }
        if (p.length > 1 && p.endsWith("/")) {
            p = p.slice(0, -1);
        }
        return p;
    }
    isAllowlisted(pathStr) {
        if (pathStr === "/api/health" || pathStr.startsWith("/api/health/")) {
            return true;
        }
        if (pathStr === "/api/lan/discovery" || pathStr.startsWith("/api/lan/discovery/")) {
            return true;
        }
        if (pathStr === "/api/auth" || pathStr.startsWith("/api/auth/")) {
            return true;
        }
        if (pathStr === "/api/admin/on-premise-license" ||
            pathStr.startsWith("/api/admin/on-premise-license/")) {
            return true;
        }
        return false;
    }
};
exports.OnPremiseLicenseGuard = OnPremiseLicenseGuard;
exports.OnPremiseLicenseGuard = OnPremiseLicenseGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [on_premise_license_service_1.OnPremiseLicenseService])
], OnPremiseLicenseGuard);

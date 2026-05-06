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
var DesktopDeveloperLicenseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopDeveloperLicenseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const auth_service_1 = require("../auth/auth.service");
const role_constants_1 = require("../auth/role-constants");
const LICENSE_ID_PATTERN = /^LIC-[A-Za-z0-9][A-Za-z0-9._-]*$/;
function canonicalStringify(obj) {
    return JSON.stringify(obj, Object.keys(obj).sort());
}
function signPayload(secret, payload) {
    return crypto
        .createHmac("sha256", secret)
        .update(canonicalStringify(payload))
        .digest("hex");
}
function validUntilAfterCalendarDays(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
}
let DesktopDeveloperLicenseService = DesktopDeveloperLicenseService_1 = class DesktopDeveloperLicenseService {
    constructor(auth, config) {
        this.auth = auth;
        this.config = config;
        this.logger = new common_1.Logger(DesktopDeveloperLicenseService_1.name);
    }
    async issueSignedRecord(dto) {
        const secret = (this.config.get("LICENSE_HMAC_SECRET") ?? "").trim();
        if (!secret) {
            this.logger.error("LICENSE_HMAC_SECRET no configurado; no se puede firmar licencia de escritorio.");
            throw new common_1.ServiceUnavailableException("Emisor de licencias no configurado en el servidor (falta LICENSE_HMAC_SECRET).");
        }
        let user;
        try {
            const out = await this.auth.login(dto.email.trim().toLowerCase(), dto.password);
            user = out.user;
        }
        catch (e) {
            if (e instanceof common_1.UnauthorizedException) {
                throw e;
            }
            this.logger.warn(`Login desarrollador licencia: ${String(e)}`);
            throw new common_1.UnauthorizedException("Credenciales inválidas");
        }
        if (!user.roles?.includes(role_constants_1.ROLE_ADMIN_DEV)) {
            throw new common_1.ForbiddenException("Solo cuentas ADMIN_DEV pueden emitir licencia temporal de escritorio.");
        }
        const serverMax = Math.min(90, Math.max(1, parseInt(this.config.get("DESKTOP_DEV_LICENSE_MAX_DAYS") ?? "30", 10) || 30));
        const days = Math.min(dto.requestedDays, serverMax);
        const licenseId = `LIC-DEV-${Date.now()}`;
        if (!LICENSE_ID_PATTERN.test(licenseId)) {
            throw new Error("licenseId interno inválido");
        }
        const payload = {
            v: 1,
            kind: "renewal",
            licenseId,
            licenseType: "INTERNAL",
            installationId: dto.installationId.trim(),
            validUntil: validUntilAfterCalendarDays(days),
            issuedAt: new Date().toISOString(),
            issuedTo: user.email,
            note: "desktop-developer-api",
        };
        const sig = signPayload(secret, payload);
        this.logger.log(`Licencia temporal escritorio ${licenseId} · ${days}d · inst=${dto.installationId.slice(0, 8)}…`);
        return { payload, sig };
    }
};
exports.DesktopDeveloperLicenseService = DesktopDeveloperLicenseService;
exports.DesktopDeveloperLicenseService = DesktopDeveloperLicenseService = DesktopDeveloperLicenseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], DesktopDeveloperLicenseService);

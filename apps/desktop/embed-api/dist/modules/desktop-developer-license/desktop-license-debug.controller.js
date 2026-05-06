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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesktopLicenseDebugController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Misma secuencia que ConfigModule (app.module): env.embedded → .env por archivo. */
function mergedEnvFromFiles(cwd) {
    let config = {};
    for (const name of ["env.embedded", ".env"]) {
        const p = path.join(cwd, name);
        if (!fs.existsSync(p))
            continue;
        try {
            const parsed = dotenv.parse(fs.readFileSync(p, "utf8"));
            config = Object.assign(parsed, config);
        }
        catch {
            /* ignore */
        }
    }
    return config;
}
let DesktopLicenseDebugController = class DesktopLicenseDebugController {
    constructor(config) {
        this.config = config;
    }
    diag() {
        const fileMerged = mergedEnvFromFiles(process.cwd());
        const allowPackaged = process.env.EMBEDDED_PACKAGED_DESKTOP === "1";
        const diagRaw = process.env.DESKTOP_LICENSE_DIAG_ALLOW;
        const diagFromProcess = diagRaw !== undefined && String(diagRaw).trim() !== ""
            ? String(diagRaw).trim()
            : undefined;
        const allowLocalLab = diagFromProcess === "1" ||
            (diagFromProcess === undefined && fileMerged.DESKTOP_LICENSE_DIAG_ALLOW === "1");
        if (!allowPackaged && !allowLocalLab) {
            throw new common_1.NotFoundException();
        }
        const cwd = process.cwd();
        const dotEnvPath = path.join(cwd, ".env");
        const envEmbeddedPath = path.join(cwd, "env.embedded");
        const secret = (this.config.get("LICENSE_HMAC_SECRET") ?? "").trim();
        const fp = secret.length > 0
            ? crypto
                .createHash("sha256")
                .update(secret, "utf8")
                .digest("hex")
                .slice(0, 16)
            : "empty";
        const placeholder = /PVQ-DESKTOP-LICENSE-CHANGE-ME-IN-CI$/i.test(secret) ||
            /MISMO_SECRETO_QUE_BUILD|CHANGE-ME-IN-CI|PVQ-DESKTOP-LICENSE-CHANGE-ME/i.test(secret);
        return {
            role: "nest-embedded",
            cwd,
            dotEnvPath,
            dotEnvExists: fs.existsSync(dotEnvPath),
            envEmbeddedPath,
            envEmbeddedExists: fs.existsSync(envEmbeddedPath),
            secretLength: secret.length,
            fingerprintSha256Prefix16: fp,
            secretFromDotenv: secret.length > 0,
            isPlaceholderDefault: placeholder,
        };
    }
};
exports.DesktopLicenseDebugController = DesktopLicenseDebugController;
__decorate([
    (0, common_1.Get)("diag"),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DesktopLicenseDebugController.prototype, "diag", null);
exports.DesktopLicenseDebugController = DesktopLicenseDebugController = __decorate([
    (0, common_1.Controller)("v1/desktop-license-debug"),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DesktopLicenseDebugController);

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
var OnPremiseLicenseService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnPremiseLicenseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const jwt = __importStar(require("jsonwebtoken"));
const on_premise_license_constants_1 = require("./on-premise-license.constants");
function isOnPremiseModalidad(m) {
    if (m == null || typeof m !== "string") {
        return false;
    }
    const n = m.trim().toUpperCase().replace(/-/g, "_");
    return n === "ON_PREMISE";
}
function parseLicenseEnforcementEnabled(raw) {
    if (raw == null || raw.trim() === "") {
        return false;
    }
    const v = raw.trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
}
function asRecord(p) {
    if (p && typeof p === "object" && !Array.isArray(p)) {
        return p;
    }
    return null;
}
let OnPremiseLicenseService = OnPremiseLicenseService_1 = class OnPremiseLicenseService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(OnPremiseLicenseService_1.name);
        this.cacheTtlMs = 60000;
        this.statusCache = null;
    }
    isLicenseEnforcementEnabled() {
        return parseLicenseEnforcementEnabled(this.config.get("ON_PREMISE_LICENSE_ENABLED"));
    }
    invalidateStatusCache() {
        this.statusCache = null;
    }
    getDataDir() {
        const fromEnv = this.config.get("ON_PREMISE_DATA_DIR");
        if (fromEnv && fromEnv.trim().length > 0) {
            return path.resolve(fromEnv.trim());
        }
        return path.join(process.cwd(), ...on_premise_license_constants_1.DEFAULT_ON_PREMISE_SUBDIR);
    }
    installationPath() {
        return path.join(this.getDataDir(), on_premise_license_constants_1.INSTALLATION_FILE);
    }
    licensePath() {
        return path.join(this.getDataDir(), on_premise_license_constants_1.LICENSE_FILE);
    }
    ensureInstallationId() {
        const dir = this.getDataDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        const p = this.installationPath();
        if (fs.existsSync(p)) {
            try {
                const raw = fs.readFileSync(p, "utf8");
                const j = JSON.parse(raw);
                if (j.installationId && typeof j.installationId === "string") {
                    return j.installationId;
                }
            }
            catch (e) {
                this.logger.warn(`installation.json corrupto o ilegible: ${String(e)}`);
            }
        }
        const installationId = crypto.randomUUID();
        fs.writeFileSync(p, JSON.stringify({ installationId }, null, 2), "utf8");
        this.invalidateStatusCache();
        this.logger.log(`Nuevo installationId generado en ${p}`);
        return installationId;
    }
    getPublicKeyPem() {
        const inline = this.config.get("LICENSE_PUBLIC_KEY_PEM");
        if (inline && inline.trim().length > 0) {
            return inline.replace(/\\n/g, "\n").trim();
        }
        const keyPath = this.config.get("LICENSE_PUBLIC_KEY_PATH");
        if (keyPath && keyPath.trim().length > 0) {
            const resolved = path.resolve(keyPath.trim());
            if (fs.existsSync(resolved)) {
                return fs.readFileSync(resolved, "utf8").trim();
            }
            this.logger.warn(`LICENSE_PUBLIC_KEY_PATH no encontrado: ${resolved}`);
        }
        return null;
    }
    readLicenseRaw() {
        const p = this.licensePath();
        if (!fs.existsSync(p)) {
            return null;
        }
        try {
            return fs.readFileSync(p, "utf8").trim();
        }
        catch {
            return null;
        }
    }
    decodePayloadUnverified(token) {
        try {
            const parts = token.split(".");
            if (parts.length < 2) {
                return null;
            }
            const payload = Buffer.from(parts[1], "base64url").toString("utf8");
            return JSON.parse(payload);
        }
        catch {
            return null;
        }
    }
    verifyAndDecode(token) {
        const pem = this.getPublicKeyPem();
        if (!pem) {
            return { ok: false, error: "MALFORMED" };
        }
        try {
            const decoded = jwt.verify(token, pem, {
                algorithms: ["RS256"],
            });
            if (typeof decoded === "string") {
                return { ok: false, error: "INVALID_SIGNATURE" };
            }
            return { ok: true, payload: decoded };
        }
        catch (err) {
            const name = err && typeof err === "object" && "name" in err
                ? String(err.name)
                : "";
            if (name === "TokenExpiredError") {
                return { ok: false, error: "EXPIRED" };
            }
            if (name === "JsonWebTokenError" || name === "NotBeforeError") {
                return { ok: false, error: "INVALID_SIGNATURE" };
            }
            return { ok: false, error: "INVALID_SIGNATURE" };
        }
    }
    verifyIgnoreExpiration(token, pem) {
        try {
            return jwt.verify(token, pem, {
                algorithms: ["RS256"],
                ignoreExpiration: true,
            });
        }
        catch {
            return null;
        }
    }
    getStatus() {
        const now = Date.now();
        if (this.statusCache &&
            now - this.statusCache.savedAt < this.cacheTtlMs) {
            return this.statusCache.status;
        }
        const status = this.computeStatus();
        this.statusCache = { status, savedAt: now };
        return status;
    }
    computeStatus() {
        const installationId = this.ensureInstallationId();
        if (!this.isLicenseEnforcementEnabled()) {
            return {
                installationId,
                state: "DISABLED",
                expiresAt: null,
                empresa: null,
                modalidad: null,
                message: "Comprobación de licencia on-premise desactivada. Establezca ON_PREMISE_LICENSE_ENABLED=true para exigir licencia en todas las rutas.",
            };
        }
        const pem = this.getPublicKeyPem();
        if (!pem) {
            return {
                installationId,
                state: "PUBLIC_KEY_NOT_CONFIGURED",
                expiresAt: null,
                empresa: null,
                modalidad: null,
                message: "Configure LICENSE_PUBLIC_KEY_PEM o LICENSE_PUBLIC_KEY_PATH para validar la licencia.",
            };
        }
        const raw = this.readLicenseRaw();
        if (!raw) {
            return {
                installationId,
                state: "MISSING",
                expiresAt: null,
                empresa: null,
                modalidad: null,
                message: "No hay archivo de licencia (license.jwt).",
            };
        }
        const verify = this.verifyAndDecode(raw);
        if (verify.ok === false) {
            if (verify.error === "EXPIRED") {
                const payloadVerified = this.verifyIgnoreExpiration(raw, pem);
                const fallback = this.decodePayloadUnverified(raw);
                const p = asRecord(payloadVerified) ?? fallback;
                const expSec = p?.exp;
                return {
                    installationId,
                    state: "EXPIRED",
                    expiresAt: expSec
                        ? new Date(Number(expSec) * 1000).toISOString()
                        : null,
                    empresa: p?.empresa ?? null,
                    modalidad: p?.modalidad ?? null,
                    message: "La licencia ha expirado.",
                };
            }
            const unverified = this.decodePayloadUnverified(raw);
            const exp = unverified?.exp;
            const message = "La licencia no es válida (firma o formato).";
            return {
                installationId,
                state: "INVALID",
                expiresAt: exp
                    ? new Date(Number(exp) * 1000).toISOString()
                    : null,
                empresa: unverified?.empresa ?? null,
                modalidad: unverified?.modalidad ?? null,
                message,
            };
        }
        const payload = verify.payload;
        const licInst = payload.installationId;
        if (!licInst || licInst !== installationId) {
            return {
                installationId,
                state: "INSTALLATION_MISMATCH",
                expiresAt: payload.exp
                    ? new Date(payload.exp * 1000).toISOString()
                    : null,
                empresa: payload.empresa ?? null,
                modalidad: payload.modalidad ?? null,
                message: "El installationId de la licencia no coincide con este servidor.",
            };
        }
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp != null && payload.exp < now) {
            return {
                installationId,
                state: "EXPIRED",
                expiresAt: new Date(payload.exp * 1000).toISOString(),
                empresa: payload.empresa ?? null,
                modalidad: payload.modalidad ?? null,
                message: "La licencia ha expirado.",
            };
        }
        const modalidad = payload.modalidad;
        if (!isOnPremiseModalidad(modalidad)) {
            return {
                installationId,
                state: "INVALID",
                expiresAt: payload.exp
                    ? new Date(payload.exp * 1000).toISOString()
                    : null,
                empresa: payload.empresa ?? null,
                modalidad,
                message: 'La licencia debe incluir claim modalidad compatible con ON_PREMISE (p. ej. "ON_PREMISE").',
            };
        }
        return {
            installationId,
            state: "OK",
            expiresAt: payload.exp
                ? new Date(payload.exp * 1000).toISOString()
                : null,
            empresa: payload.empresa ?? null,
            modalidad,
            message: "Licencia válida.",
        };
    }
    isLicenseOk() {
        if (!this.isLicenseEnforcementEnabled()) {
            return true;
        }
        return this.getStatus().state === "OK";
    }
    saveLicenseToken(token) {
        const trimmed = token.trim();
        if (!trimmed) {
            return { ok: false, message: "Token vacío." };
        }
        const pem = this.getPublicKeyPem();
        if (!pem) {
            return {
                ok: false,
                message: "Configure LICENSE_PUBLIC_KEY_PEM o LICENSE_PUBLIC_KEY_PATH antes de subir la licencia.",
            };
        }
        const verify = this.verifyAndDecode(trimmed);
        if (!verify.ok) {
            return { ok: false, message: "La licencia no es válida (firma RS256)." };
        }
        const installationId = this.ensureInstallationId();
        if (verify.payload.installationId !== installationId) {
            return {
                ok: false,
                message: "El installationId del token no coincide con este servidor.",
            };
        }
        const modalidad = verify.payload.modalidad;
        if (!isOnPremiseModalidad(modalidad)) {
            return {
                ok: false,
                message: 'El claim modalidad debe ser compatible con ON_PREMISE (p. ej. "ON_PREMISE").',
            };
        }
        const now = Math.floor(Date.now() / 1000);
        if (verify.payload.exp != null &&
            verify.payload.exp < now) {
            return { ok: false, message: "La licencia está expirada." };
        }
        const dir = this.getDataDir();
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.licensePath(), trimmed, "utf8");
        this.invalidateStatusCache();
        return { ok: true };
    }
};
exports.OnPremiseLicenseService = OnPremiseLicenseService;
exports.OnPremiseLicenseService = OnPremiseLicenseService = OnPremiseLicenseService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], OnPremiseLicenseService);

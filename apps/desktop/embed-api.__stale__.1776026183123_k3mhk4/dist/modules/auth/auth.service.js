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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let AuthService = class AuthService {
    constructor(prisma, jwtService) {
        this.prisma = prisma;
        this.jwtService = jwtService;
    }
    async login(email, password) {
        const user = await this.prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            include: {
                roles: { include: { role: true } },
            },
        });
        if (!user) {
            throw new common_1.UnauthorizedException("Credenciales inválidas");
        }
        if (!user.active) {
            throw new common_1.UnauthorizedException("Usuario inactivo. Contacte al administrador.");
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            throw new common_1.UnauthorizedException("Credenciales inválidas");
        }
        const payload = {
            id: user.id,
            email: user.email,
            name: user.name,
            fullName: user.fullName ?? null,
            active: user.active,
            roles: user.roles.map((ur) => ur.role.name),
        };
        const accessToken = this.jwtService.sign({ sub: user.id, email: user.email.trim().toLowerCase() }, { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" });
        return { accessToken, user: payload };
    }
    async validateUserById(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                roles: { include: { role: true } },
            },
        });
        if (!user || !user.active)
            return null;
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            fullName: user.fullName ?? null,
            active: user.active,
            roles: user.roles.map((ur) => ur.role.name),
        };
    }
    /** Misma forma que `validateUserById` (p. ej. socket local con JWT emitido en otro nodo, distinto `sub`). */
    async validateUserByEmail(email) {
        const normalized = email.trim().toLowerCase();
        if (!normalized)
            return null;
        const user = await this.prisma.user.findUnique({
            where: { email: normalized },
            include: {
                roles: { include: { role: true } },
            },
        });
        if (!user || !user.active)
            return null;
        return {
            id: user.id,
            email: user.email,
            name: user.name,
            fullName: user.fullName ?? null,
            active: user.active,
            roles: user.roles.map((ur) => ur.role.name),
        };
    }
    /** Reautenticación puntual (p. ej. acciones destructivas en administración). */
    async validatePassword(userId, password) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { password: true, active: true },
        });
        if (!user?.active)
            return false;
        return bcrypt.compare(password, user.password);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);

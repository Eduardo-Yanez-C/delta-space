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
exports.InstallationsService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let InstallationsService = class InstallationsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async activate(dto) {
        const code = typeof dto.activationCode === "string" ? dto.activationCode.trim() : "";
        if (!code) {
            throw new common_1.BadRequestException("activationCode es obligatorio");
        }
        const activationCode = await this.prisma.activationCode.findUnique({
            where: { code },
        });
        if (!activationCode) {
            throw new common_1.BadRequestException("Código de activación no válido");
        }
        const activeCount = await this.prisma.installation.count({
            where: {
                activationCodeId: activationCode.id,
                active: true,
                revokedAt: null,
            },
        });
        if (activeCount >= activationCode.maxActivations) {
            throw new common_1.BadRequestException("Se ha alcanzado el número máximo de instalaciones para este código");
        }
        const installationToken = (0, crypto_1.randomBytes)(32).toString("hex");
        const deviceName = typeof dto.deviceName === "string" && dto.deviceName.trim() !== ""
            ? dto.deviceName.trim()
            : null;
        const appVersion = typeof dto.appVersion === "string" && dto.appVersion.trim() !== ""
            ? dto.appVersion.trim()
            : null;
        const machineFingerprint = typeof dto.machineFingerprint === "string" &&
            dto.machineFingerprint.trim() !== ""
            ? dto.machineFingerprint.trim()
            : null;
        const installation = await this.prisma.installation.create({
            data: {
                activationCodeId: activationCode.id,
                deviceName,
                machineFingerprint,
                appVersion,
                installationToken,
                active: true,
            },
        });
        return {
            installationId: installation.id,
            installationToken: installation.installationToken,
            deviceName: installation.deviceName,
            createdAt: installation.createdAt.toISOString(),
        };
    }
    async validate(installationId, installationToken) {
        const id = typeof installationId === "string" ? installationId.trim() : "";
        const token = typeof installationToken === "string" ? installationToken.trim() : "";
        if (!id || !token) {
            return {
                valid: false,
                active: false,
                revoked: true,
                message: "Faltan credenciales de instalación.",
            };
        }
        const installation = await this.prisma.installation.findUnique({
            where: { id },
        });
        if (!installation) {
            return {
                valid: false,
                active: false,
                revoked: true,
                message: "Instalación no encontrada.",
            };
        }
        if (installation.installationToken !== token) {
            return {
                valid: false,
                active: false,
                revoked: true,
                message: "Token de instalación no válido.",
            };
        }
        const revoked = installation.revokedAt != null;
        const active = installation.active && !revoked;
        const valid = active;
        return {
            valid,
            active: installation.active,
            revoked,
            message: valid
                ? undefined
                : "Esta instalación ya no es válida o fue revocada.",
        };
    }
    async findAll() {
        const list = await this.prisma.installation.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                deviceName: true,
                machineFingerprint: true,
                active: true,
                revokedAt: true,
                createdAt: true,
                appVersion: true,
                notes: true,
                activationCode: { select: { code: true } },
            },
        });
        return list.map((row) => ({
            id: row.id,
            activationCode: row.activationCode.code,
            deviceName: row.deviceName,
            machineFingerprint: row.machineFingerprint,
            active: row.active,
            revokedAt: row.revokedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            appVersion: row.appVersion,
            notes: row.notes,
        }));
    }
    async revoke(id, note) {
        const installation = await this.prisma.installation.findUnique({
            where: { id },
            include: { activationCode: { select: { code: true } } },
        });
        if (!installation) {
            throw new common_1.NotFoundException("Instalación no encontrada");
        }
        const revokeNote = note?.trim()
            ? installation.notes
                ? `${installation.notes}\n[Revocado] ${note}`
                : `[Revocado] ${note}`
            : installation.notes;
        const updated = await this.prisma.installation.update({
            where: { id },
            data: {
                active: false,
                revokedAt: new Date(),
                notes: revokeNote ?? undefined,
            },
            select: {
                id: true,
                deviceName: true,
                machineFingerprint: true,
                active: true,
                revokedAt: true,
                createdAt: true,
                appVersion: true,
                notes: true,
                activationCode: { select: { code: true } },
            },
        });
        return {
            id: updated.id,
            activationCode: updated.activationCode.code,
            deviceName: updated.deviceName,
            machineFingerprint: updated.machineFingerprint,
            active: updated.active,
            revokedAt: updated.revokedAt?.toISOString() ?? null,
            createdAt: updated.createdAt.toISOString(),
            appVersion: updated.appVersion,
            notes: updated.notes,
        };
    }
};
exports.InstallationsService = InstallationsService;
exports.InstallationsService = InstallationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InstallationsService);

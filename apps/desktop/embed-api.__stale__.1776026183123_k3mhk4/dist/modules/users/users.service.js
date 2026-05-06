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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcrypt"));
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const role_constants_1 = require("../auth/role-constants");
const SALT_ROUNDS = 10;
function toUserResponse(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        fullName: user.fullName ?? null,
        active: user.active,
        roles: user.roles.map((ur) => ur.role),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
}
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(activeOnly) {
        const where = activeOnly === true ? { active: true } : {};
        const users = await this.prisma.user.findMany({
            where,
            orderBy: { email: "asc" },
            include: {
                roles: { include: { role: true } },
            },
        });
        return users.map((u) => toUserResponse(u));
    }
    async findOne(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: {
                roles: { include: { role: true } },
            },
        });
        if (!user) {
            throw new common_1.NotFoundException(`Usuario con id ${id} no encontrado`);
        }
        return toUserResponse(user);
    }
    async getRoleNamesByIds(roleIds) {
        if (roleIds.length === 0) {
            return [];
        }
        const rows = await this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { name: true },
        });
        return rows.map((r) => r.name);
    }
    async assertRoleAssignmentAllowed(actor, roleIds) {
        if ((0, role_constants_1.canManageElevatedUsers)(actor.roles)) {
            return;
        }
        const names = await this.getRoleNamesByIds(roleIds);
        if ((0, role_constants_1.userRoleNamesHaveElevatedManagement)(names)) {
            throw new common_1.ForbiddenException("No puede asignar los roles de administrador o administrador desarrollador.");
        }
    }
    assertCanMutateUserRecord(actor, target) {
        if ((0, role_constants_1.canManageElevatedUsers)(actor.roles)) {
            return;
        }
        if (target.id === actor.id) {
            return;
        }
        const targetElevated = (0, role_constants_1.userRoleNamesHaveElevatedManagement)(target.roles.map((r) => r.name));
        if (targetElevated) {
            throw new common_1.ForbiddenException("No puede gestionar usuarios con rol de administrador o administrador desarrollador.");
        }
    }
    async validateRoleIds(roleIds) {
        if (roleIds.length === 0) {
            return;
        }
        const found = await this.prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { id: true },
        });
        const foundIds = new Set(found.map((r) => r.id));
        const missing = roleIds.filter((id) => !foundIds.has(id));
        if (missing.length > 0) {
            throw new common_1.BadRequestException(`Los siguientes IDs de rol no existen: ${missing.join(", ")}. Use GET /api/roles para listar roles válidos.`);
        }
    }
    async create(dto, actor) {
        const email = dto.email?.trim()?.toLowerCase();
        if (!email) {
            throw new common_1.BadRequestException("email es obligatorio");
        }
        if (!dto.password || typeof dto.password !== "string") {
            throw new common_1.BadRequestException("password es obligatorio");
        }
        if (dto.password.length < 6) {
            throw new common_1.BadRequestException("password debe tener al menos 6 caracteres");
        }
        const existing = await this.prisma.user.findUnique({
            where: { email },
        });
        if (existing) {
            throw new common_1.ConflictException("Ya existe un usuario con ese email");
        }
        const roleIds = dto.roleIds ?? [];
        await this.validateRoleIds(roleIds);
        await this.assertRoleAssignmentAllowed(actor, roleIds);
        const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
        const user = await this.prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name: dto.name?.trim() || null,
                fullName: dto.fullName?.trim() || null,
                active: dto.active ?? true,
            },
        });
        if (roleIds.length > 0) {
            await this.prisma.userRole.createMany({
                data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
            });
        }
        return this.findOne(user.id);
    }
    async update(id, dto, actor) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            include: { roles: { include: { role: true } } },
        });
        if (!user) {
            throw new common_1.NotFoundException(`Usuario con id ${id} no encontrado`);
        }
        const targetResponse = toUserResponse(user);
        this.assertCanMutateUserRecord(actor, targetResponse);
        if (dto.roleIds !== undefined) {
            await this.validateRoleIds(dto.roleIds);
            await this.assertRoleAssignmentAllowed(actor, dto.roleIds);
        }
        const scalarData = {};
        if (dto.name !== undefined) {
            scalarData.name = dto.name?.trim() || null;
        }
        if (dto.fullName !== undefined) {
            scalarData.fullName = dto.fullName?.trim() || null;
        }
        if (dto.active !== undefined) {
            scalarData.active = dto.active;
        }
        await this.prisma.$transaction(async (tx) => {
            if (Object.keys(scalarData).length > 0) {
                await tx.user.update({
                    where: { id },
                    data: scalarData,
                });
            }
            if (dto.roleIds !== undefined) {
                await tx.userRole.deleteMany({ where: { userId: id } });
                if (dto.roleIds.length > 0) {
                    await tx.userRole.createMany({
                        data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
                    });
                }
            }
        });
        return this.findOne(id);
    }
    async activate(id, actor) {
        const target = await this.findOne(id);
        this.assertCanMutateUserRecord(actor, target);
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException(`Usuario con id ${id} no encontrado`);
        }
        await this.prisma.user.update({
            where: { id },
            data: { active: true },
        });
        return this.findOne(id);
    }
    async deactivate(id, actor) {
        if (!(0, role_constants_1.isAdminDev)(actor.roles)) {
            throw new common_1.ForbiddenException("Solo el administrador desarrollador puede desactivar usuarios.");
        }
        const target = await this.findOne(id);
        this.assertCanMutateUserRecord(actor, target);
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new common_1.NotFoundException(`Usuario con id ${id} no encontrado`);
        }
        await this.prisma.user.update({
            where: { id },
            data: { active: false },
        });
        return this.findOne(id);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);

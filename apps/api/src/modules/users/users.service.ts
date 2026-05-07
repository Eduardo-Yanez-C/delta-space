import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import {
  canManageElevatedUsers,
  isAdminDev,
  userRoleNamesHaveElevatedManagement,
} from "../auth/role-constants";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import type { Role } from "@prisma/client";
import { normalizeSuiteNavGrantsInput, parseStoredSuiteNavGrants } from "../../common/suite-nav-grants";

const SALT_ROUNDS = 10;

export type UserResponse = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  roles: Role[];
  suiteNavGrants: string[] | null;
  /** null = sin límite mensual (UTC) para el asistente IA de suite. */
  suiteAgentMonthlyTokenLimit: number | null;
  createdAt: Date;
  updatedAt: Date;
};

function parseGrantsColumn(raw: string | null | undefined): string[] | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseStoredSuiteNavGrants(parsed);
  } catch {
    return null;
  }
}

function parseSuiteAgentMonthlyTokenLimit(raw: unknown): number | null {
  if (raw === null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new BadRequestException("suiteAgentMonthlyTokenLimit debe ser null o un entero >= 0");
  }
  return n;
}

function toUserResponse(user: {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  suiteNavGrants?: string | null;
  suiteAgentMonthlyTokenLimit?: number | null;
  roles: { role: Role }[];
}): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    fullName: user.fullName ?? null,
    active: user.active,
    roles: user.roles.map((ur) => ur.role),
    suiteNavGrants: parseGrantsColumn(user.suiteNavGrants),
    suiteAgentMonthlyTokenLimit:
      user.suiteAgentMonthlyTokenLimit === undefined || user.suiteAgentMonthlyTokenLimit === null
        ? null
        : user.suiteAgentMonthlyTokenLimit,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(activeOnly: boolean) {
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

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    return toUserResponse(user);
  }

  async getRoleNamesByIds(roleIds: number[]) {
    if (roleIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { name: true },
    });
    return rows.map((r) => r.name);
  }

  async assertRoleAssignmentAllowed(
    actor: AuthUserPayload,
    roleIds: number[],
  ) {
    if (canManageElevatedUsers(actor.roles)) {
      return;
    }
    const names = await this.getRoleNamesByIds(roleIds);
    if (userRoleNamesHaveElevatedManagement(names)) {
      throw new ForbiddenException(
        "No puede asignar los roles de administrador o administrador desarrollador.",
      );
    }
  }

  assertCanMutateUserRecord(actor: AuthUserPayload, target: UserResponse) {
    if (canManageElevatedUsers(actor.roles)) {
      return;
    }
    if (target.id === actor.id) {
      return;
    }
    const targetElevated = userRoleNamesHaveElevatedManagement(
      target.roles.map((r) => r.name),
    );
    if (targetElevated) {
      throw new ForbiddenException(
        "No puede gestionar usuarios con rol de administrador o administrador desarrollador.",
      );
    }
  }

  async validateRoleIds(roleIds: number[]) {
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
      throw new BadRequestException(
        `Los siguientes IDs de rol no existen: ${missing.join(", ")}. Use GET /api/roles para listar roles válidos.`,
      );
    }
  }

  async create(dto: CreateUserDto, actor: AuthUserPayload) {
    const email = dto.email?.trim()?.toLowerCase();
    if (!email) {
      throw new BadRequestException("email es obligatorio");
    }
    if (!dto.password || typeof dto.password !== "string") {
      throw new BadRequestException("password es obligatorio");
    }
    if (dto.password.length < 6) {
      throw new BadRequestException("password debe tener al menos 6 caracteres");
    }
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException("Ya existe un usuario con ese email");
    }
    const roleIds = dto.roleIds ?? [];
    await this.validateRoleIds(roleIds);
    await this.assertRoleAssignmentAllowed(actor, roleIds);
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const grantsPayload: { suiteNavGrants?: string | null } = {};
    if (dto.suiteNavGrants !== undefined) {
      const n =
        dto.suiteNavGrants === null ? null : normalizeSuiteNavGrantsInput(dto.suiteNavGrants);
      grantsPayload.suiteNavGrants = n === null ? null : JSON.stringify(n);
    }
    const limitPayload: { suiteAgentMonthlyTokenLimit?: number | null } = {};
    if (dto.suiteAgentMonthlyTokenLimit !== undefined) {
      limitPayload.suiteAgentMonthlyTokenLimit = parseSuiteAgentMonthlyTokenLimit(dto.suiteAgentMonthlyTokenLimit);
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: dto.name?.trim() || null,
        fullName: dto.fullName?.trim() || null,
        active: dto.active ?? true,
        ...grantsPayload,
        ...limitPayload,
      },
    });
    if (roleIds.length > 0) {
      await this.prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
      });
    }
    return this.findOne(user.id);
  }

  async update(id: string, dto: UpdateUserDto, actor: AuthUserPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    const targetResponse = toUserResponse(user);
    this.assertCanMutateUserRecord(actor, targetResponse);
    if (dto.roleIds !== undefined) {
      await this.validateRoleIds(dto.roleIds);
      await this.assertRoleAssignmentAllowed(actor, dto.roleIds);
    }
    const scalarData: {
      name?: string | null;
      fullName?: string | null;
      active?: boolean;
      suiteNavGrants?: string | null;
      suiteAgentMonthlyTokenLimit?: number | null;
    } = {};
    if (dto.name !== undefined) {
      scalarData.name = dto.name?.trim() || null;
    }
    if (dto.fullName !== undefined) {
      scalarData.fullName = dto.fullName?.trim() || null;
    }
    if (dto.active !== undefined) {
      scalarData.active = dto.active;
    }
    if (dto.suiteNavGrants !== undefined) {
      const n =
        dto.suiteNavGrants === null ? null : normalizeSuiteNavGrantsInput(dto.suiteNavGrants);
      scalarData.suiteNavGrants = n === null ? null : JSON.stringify(n);
    }
    if (dto.suiteAgentMonthlyTokenLimit !== undefined) {
      scalarData.suiteAgentMonthlyTokenLimit = parseSuiteAgentMonthlyTokenLimit(dto.suiteAgentMonthlyTokenLimit);
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

  async resetPassword(id: string, newPassword: string, actor: AuthUserPayload) {
    const pwd = (newPassword ?? "").trim();
    if (!pwd) throw new BadRequestException("password es obligatorio");
    if (pwd.length < 6) {
      throw new BadRequestException("password debe tener al menos 6 caracteres");
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    const targetResponse = toUserResponse(user);
    this.assertCanMutateUserRecord(actor, targetResponse);

    // Seguridad: para evitar lockout, solo ADMIN_DEV puede resetear su propia contraseña desde aquí.
    if (actor.id === id && !isAdminDev(actor.roles)) {
      throw new ForbiddenException("Solo ADMIN_DEV puede restablecer su propia contraseña desde este panel.");
    }

    const hashedPassword = await bcrypt.hash(pwd, SALT_ROUNDS);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    });
    return { ok: true };
  }

  async activate(id: string, actor: AuthUserPayload) {
    const target = await this.findOne(id);
    this.assertCanMutateUserRecord(actor, target);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    await this.prisma.user.update({
      where: { id },
      data: { active: true },
    });
    return this.findOne(id);
  }

  async deactivate(id: string, actor: AuthUserPayload) {
    if (!isAdminDev(actor.roles)) {
      throw new ForbiddenException(
        "Solo el administrador desarrollador puede desactivar usuarios.",
      );
    }
    const target = await this.findOne(id);
    this.assertCanMutateUserRecord(actor, target);
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Usuario con id ${id} no encontrado`);
    }
    await this.prisma.user.update({
      where: { id },
      data: { active: false },
    });
    return this.findOne(id);
  }
}

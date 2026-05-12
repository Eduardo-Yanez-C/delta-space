import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import type { AuthUserPayload } from "../auth/auth.service";
import {
  canManageElevatedUsers,
  isAdminDev,
  userRoleNamesHaveElevatedManagement,
} from "../auth/role-constants";
import type { CreateUserDto } from "./dto/create-user.dto";
import type { UpdateUserDto } from "./dto/update-user.dto";
import { Prisma, type Role } from "@prisma/client";
import { normalizeSuiteNavGrantsInput, parseStoredSuiteNavGrants } from "../../common/suite-nav-grants";

const SALT_ROUNDS = 10;

export type UserResponse = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  companyId: string;
  roles: Role[];
  suiteNavGrants: string[] | null;
  /** null = sin límite mensual (UTC) para el asistente IA de suite. */
  suiteAgentMonthlyTokenLimit: number | null;
  /** null = licencia sin fecha de fin (acceso mientras esté activo). */
  accessExpiresAt: string | null;
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
  /** Columna Prisma `Int` = PostgreSQL INTEGER (signed 32 bits). */
  const PG_INT_MAX = 2_147_483_647;
  if (n > PG_INT_MAX) {
    throw new BadRequestException(
      `suiteAgentMonthlyTokenLimit no puede superar ${PG_INT_MAX} (límite de base de datos).`,
    );
  }
  return n;
}

/** undefined = no cambiar; null = quitar caducidad; Date = fin de licencia. */
function parseAccessExpiresAtInput(raw: unknown): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const s = typeof raw === "string" ? raw.trim() : String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) {
    throw new BadRequestException("La fecha de fin de licencia no es válida.");
  }
  return d;
}

function toUserResponse(user: {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
  suiteNavGrants?: string | null;
  suiteAgentMonthlyTokenLimit?: number | null;
  accessExpiresAt?: Date | null;
  roles: { role: Role | null }[];
}): UserResponse {
  const roles: Role[] = [];
  for (const ur of user.roles) {
    if (!ur?.role) continue;
    roles.push({
      id: ur.role.id,
      name: ur.role.name,
      description: ur.role.description ?? null,
    });
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    fullName: user.fullName ?? null,
    active: user.active,
    companyId: user.companyId,
    roles,
    suiteNavGrants: parseGrantsColumn(user.suiteNavGrants),
    suiteAgentMonthlyTokenLimit:
      user.suiteAgentMonthlyTokenLimit === undefined || user.suiteAgentMonthlyTokenLimit === null
        ? null
        : user.suiteAgentMonthlyTokenLimit,
    accessExpiresAt: user.accessExpiresAt ? new Date(user.accessExpiresAt).toISOString() : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

/** Enteros de rol positivos, sin duplicados (evita P2002 en UserRole al guardar). */
function sanitizeRoleIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isInteger(n) || n < 1) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

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

  /**
   * Usuarios de la misma empresa (para vendedor responsable, filtros de cotización, PMO, etc.).
   * No expone el listado global de administración (`findAll`).
   */
  async findAssignableForSales(activeOnly: boolean, actor: AuthUserPayload) {
    const where = {
      companyId: actor.companyId,
      ...(activeOnly === true ? { active: true } : {}),
    };
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

  async validateRoleIds(roleIds: unknown) {
    const clean = sanitizeRoleIds(roleIds);
    if (clean.length === 0) {
      return;
    }
    const found = await this.prisma.role.findMany({
      where: { id: { in: clean } },
      select: { id: true },
    });
    const foundIds = new Set(found.map((r) => r.id));
    const missing = clean.filter((id) => !foundIds.has(id));
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
    const roleIds = sanitizeRoleIds(dto.roleIds ?? []);
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
    const expPayload: { accessExpiresAt?: Date | null } = {};
    if (dto.accessExpiresAt !== undefined) {
      expPayload.accessExpiresAt = parseAccessExpiresAtInput(dto.accessExpiresAt);
    }
    const companyId = (dto.companyId ?? actor.companyId ?? "").trim();
    if (!companyId) {
      throw new BadRequestException("companyId es obligatorio");
    }
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      throw new BadRequestException("companyId inválido");
    }
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: dto.name?.trim() || null,
        fullName: dto.fullName?.trim() || null,
        active: dto.active ?? true,
        companyId,
        ...grantsPayload,
        ...limitPayload,
        ...expPayload,
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
    let sanitizedRoleIds: number[] | undefined;
    if (dto.roleIds !== undefined) {
      sanitizedRoleIds = sanitizeRoleIds(dto.roleIds);
      await this.validateRoleIds(sanitizedRoleIds);
      await this.assertRoleAssignmentAllowed(actor, sanitizedRoleIds);
    }
    const scalarData: {
      name?: string | null;
      fullName?: string | null;
      active?: boolean;
      suiteNavGrants?: string | null;
      suiteAgentMonthlyTokenLimit?: number | null;
      accessExpiresAt?: Date | null;
      companyId?: string;
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
    if (dto.accessExpiresAt !== undefined) {
      scalarData.accessExpiresAt = parseAccessExpiresAtInput(dto.accessExpiresAt);
    }
    if (dto.companyId !== undefined) {
      const companyId = String(dto.companyId ?? "").trim();
      if (!companyId) {
        throw new BadRequestException("companyId no puede ser vacío");
      }
      const company = await this.prisma.company.findUnique({ where: { id: companyId } });
      if (!company) {
        throw new BadRequestException("companyId inválido");
      }
      scalarData.companyId = companyId;
    }
    try {
      // Prisma interactive tx default timeout is 5000 ms; Supabase/Railway latency often exceeds that here → 500.
      await this.prisma.$transaction(
        async (tx) => {
          if (Object.keys(scalarData).length > 0) {
            await tx.user.update({
              where: { id },
              data: scalarData,
            });
          }
          if (sanitizedRoleIds !== undefined) {
            await tx.userRole.deleteMany({ where: { userId: id } });
            if (sanitizedRoleIds.length > 0) {
              await tx.userRole.createMany({
                data: sanitizedRoleIds.map((roleId) => ({ userId: id, roleId })),
              });
            }
          }
        },
        { maxWait: 15_000, timeout: 30_000 },
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        this.logger.error(`[update user ${id}] Prisma ${e.code}: ${e.message}`, e.stack);
        throw new BadRequestException(
          `No se pudo guardar el usuario (${e.code}). ${e.message}`,
        );
      }
      if (e instanceof Prisma.PrismaClientValidationError) {
        this.logger.error(`[update user ${id}] Prisma validation: ${e.message}`, e.stack);
        throw new BadRequestException(`Datos inválidos para la base de datos: ${e.message}`);
      }
      this.logger.error(`[update user ${id}] error inesperado`, e instanceof Error ? e.stack : e);
      throw e;
    }
    const after = await this.findOne(id);
    try {
      await this.audit.write(actor, {
        action: "UPDATE",
        entityType: "User",
        entityId: id,
        entityCompanyId: after.companyId,
        before: targetResponse,
        after,
        meta: {
          changed: Object.keys(scalarData),
          roleIds: sanitizedRoleIds,
        },
      });
    } catch (e) {
      this.logger.warn(
        `AuditLog omitido tras actualizar usuario ${id}: ${e instanceof Error ? e.message : e}`,
      );
    }
    return after;
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

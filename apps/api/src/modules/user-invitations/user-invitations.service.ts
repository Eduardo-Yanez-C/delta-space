import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import type { CreateUserInvitationDto } from "./dto/create-user-invitation.dto";
import type { AcceptUserInvitationDto } from "./dto/accept-user-invitation.dto";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function randomToken(): string {
  // URL-safe enough for query param (base64url available in node 20+; fallback custom).
  return crypto.randomBytes(32).toString("hex");
}

function parseExpiresAt(expiresAtRaw: unknown): Date {
  if (expiresAtRaw === null || expiresAtRaw === undefined || expiresAtRaw === "") {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }
  const d = new Date(String(expiresAtRaw));
  if (Number.isNaN(d.getTime())) throw new BadRequestException("expiresAt inválido (ISO 8601)");
  return d;
}

function parseRoleIdsJson(roleIds: unknown): string | null {
  if (roleIds === undefined) return null;
  if (roleIds === null) return "[]";
  if (!Array.isArray(roleIds)) throw new BadRequestException("roleIds debe ser un array de números");
  const ids = roleIds.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);
  return JSON.stringify(ids);
}

@Injectable()
export class UserInvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(actor: AuthUserPayload) {
    // Solo admin: lista global, pero ordenada por reciente.
    return this.prisma.userInvitation.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, email: true, name: true, fullName: true } },
        acceptedBy: { select: { id: true, email: true, name: true, fullName: true } },
      },
    });
  }

  async create(actor: AuthUserPayload, dto: CreateUserInvitationDto) {
    const email = String(dto.email ?? "").trim().toLowerCase();
    if (!email) throw new BadRequestException("email es obligatorio");
    const companyId = String(dto.companyId ?? "").trim();
    if (!companyId) throw new BadRequestException("companyId es obligatorio");

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new BadRequestException("companyId inválido");

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) throw new ConflictException("Ya existe un usuario con ese email");

    const expiresAt = parseExpiresAt(dto.expiresAt);
    if (expiresAt.getTime() <= Date.now()) throw new BadRequestException("expiresAt debe ser futuro");

    // roles
    const roleIdsJson = parseRoleIdsJson(dto.roleIds);
    if (dto.roleIds !== undefined) {
      const ids = JSON.parse(roleIdsJson ?? "[]") as number[];
      if (ids.length > 0) {
        const count = await this.prisma.role.count({ where: { id: { in: ids } } });
        if (count !== ids.length) throw new BadRequestException("roleIds contiene IDs inválidos");
      }
    }

    const token = randomToken();
    const tokenHash = sha256Hex(token);

    const row = await this.prisma.userInvitation.create({
      data: {
        companyId,
        email,
        tokenHash,
        roleIdsJson,
        nameHint: dto.nameHint ?? null,
        fullNameHint: dto.fullNameHint ?? null,
        active: true,
        expiresAt,
        createdByUserId: actor.id,
      },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, email: true, name: true, fullName: true } },
      },
    });

    await this.audit.write(actor, {
      action: "CREATE",
      entityType: "UserInvitation",
      entityId: row.id,
      entityCompanyId: companyId,
      after: { ...row, tokenHash: "***" },
      meta: { email, companyId },
    });

    return { invitation: row, token };
  }

  async accept(dto: AcceptUserInvitationDto) {
    const token = String(dto.token ?? "").trim();
    const password = String(dto.password ?? "").trim();
    if (!token) throw new BadRequestException("token es obligatorio");
    if (!password) throw new BadRequestException("password es obligatorio");
    if (password.length < 6) throw new BadRequestException("password debe tener al menos 6 caracteres");

    const tokenHash = sha256Hex(token);
    const inv = await this.prisma.userInvitation.findUnique({
      where: { tokenHash },
      include: { company: true },
    });
    if (!inv) throw new NotFoundException("Invitación no encontrada");
    if (!inv.active) throw new BadRequestException("Invitación inactiva");
    if (inv.acceptedAt) throw new BadRequestException("Invitación ya fue aceptada");
    if (inv.expiresAt.getTime() <= Date.now()) throw new BadRequestException("Invitación expirada");

    const existingUser = await this.prisma.user.findUnique({ where: { email: inv.email } });
    if (existingUser) throw new ConflictException("Ya existe un usuario con ese email");

    const roleIds = (() => {
      if (!inv.roleIdsJson) return [];
      try {
        const v = JSON.parse(inv.roleIdsJson);
        return Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0) : [];
      } catch {
        return [];
      }
    })();

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const name = dto.name === undefined ? null : dto.name?.trim() || null;
    const fullName = dto.fullName === undefined ? null : dto.fullName?.trim() || null;

    const created = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: inv.email,
          password: hashedPassword,
          name: name ?? inv.nameHint ?? null,
          fullName: fullName ?? inv.fullNameHint ?? null,
          active: true,
          companyId: inv.companyId,
        },
      });
      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: roleIds.map((roleId) => ({ userId: user.id, roleId })),
        });
      }
      await tx.userInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date(), acceptedByUserId: user.id, active: false },
      });
      return user;
    });

    // no audit actor available (public endpoint). Use created user as actor for now (company-level trace).
    await this.prisma.auditLog.create({
      data: {
        companyId: created.companyId,
        userId: created.id,
        action: "ACCEPT_INVITATION",
        entityType: "UserInvitation",
        entityId: inv.id,
        entityCompanyId: inv.companyId,
        beforeJson: null,
        afterJson: JSON.stringify({ email: inv.email, companyId: inv.companyId }),
        metaJson: JSON.stringify({ via: "public_accept" }),
      },
    });

    return { ok: true };
  }
}


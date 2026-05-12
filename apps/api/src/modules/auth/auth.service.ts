import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { parseStoredSuiteNavGrants } from "../../common/suite-nav-grants";
import { AuditLogService } from "../audit-log/audit-log.service";

const LICENSE_EXPIRED_MESSAGE =
  "Su licencia de acceso ha finalizado. Contacte al administrador para renovarla.";

/** Evita TypeError si hay filas `UserRole` huérfanas (rol borrado o FK rota). */
function roleNamesFromInclude(roles: { role: { name: string } | null }[] | undefined): string[] {
  if (!roles?.length) return [];
  const out: string[] = [];
  for (const ur of roles) {
    if (ur.role) out.push(ur.role.name);
  }
  return out;
}

export function isUserAccessExpired(accessExpiresAt: Date | null | undefined): boolean {
  if (accessExpiresAt == null) return false;
  return Date.now() > new Date(accessExpiresAt).getTime();
}

export type AuthUserPayload = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  companyId: string;
  roles: string[];
  /** null = menú suite sin restricción explícita (legacy). */
  suiteNavGrants: string[] | null;
  /** Si existe, el usuario actual está siendo impersonado por este actor. */
  impersonatedBy?: { id: string; email: string } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditLogService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    if (!user.active) {
      throw new UnauthorizedException("Usuario inactivo. Contacte al administrador.");
    }
    if (isUserAccessExpired(user.accessExpiresAt)) {
      throw new UnauthorizedException(LICENSE_EXPIRED_MESSAGE);
    }
    // Registrar último login exitoso (no crítico).
    this.prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(() => null);
    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      fullName: user.fullName ?? null,
      active: user.active,
      companyId: user.companyId,
      roles: roleNamesFromInclude(user.roles),
      suiteNavGrants: (() => {
        const raw = (user as { suiteNavGrants?: string | null }).suiteNavGrants;
        if (raw == null || raw === "") return null;
        try {
          return parseStoredSuiteNavGrants(JSON.parse(raw));
        } catch {
          return null;
        }
      })(),
    };
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email.trim().toLowerCase() },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
    );
    return { accessToken, user: payload };
  }

  async validateUserById(userId: string, impersonatedByUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user || !user.active) return null;
    if (isUserAccessExpired(user.accessExpiresAt)) {
      throw new UnauthorizedException(LICENSE_EXPIRED_MESSAGE);
    }
    const base = {
      id: user.id,
      email: user.email,
      name: user.name,
      fullName: user.fullName ?? null,
      active: user.active,
      companyId: user.companyId,
      roles: roleNamesFromInclude(user.roles),
      suiteNavGrants: (() => {
        const raw = (user as { suiteNavGrants?: string | null }).suiteNavGrants;
        if (raw == null || raw === "") return null;
        try {
          return parseStoredSuiteNavGrants(JSON.parse(raw));
        } catch {
          return null;
        }
      })(),
    } satisfies Omit<AuthUserPayload, "impersonatedBy">;
    if (!impersonatedByUserId) return base;
    const imp = await this.prisma.user.findUnique({
      where: { id: impersonatedByUserId },
      select: { id: true, email: true, active: true },
    });
    return {
      ...base,
      impersonatedBy: imp?.active ? { id: imp.id, email: imp.email } : null,
    };
  }

  /** Misma forma que `validateUserById` (p. ej. socket local con JWT emitido en otro nodo, distinto `sub`). */
  async validateUserByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user || !user.active) return null;
    if (isUserAccessExpired(user.accessExpiresAt)) {
      throw new UnauthorizedException(LICENSE_EXPIRED_MESSAGE);
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      fullName: user.fullName ?? null,
      active: user.active,
      companyId: user.companyId,
      roles: roleNamesFromInclude(user.roles),
      suiteNavGrants: (() => {
        const raw = (user as { suiteNavGrants?: string | null }).suiteNavGrants;
        if (raw == null || raw === "") return null;
        try {
          return parseStoredSuiteNavGrants(JSON.parse(raw));
        } catch {
          return null;
        }
      })(),
    };
  }

  /** Reautenticación puntual (p. ej. acciones destructivas en administración). */
  async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, active: true },
    });
    if (!user?.active) return false;
    return bcrypt.compare(password, user.password);
  }

  async impersonate(actor: AuthUserPayload, targetUserId: string) {
    if (!actor.roles.includes("ADMIN_DEV")) {
      throw new UnauthorizedException("Solo ADMIN_DEV puede impersonar usuarios.");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      include: { roles: { include: { role: true } } },
    });
    if (!target || !target.active) {
      throw new UnauthorizedException("Usuario destino inactivo o no encontrado.");
    }
    if (isUserAccessExpired(target.accessExpiresAt)) {
      throw new UnauthorizedException(LICENSE_EXPIRED_MESSAGE);
    }

    const accessToken = this.jwtService.sign(
      { sub: target.id, imp_by: actor.id, email: target.email.trim().toLowerCase() },
      { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
    );

    const user = await this.validateUserById(target.id, actor.id);
    if (!user) throw new UnauthorizedException("Usuario destino no disponible");
    await this.audit.write(actor, {
      action: "LOGIN_AS",
      entityType: "User",
      entityId: target.id,
      entityCompanyId: target.companyId,
      meta: { targetEmail: target.email },
    });
    return { accessToken, user };
  }
}

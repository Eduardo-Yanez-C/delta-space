import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { parseStoredSuiteNavGrants } from "../../common/suite-nav-grants";

export type AuthUserPayload = {
  id: string;
  email: string;
  name: string | null;
  fullName: string | null;
  active: boolean;
  roles: string[];
  /** null = menú suite sin restricción explícita (legacy). */
  suiteNavGrants: string[] | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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
    if (!user.active) {
      throw new UnauthorizedException("Usuario inactivo. Contacte al administrador.");
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException("Credenciales inválidas");
    }
    const payload: AuthUserPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      fullName: user.fullName ?? null,
      active: user.active,
      roles: user.roles.map((ur) => ur.role.name),
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

  async validateUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user || !user.active) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      fullName: user.fullName ?? null,
      active: user.active,
      roles: user.roles.map((ur) => ur.role.name),
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
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      fullName: user.fullName ?? null,
      active: user.active,
      roles: user.roles.map((ur) => ur.role.name),
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
}

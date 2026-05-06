import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { AuthService } from "../auth/auth.service";
import { ROLE_ADMIN_DEV } from "../auth/role-constants";
import type { RequestDesktopDeveloperLicenseDto } from "./dto/request-desktop-developer-license.dto";

const LICENSE_ID_PATTERN = /^LIC-[A-Za-z0-9][A-Za-z0-9._-]*$/;

function canonicalStringify(obj: Record<string, unknown>) {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

function signPayload(secret: string, payload: Record<string, unknown>) {
  return crypto
    .createHmac("sha256", secret)
    .update(canonicalStringify(payload))
    .digest("hex");
}

function validUntilAfterCalendarDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

@Injectable()
export class DesktopDeveloperLicenseService {
  private readonly logger = new Logger(DesktopDeveloperLicenseService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async issueSignedRecord(dto: RequestDesktopDeveloperLicenseDto) {
    const secret = (this.config.get<string>("LICENSE_HMAC_SECRET") ?? "").trim();
    if (!secret) {
      this.logger.error(
        "LICENSE_HMAC_SECRET no configurado; no se puede firmar licencia de escritorio.",
      );
      throw new ServiceUnavailableException(
        "Emisor de licencias no configurado en el servidor (falta LICENSE_HMAC_SECRET).",
      );
    }
    let user: { email: string; roles: string[] };
    try {
      const out = await this.auth.login(
        dto.email.trim().toLowerCase(),
        dto.password,
      );
      user = out.user;
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      this.logger.warn(`Login desarrollador licencia: ${String(e)}`);
      throw new UnauthorizedException("Credenciales inválidas");
    }
    if (!user.roles?.includes(ROLE_ADMIN_DEV)) {
      throw new ForbiddenException(
        "Solo cuentas ADMIN_DEV pueden emitir licencia temporal de escritorio.",
      );
    }
    const serverMax = Math.min(
      90,
      Math.max(
        1,
        parseInt(
          this.config.get<string>("DESKTOP_DEV_LICENSE_MAX_DAYS") ?? "30",
          10,
        ) || 30,
      ),
    );
    const days = Math.min(dto.requestedDays, serverMax);
    const licenseId = `LIC-DEV-${Date.now()}`;
    if (!LICENSE_ID_PATTERN.test(licenseId)) {
      throw new Error("licenseId interno inválido");
    }
    const payload: Record<string, unknown> = {
      v: 1,
      kind: "renewal",
      licenseId,
      licenseType: "INTERNAL",
      installationId: dto.installationId.trim(),
      validUntil: validUntilAfterCalendarDays(days),
      issuedAt: new Date().toISOString(),
      issuedTo: user.email,
      note: "desktop-developer-api",
    };
    const sig = signPayload(secret, payload);
    this.logger.log(
      `Licencia temporal escritorio ${licenseId} · ${days}d · inst=${dto.installationId.slice(0, 8)}…`,
    );
    return { payload, sig };
  }
}

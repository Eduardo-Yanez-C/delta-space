import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import {
  DEFAULT_ON_PREMISE_SUBDIR,
  INSTALLATION_FILE,
  LICENSE_FILE,
} from "./on-premise-license.constants";

type LicenseState =
  | "DISABLED"
  | "PUBLIC_KEY_NOT_CONFIGURED"
  | "MISSING"
  | "EXPIRED"
  | "INVALID"
  | "INSTALLATION_MISMATCH"
  | "OK";

export type OnPremiseLicenseStatus = {
  installationId: string;
  state: LicenseState;
  expiresAt: string | null;
  empresa: unknown;
  modalidad: unknown;
  message: string;
};

function isOnPremiseModalidad(m: unknown): boolean {
  if (m == null || typeof m !== "string") {
    return false;
  }
  const n = m.trim().toUpperCase().replace(/-/g, "_");
  return n === "ON_PREMISE";
}

function parseLicenseEnforcementEnabled(raw: string | undefined): boolean {
  if (raw == null || raw.trim() === "") {
    return false;
  }
  const v = raw.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function asRecord(p: JwtPayload | string | null): Record<string, unknown> | null {
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return p as Record<string, unknown>;
  }
  return null;
}

@Injectable()
export class OnPremiseLicenseService {
  private readonly logger = new Logger(OnPremiseLicenseService.name);
  private cacheTtlMs = 60000;
  private statusCache: { status: OnPremiseLicenseStatus; savedAt: number } | null =
    null;

  constructor(private readonly config: ConfigService) {}

  isLicenseEnforcementEnabled(): boolean {
    return parseLicenseEnforcementEnabled(
      this.config.get<string>("ON_PREMISE_LICENSE_ENABLED"),
    );
  }

  invalidateStatusCache() {
    this.statusCache = null;
  }

  getDataDir(): string {
    const fromEnv = this.config.get<string>("ON_PREMISE_DATA_DIR");
    if (fromEnv && fromEnv.trim().length > 0) {
      return path.resolve(fromEnv.trim());
    }
    return path.join(process.cwd(), ...DEFAULT_ON_PREMISE_SUBDIR);
  }

  installationPath(): string {
    return path.join(this.getDataDir(), INSTALLATION_FILE);
  }

  licensePath(): string {
    return path.join(this.getDataDir(), LICENSE_FILE);
  }

  ensureInstallationId(): string {
    const dir = this.getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const p = this.installationPath();
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        const j = JSON.parse(raw) as { installationId?: string };
        if (j.installationId && typeof j.installationId === "string") {
          return j.installationId;
        }
      } catch (e) {
        this.logger.warn(`installation.json corrupto o ilegible: ${String(e)}`);
      }
    }
    const installationId = crypto.randomUUID();
    fs.writeFileSync(p, JSON.stringify({ installationId }, null, 2), "utf8");
    this.invalidateStatusCache();
    this.logger.log(`Nuevo installationId generado en ${p}`);
    return installationId;
  }

  getPublicKeyPem(): string | null {
    const inline = this.config.get<string>("LICENSE_PUBLIC_KEY_PEM");
    if (inline && inline.trim().length > 0) {
      return inline.replace(/\\n/g, "\n").trim();
    }
    const keyPath = this.config.get<string>("LICENSE_PUBLIC_KEY_PATH");
    if (keyPath && keyPath.trim().length > 0) {
      const resolved = path.resolve(keyPath.trim());
      if (fs.existsSync(resolved)) {
        return fs.readFileSync(resolved, "utf8").trim();
      }
      this.logger.warn(`LICENSE_PUBLIC_KEY_PATH no encontrado: ${resolved}`);
    }
    return null;
  }

  readLicenseRaw(): string | null {
    const p = this.licensePath();
    if (!fs.existsSync(p)) {
      return null;
    }
    try {
      return fs.readFileSync(p, "utf8").trim();
    } catch {
      return null;
    }
  }

  decodePayloadUnverified(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split(".");
      if (parts.length < 2) {
        return null;
      }
      const payload = Buffer.from(parts[1], "base64url").toString("utf8");
      return JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  verifyAndDecode(
    token: string,
  ): { ok: true; payload: JwtPayload } | { ok: false; error: string } {
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
    } catch (err) {
      const name =
        err && typeof err === "object" && "name" in err
          ? String((err as { name: string }).name)
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

  verifyIgnoreExpiration(
    token: string,
    pem: string,
  ): JwtPayload | string | null {
    try {
      return jwt.verify(token, pem, {
        algorithms: ["RS256"],
        ignoreExpiration: true,
      });
    } catch {
      return null;
    }
  }

  getStatus(): OnPremiseLicenseStatus {
    const now = Date.now();
    if (
      this.statusCache &&
      now - this.statusCache.savedAt < this.cacheTtlMs
    ) {
      return this.statusCache.status;
    }
    const status = this.computeStatus();
    this.statusCache = { status, savedAt: now };
    return status;
  }

  computeStatus(): OnPremiseLicenseStatus {
    const installationId = this.ensureInstallationId();
    if (!this.isLicenseEnforcementEnabled()) {
      return {
        installationId,
        state: "DISABLED",
        expiresAt: null,
        empresa: null,
        modalidad: null,
        message:
          "Comprobación de licencia on-premise desactivada. Establezca ON_PREMISE_LICENSE_ENABLED=true para exigir licencia en todas las rutas.",
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
        message:
          "Configure LICENSE_PUBLIC_KEY_PEM o LICENSE_PUBLIC_KEY_PATH para validar la licencia.",
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
        empresa: (payload as Record<string, unknown>).empresa ?? null,
        modalidad: (payload as Record<string, unknown>).modalidad ?? null,
        message:
          "El installationId de la licencia no coincide con este servidor.",
      };
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp != null && payload.exp < now) {
      return {
        installationId,
        state: "EXPIRED",
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        empresa: (payload as Record<string, unknown>).empresa ?? null,
        modalidad: (payload as Record<string, unknown>).modalidad ?? null,
        message: "La licencia ha expirado.",
      };
    }
    const modalidad = (payload as Record<string, unknown>).modalidad;
    if (!isOnPremiseModalidad(modalidad)) {
      return {
        installationId,
        state: "INVALID",
        expiresAt: payload.exp
          ? new Date(payload.exp * 1000).toISOString()
          : null,
        empresa: (payload as Record<string, unknown>).empresa ?? null,
        modalidad,
        message:
          'La licencia debe incluir claim modalidad compatible con ON_PREMISE (p. ej. "ON_PREMISE").',
      };
    }
    return {
      installationId,
      state: "OK",
      expiresAt: payload.exp
        ? new Date(payload.exp * 1000).toISOString()
        : null,
      empresa: (payload as Record<string, unknown>).empresa ?? null,
      modalidad,
      message: "Licencia válida.",
    };
  }

  isLicenseOk(): boolean {
    if (!this.isLicenseEnforcementEnabled()) {
      return true;
    }
    return this.getStatus().state === "OK";
  }

  saveLicenseToken(
    token: string,
  ): { ok: true } | { ok: false; message: string } {
    const trimmed = token.trim();
    if (!trimmed) {
      return { ok: false, message: "Token vacío." };
    }
    const pem = this.getPublicKeyPem();
    if (!pem) {
      return {
        ok: false,
        message:
          "Configure LICENSE_PUBLIC_KEY_PEM o LICENSE_PUBLIC_KEY_PATH antes de subir la licencia.",
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
    const modalidad = (verify.payload as Record<string, unknown>).modalidad;
    if (!isOnPremiseModalidad(modalidad)) {
      return {
        ok: false,
        message:
          'El claim modalidad debe ser compatible con ON_PREMISE (p. ej. "ON_PREMISE").',
      };
    }
    const now = Math.floor(Date.now() / 1000);
    if (
      verify.payload.exp != null &&
      verify.payload.exp < now
    ) {
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
}

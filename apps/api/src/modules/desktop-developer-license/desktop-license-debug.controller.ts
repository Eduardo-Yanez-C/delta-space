import { Controller, Get, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

/** Misma secuencia que ConfigModule (app.module): env.embedded → .env por archivo. */
function mergedEnvFromFiles(cwd: string): Record<string, string> {
  let config: Record<string, string> = {};
  for (const name of ["env.embedded", ".env"]) {
    const p = path.join(cwd, name);
    if (!fs.existsSync(p)) continue;
    try {
      const parsed = dotenv.parse(fs.readFileSync(p, "utf8"));
      config = Object.assign(parsed, config);
    } catch {
      /* ignore */
    }
  }
  return config;
}

@Controller("v1/desktop-license-debug")
export class DesktopLicenseDebugController {
  constructor(private readonly config: ConfigService) {}

  @Get("diag")
  diag() {
    const fileMerged = mergedEnvFromFiles(process.cwd());
    const allowPackaged = process.env.EMBEDDED_PACKAGED_DESKTOP === "1";
    const diagRaw = process.env.DESKTOP_LICENSE_DIAG_ALLOW;
    const diagFromProcess =
      diagRaw !== undefined && String(diagRaw).trim() !== ""
        ? String(diagRaw).trim()
        : undefined;
    const allowLocalLab =
      diagFromProcess === "1" ||
      (diagFromProcess === undefined && fileMerged.DESKTOP_LICENSE_DIAG_ALLOW === "1");
    if (!allowPackaged && !allowLocalLab) {
      throw new NotFoundException();
    }
    const cwd = process.cwd();
    const dotEnvPath = path.join(cwd, ".env");
    const envEmbeddedPath = path.join(cwd, "env.embedded");
    const secret = (this.config.get<string>("LICENSE_HMAC_SECRET") ?? "").trim();
    const fp =
      secret.length > 0
        ? crypto
            .createHash("sha256")
            .update(secret, "utf8")
            .digest("hex")
            .slice(0, 16)
        : "empty";
    const placeholder =
      /PVQ-DESKTOP-LICENSE-CHANGE-ME-IN-CI$/i.test(secret) ||
      /MISMO_SECRETO_QUE_BUILD|CHANGE-ME-IN-CI|PVQ-DESKTOP-LICENSE-CHANGE-ME/i.test(
        secret,
      );
    return {
      role: "nest-embedded",
      cwd,
      dotEnvPath,
      dotEnvExists: fs.existsSync(dotEnvPath),
      envEmbeddedPath,
      envEmbeddedExists: fs.existsSync(envEmbeddedPath),
      secretLength: secret.length,
      fingerprintSha256Prefix16: fp,
      secretFromDotenv: secret.length > 0,
      isPlaceholderDefault: placeholder,
    };
  }
}

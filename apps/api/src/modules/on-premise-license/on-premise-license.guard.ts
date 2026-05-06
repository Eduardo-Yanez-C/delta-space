import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import { OnPremiseLicenseService } from "./on-premise-license.service";

@Injectable()
export class OnPremiseLicenseGuard implements CanActivate {
  constructor(private readonly license: OnPremiseLicenseService) {}

  canActivate(context: ExecutionContext): boolean {
    if (!this.license.isLicenseEnforcementEnabled()) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{
      path?: string;
      originalUrl?: string;
      url?: string;
    }>();
    const pathStr = this.normalizePath(req);
    if (this.isAllowlisted(pathStr)) {
      return true;
    }
    const status = this.license.getStatus();
    if (status.state === "OK") {
      return true;
    }
    throw new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: "ON_PREMISE_LICENSE_BLOCKED",
        licenseState: status.state,
        message: status.message,
      },
      HttpStatus.FORBIDDEN,
    );
  }

  normalizePath(req: {
    path?: string;
    originalUrl?: string;
    url?: string;
  }): string {
    let p = req.path;
    if (!p || p.length === 0) {
      const raw = (req.originalUrl ?? req.url ?? "/").split("?")[0];
      p = raw || "/";
    }
    if (p.length > 1 && p.endsWith("/")) {
      p = p.slice(0, -1);
    }
    return p;
  }

  isAllowlisted(pathStr: string): boolean {
    if (pathStr === "/api/health" || pathStr.startsWith("/api/health/")) {
      return true;
    }
    if (pathStr === "/api/lan/discovery" || pathStr.startsWith("/api/lan/discovery/")) {
      return true;
    }
    if (pathStr === "/api/auth" || pathStr.startsWith("/api/auth/")) {
      return true;
    }
    if (
      pathStr === "/api/admin/on-premise-license" ||
      pathStr.startsWith("/api/admin/on-premise-license/")
    ) {
      return true;
    }
    return false;
  }
}

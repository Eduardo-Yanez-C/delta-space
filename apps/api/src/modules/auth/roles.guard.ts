import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { expandRolesForGuard } from "./role-constants";
import { ROLES_KEY } from "./decorators/roles.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (!requiredRoles?.length) return true;
    const effective = expandRolesForGuard(roles);
    const hasRole = effective.size > 0 && requiredRoles.some((role) => effective.has(role));
    if (!hasRole) {
      const actual = roles.length ? roles.join(", ") : "(sin roles)";
      throw new ForbiddenException(
        `Requiere uno de [${requiredRoles.join(", ")}]. Usuario actual: ${user?.email ?? "?"}, roles: ${actual}`,
      );
    }
    return true;
  }
}

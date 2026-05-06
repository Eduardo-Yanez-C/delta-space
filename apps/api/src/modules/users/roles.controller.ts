import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AuthUserPayload } from "../auth/auth.service";
import { RolesService } from "./roles.service";

@Controller("roles")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN_DEV", "ADMIN")
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@CurrentUser() actor: AuthUserPayload) {
    return this.rolesService.findAllForActor(actor);
  }
}

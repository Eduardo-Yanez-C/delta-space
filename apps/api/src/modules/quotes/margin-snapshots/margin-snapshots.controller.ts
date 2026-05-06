import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import {
  ROLE_ADMIN,
  ROLE_ADMIN_DEV,
  ROLE_VENDEDOR_TECNICO,
} from "../../auth/role-constants";
import type { AuthUserPayload } from "../../auth/auth.service";
import { MarginSnapshotsService } from "./margin-snapshots.service";

@Controller("margin-snapshots")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN, ROLE_VENDEDOR_TECNICO)
export class MarginSnapshotsController {
  constructor(
    private readonly marginSnapshotsService: MarginSnapshotsService,
  ) {}

  @Get("latest")
  async getLatest(@CurrentUser() user: AuthUserPayload) {
    const snapshot = await this.marginSnapshotsService.findLatestForUser(
      user.id,
    );
    return { snapshot };
  }

  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.marginSnapshotsService.listForUser(user.id);
  }
}

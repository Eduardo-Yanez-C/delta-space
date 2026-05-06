import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
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
import { ApplyCleanDto } from "./dto/apply-clean.dto";
import { MarginHierarchyService } from "./margin-hierarchy.service";

@Controller("quotes/:quoteId/versions/:versionId/margin-hierarchy")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN, ROLE_VENDEDOR_TECNICO)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class MarginHierarchyController {
  constructor(
    private readonly marginHierarchyService: MarginHierarchyService,
  ) {}

  @Post("apply-clean")
  applyClean(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: ApplyCleanDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.marginHierarchyService.applyCleanHierarchy(
      quoteId,
      versionId,
      dto,
      user,
    );
  }
}

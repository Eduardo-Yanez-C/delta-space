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
import { CreateMarginSnapshotDto } from "./dto/create-margin-snapshot.dto";
import { ApplyLatestMarginSnapshotDto } from "./dto/apply-latest-margin-snapshot.dto";
import { MarginSnapshotsService } from "./margin-snapshots.service";

@Controller("quotes/:quoteId/versions/:versionId/margin-snapshots")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN, ROLE_VENDEDOR_TECNICO)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class MarginSnapshotsQuoteController {
  constructor(
    private readonly marginSnapshotsService: MarginSnapshotsService,
  ) {}

  @Post()
  create(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: CreateMarginSnapshotDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.marginSnapshotsService.createFromVersion(
      quoteId,
      versionId,
      dto,
      user,
    );
  }

  @Post("apply-latest")
  applyLatest(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: ApplyLatestMarginSnapshotDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.marginSnapshotsService.applyLatestToVersion(
      quoteId,
      versionId,
      dto,
      user,
    );
  }
}

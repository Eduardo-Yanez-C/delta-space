import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import type { AuthUserPayload } from "../../auth/auth.service";
import { QuoteAddOnsService } from "../../quote-addons/quote-addons.service";
import { SetAddonInputsDto } from "../../quote-addons/dto/set-addon-inputs.dto";
import { QuoteVersionsService } from "./quote-versions.service";
import { TechnicalValidationsService } from "../technical-validations/technical-validations.service";
import { CreateVersionDto } from "./dto/create-version.dto";
import { UpdateVersionDto } from "./dto/update-version.dto";

/** Orden de rutas alineado con dist (segmentos específicos antes que `:versionId` plano). */
@Controller("quotes/:quoteId/versions")
@UseGuards(JwtAuthGuard)
export class QuoteVersionsController {
  constructor(
    private readonly versionsService: QuoteVersionsService,
    private readonly quoteAddOnsService: QuoteAddOnsService,
    private readonly technicalValidationsService: TechnicalValidationsService,
  ) {}

  @Get()
  findAll(@Param("quoteId") quoteId: string, @CurrentUser() user: AuthUserPayload) {
    return this.versionsService.findAll(quoteId, user);
  }

  @Get(":versionId/addon-inputs")
  getAddonInputs(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quoteAddOnsService.getAddOnInputs(quoteId, versionId, user);
  }

  @Put(":versionId/addon-inputs")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  setAddonInputs(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: SetAddonInputsDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quoteAddOnsService.setAddOnInputs(
      quoteId,
      versionId,
      dto,
      user,
    );
  }

  @Get(":versionId/addon-suggestions")
  getAddonSuggestions(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quoteAddOnsService.getAddOnSuggestions(
      quoteId,
      versionId,
      user,
    );
  }

  @Post(":versionId/addon-suggestions/evaluate")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  evaluateAddonSuggestions(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quoteAddOnsService.evaluateAddOnSuggestions(
      quoteId,
      versionId,
      user,
    );
  }

  @Post(":versionId/addon-suggestions/:suggestionId/accept")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  acceptAddonSuggestion(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("suggestionId") suggestionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.versionsService.acceptAddonSuggestion(
      quoteId,
      versionId,
      suggestionId,
      user,
    );
  }

  @Post(":versionId/addon-suggestions/:suggestionId/reject")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  rejectAddonSuggestion(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("suggestionId") suggestionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.versionsService.rejectAddonSuggestion(
      quoteId,
      versionId,
      suggestionId,
      user,
    );
  }

  @Get(":versionId/technical-validations")
  getTechnicalValidations(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.technicalValidationsService.getAlerts(
      quoteId,
      versionId,
      user,
    );
  }

  @Get(":versionId")
  findOne(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.versionsService.findOne(quoteId, versionId, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  create(
    @Param("quoteId") quoteId: string,
    @Body() dto: CreateVersionDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.versionsService.create(quoteId, dto, user.id, user);
  }

  @Patch(":versionId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  update(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: UpdateVersionDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.versionsService.update(quoteId, versionId, dto, user);
  }

  @Post(":versionId/refresh-from-study")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS", "INGENIERIA")
  refreshFromStudy(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.versionsService.refreshVersionFromStudy(
      quoteId,
      versionId,
      user,
    );
  }
}

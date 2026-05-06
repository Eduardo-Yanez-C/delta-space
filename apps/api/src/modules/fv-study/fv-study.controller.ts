import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { FvStudyService } from "./fv-study.service";
import { SolarExplorerService } from "./solar-explorer.service";
import { CreateFvStudyDto } from "./dto/create-fv-study.dto";
import { UpdateFvStudyDto } from "./dto/update-fv-study.dto";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";

@Controller("fv-studies")
@UseGuards(JwtAuthGuard)
export class FvStudyController {
  constructor(
    private readonly fvStudyService: FvStudyService,
    private readonly solarExplorerService: SolarExplorerService,
  ) {}

  @Get()
  findAll(@Query("clientId") clientId: string | undefined, @CurrentUser() user: unknown) {
    return this.fvStudyService.findAll(clientId, user as any);
  }

  @Post(":id/solar-resource/external-estimate")
  async requestExternalEstimate(@Param("id") id: string, @CurrentUser() user: unknown) {
    console.log("[SOLAR-DEBUG] POST /fv-studies/:id/solar-resource/external-estimate hit, id =", id);
    const context = await this.fvStudyService.getSolarResourceExternalContext(id, user as any);
    const validation = this.solarExplorerService.validateContext(context as any);
    if (!validation.valid) {
      throw new BadRequestException(validation.message ?? "Contexto insuficiente para estimación externa.");
    }
    return this.solarExplorerService.requestExternalEstimate(context as any);
  }

  @Get(":id/solar-resource/external-context")
  getSolarResourceExternalContext(@Param("id") id: string, @CurrentUser() user: unknown) {
    return this.fvStudyService.getSolarResourceExternalContext(id, user as any);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: unknown) {
    return this.fvStudyService.findOne(id, user as any);
  }

  @Post(":id/create-quote")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createQuoteFromStudy(
    @Param("id") id: string,
    @Body()
    body:
      | {
          createWithSuggestedItems?: boolean;
          quoteKind?: "STANDARD" | "MARGIN";
        }
      | undefined,
    @CurrentUser() user: unknown,
  ) {
    const createWithSuggestedItems = body?.createWithSuggestedItems !== false;
    const quoteKind = body?.quoteKind === "MARGIN" ? "MARGIN" : "STANDARD";
    return this.fvStudyService.createQuoteFromStudy(
      id,
      createWithSuggestedItems,
      user as any,
      { quoteKind },
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() dto: CreateFvStudyDto, @CurrentUser() user: unknown) {
    return this.fvStudyService.create(dto as any, user as any);
  }

  @Patch(":id/archive")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  archive(@Param("id") id: string, @CurrentUser() user: unknown) {
    return this.fvStudyService.archive(id, user as any);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateFvStudyDto, @CurrentUser() user: unknown) {
    return this.fvStudyService.update(id, dto as any, user as any);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("id") id: string, @CurrentUser() user: unknown) {
    return this.fvStudyService.remove(id, user as any);
  }
}

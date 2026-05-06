import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { CreateRiskDto } from "./dto/create-risk.dto";
import { UpdateRiskDto } from "./dto/update-risk.dto";
import { RisksService } from "./risks.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class RisksController {
  constructor(private readonly risksService: RisksService) {}

  @Get("risks/executive")
  listExecutive(@Query("projectId") projectId?: string) {
    return this.risksService.listExecutive({
      projectId: projectId?.trim() || undefined,
    });
  }

  @Get("risks")
  listAll(
    @Query("projectId") projectId?: string,
    @Query("riskCategory") riskCategory?: string,
    @Query("matrixKind") matrixKind?: string,
  ) {
    return this.risksService.listAll({
      projectId: projectId?.trim() || undefined,
      riskCategory: riskCategory?.trim() || undefined,
      matrixKind: matrixKind?.trim() || undefined,
    });
  }

  @Get("projects/:projectId/risks")
  listByProject(
    @Param("projectId") projectId: string,
    @Query("matrixKind") matrixKind?: string,
  ) {
    return this.risksService.listByProject(projectId, {
      matrixKind: matrixKind?.trim() || undefined,
    });
  }

  @Get("projects/:projectId/risks/export")
  exportRisksCsv(@Param("projectId") projectId: string) {
    return this.risksService.exportCsv(projectId);
  }

  @Post("projects/:projectId/risks")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Param("projectId") projectId: string, @Body() dto: CreateRiskDto) {
    return this.risksService.create(projectId, dto);
  }

  @Patch("projects/:projectId/risks/:riskId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(
    @Param("projectId") projectId: string,
    @Param("riskId") riskId: string,
    @Body() dto: UpdateRiskDto,
  ) {
    return this.risksService.update(projectId, riskId, dto);
  }

  @Delete("projects/:projectId/risks/:riskId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("projectId") projectId: string, @Param("riskId") riskId: string) {
    return this.risksService.remove(projectId, riskId);
  }
}


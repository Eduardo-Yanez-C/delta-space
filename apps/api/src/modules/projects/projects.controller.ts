import { Body, Controller, Get, Param, Patch, Post, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }),
)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  list() {
    return this.projectsService.list();
  }

  @Get(":id/workspace")
  workspace(@Param("id") id: string) {
    return this.projectsService.getWorkspace(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.projectsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateProjectDto) {
    return this.projectsService.update(id, dto);
  }

  /** Reemplaza todas las ubicaciones del proyecto (obra, bodegas, faena, etc.). */
  @Post(":id/locations/replace")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  replaceLocations(
    @Param("id") id: string,
    @Body()
    body: {
      locations?: Array<{
        kind: string;
        label: string;
        address?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        notes?: string | null;
        isPrimary?: boolean | null;
      }>;
    },
  ) {
    return this.projectsService.replaceLocations(id, body?.locations ?? []);
  }
}

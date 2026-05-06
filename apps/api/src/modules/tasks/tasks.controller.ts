import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { parseScheduleDelimitedText } from "../../common/schedule-tsv-import";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { BulkImportScheduleDto } from "./dto/bulk-import-schedule.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { ImportScheduleDelimitedTextDto } from "./dto/import-schedule-delimited-text.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TasksService } from "./tasks.service";

@Controller("projects/:projectId/tasks")
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list(@Param("projectId") projectId: string) {
    return this.tasksService.listByProject(projectId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Param("projectId") projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasksService.create(projectId, dto);
  }

  @Post("import-schedule")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  importSchedule(@Param("projectId") projectId: string, @Body() dto: BulkImportScheduleDto) {
    return this.tasksService.bulkImportSchedule(projectId, dto.rows);
  }

  @Post("import-schedule/from-delimited-text")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  importScheduleFromText(@Param("projectId") projectId: string, @Body() dto: ImportScheduleDelimitedTextDto) {
    const { rows, warnings } = parseScheduleDelimitedText(dto.text);
    return this.tasksService.bulkImportSchedule(projectId, rows, warnings);
  }

  @Patch(":taskId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  update(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(projectId, taskId, dto);
  }

  @Delete(":taskId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("projectId") projectId: string, @Param("taskId") taskId: string) {
    return this.tasksService.remove(projectId, taskId);
  }
}

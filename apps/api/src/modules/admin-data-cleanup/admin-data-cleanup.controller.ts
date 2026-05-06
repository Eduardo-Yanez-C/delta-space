import { Body, Controller, Get, Post, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ROLE_ADMIN, ROLE_ADMIN_DEV } from "../auth/role-constants";
import type { AuthUserPayload } from "../auth/auth.service";
import { AdminDataCleanupService } from "./admin-data-cleanup.service";
import { DataCleanupPreviewDto } from "./dto/data-cleanup-preview.dto";
import { DataCleanupExecuteDto } from "./dto/data-cleanup-execute.dto";

@Controller("admin/data-cleanup")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
export class AdminDataCleanupController {
  constructor(private readonly adminDataCleanupService: AdminDataCleanupService) {}

  @Get("status")
  status() {
    return this.adminDataCleanupService.status();
  }

  @Post("preview")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  preview(@CurrentUser() user: AuthUserPayload, @Body() dto: DataCleanupPreviewDto) {
    return this.adminDataCleanupService.preview(dto, user.id);
  }

  @Post("execute")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  execute(@CurrentUser() user: AuthUserPayload, @Body() dto: DataCleanupExecuteDto) {
    return this.adminDataCleanupService.execute(user.id, user.email, dto);
  }
}

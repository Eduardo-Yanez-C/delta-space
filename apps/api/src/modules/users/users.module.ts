import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AuditLogModule } from "../audit-log/audit-log.module";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { RolesController } from "./roles.controller";
import { RolesService } from "./roles.service";

@Module({
  imports: [AuthModule, AuditLogModule],
  controllers: [UsersController, RolesController],
  providers: [UsersService, RolesService],
  exports: [UsersService],
})
export class UsersModule {}

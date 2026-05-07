import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AuthUserPayload } from "../auth/auth.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN_DEV", "ADMIN")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll(@Query("activeOnly") activeOnly: string | undefined) {
    const only = activeOnly === "true";
    return this.usersService.findAll(only);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthUserPayload,
  ) {
    return this.usersService.create(dto, actor);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
    @CurrentUser() actor: AuthUserPayload,
  ) {
    const body = req.body as Record<string, unknown>;
    if (Object.prototype.hasOwnProperty.call(body, "fullName")) {
      dto.fullName =
        body.fullName === null || body.fullName === undefined
          ? undefined
          : String(body.fullName);
    }
    if (Object.prototype.hasOwnProperty.call(body, "suiteNavGrants")) {
      dto.suiteNavGrants = body.suiteNavGrants;
    }
    if (Object.prototype.hasOwnProperty.call(body, "suiteAgentMonthlyTokenLimit")) {
      dto.suiteAgentMonthlyTokenLimit =
        body.suiteAgentMonthlyTokenLimit === null || body.suiteAgentMonthlyTokenLimit === ""
          ? null
          : Number(body.suiteAgentMonthlyTokenLimit);
    }
    if (Object.prototype.hasOwnProperty.call(body, "accessExpiresAt")) {
      const v = body.accessExpiresAt;
      dto.accessExpiresAt =
        v === null || v === undefined || v === "" ? null : typeof v === "string" ? v : String(v);
    }
    return this.usersService.update(id, dto, actor);
  }

  @Patch(":id/activate")
  activate(@Param("id") id: string, @CurrentUser() actor: AuthUserPayload) {
    return this.usersService.activate(id, actor);
  }

  @Patch(":id/deactivate")
  deactivate(@Param("id") id: string, @CurrentUser() actor: AuthUserPayload) {
    return this.usersService.deactivate(id, actor);
  }

  @Patch(":id/password")
  resetPassword(
    @Param("id") id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthUserPayload,
  ) {
    return this.usersService.resetPassword(id, dto.password, actor);
  }
}

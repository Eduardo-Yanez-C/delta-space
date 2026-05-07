import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserPayload } from "../auth/auth.service";
import { CreateUserInvitationDto } from "./dto/create-user-invitation.dto";
import { AcceptUserInvitationDto } from "./dto/accept-user-invitation.dto";
import { UserInvitationsService } from "./user-invitations.service";

@Controller()
export class UserInvitationsController {
  constructor(private readonly invitations: UserInvitationsService) {}

  @Get("admin/user-invitations")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  list(@CurrentUser() actor: AuthUserPayload) {
    return this.invitations.findAll(actor);
  }

  @Post("admin/user-invitations")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  create(@CurrentUser() actor: AuthUserPayload, @Body() dto: CreateUserInvitationDto) {
    return this.invitations.create(actor, dto);
  }

  /** Público: el usuario final acepta la invitación y crea su contraseña. */
  @Post("auth/accept-invitation")
  accept(@Body() dto: AcceptUserInvitationDto) {
    return this.invitations.accept(dto);
  }
}


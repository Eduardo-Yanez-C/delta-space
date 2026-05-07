import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserPayload } from "../auth/auth.service";
import { ClientsService } from "./clients.service";
import { FvStudyService } from "../fv-study/fv-study.service";
import { CreateClientDto } from "./dto/create-client.dto";
import { UpdateClientDto } from "./dto/update-client.dto";

/** Orden de rutas alineado con dist (`:id/fv-studies` antes de `:id`). */
@Controller("clients")
@UseGuards(JwtAuthGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly fvStudyService: FvStudyService,
  ) {}

  @Get()
  findAll(@CurrentUser() user: AuthUserPayload) {
    return this.clientsService.findAll(user);
  }

  @Get(":id/fv-studies")
  findFvStudiesByClient(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.fvStudyService.findByClientId(id, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.clientsService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  create(@Body() dto: CreateClientDto, @CurrentUser() user: AuthUserPayload) {
    return this.clientsService.create(dto, user);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  update(@Param("id") id: string, @Body() dto: UpdateClientDto, @CurrentUser() user: AuthUserPayload) {
    return this.clientsService.update(id, dto, user);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.clientsService.remove(id, user);
  }
}

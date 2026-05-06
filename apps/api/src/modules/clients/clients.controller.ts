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
  findAll() {
    return this.clientsService.findAll();
  }

  @Get(":id/fv-studies")
  findFvStudiesByClient(@Param("id") id: string) {
    return this.fvStudyService.findByClientId(id);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  update(@Param("id") id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN")
  remove(@Param("id") id: string) {
    return this.clientsService.remove(id);
  }
}

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
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { CreateTransportVariableDto } from "./dto/create-transport-variable.dto";
import { CreateTransportVariableProfileDto } from "./dto/create-transport-variable-profile.dto";
import { CreateTransportVariableValueDto } from "./dto/create-transport-variable-value.dto";
import { UpdateTransportVariableDto } from "./dto/update-transport-variable.dto";
import { UpdateTransportVariableProfileDto } from "./dto/update-transport-variable-profile.dto";
import { UpdateTransportVariableValueDto } from "./dto/update-transport-variable-value.dto";
import { TransportVariablesService } from "./transport-variables.service";

@Controller("inventory/transport-variables")
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TransportVariablesController {
  constructor(private readonly svc: TransportVariablesService) {}

  /** Vista previa: valores efectivos a una fecha (y perfil opcional). */
  @Get("resolve")
  resolve(
    @Query("at") at?: string,
    @Query("profileId") profileId?: string,
    @Query("keys") keysCsv?: string,
  ) {
    const d = at?.trim() ? new Date(at) : new Date();
    if (Number.isNaN(d.getTime())) throw new BadRequestException("Query at inválida.");
    const pid = profileId?.trim() || null;
    const keys = keysCsv
      ?.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    return this.svc.resolveAt(d, pid, keys?.length ? keys : null);
  }

  @Get("profiles")
  listProfiles() {
    return this.svc.listProfiles();
  }

  @Post("profiles")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createProfile(@Body() body: CreateTransportVariableProfileDto) {
    return this.svc.createProfile(body);
  }

  @Patch("profiles/:profileId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateProfile(@Param("profileId") profileId: string, @Body() body: UpdateTransportVariableProfileDto) {
    return this.svc.updateProfile(profileId.trim(), body);
  }

  @Delete("profiles/:profileId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteProfile(@Param("profileId") profileId: string) {
    return this.svc.deleteProfile(profileId.trim());
  }

  @Get()
  listVariables() {
    return this.svc.listVariables();
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createVariable(@Body() body: CreateTransportVariableDto) {
    return this.svc.createVariable(body);
  }

  @Get(":variableId/values")
  listValues(
    @Param("variableId") variableId: string,
    @Query("profileId") profileId?: string,
  ) {
    return this.svc.listValues(variableId.trim(), profileId);
  }

  @Post(":variableId/values")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createValue(@Param("variableId") variableId: string, @Body() body: CreateTransportVariableValueDto) {
    return this.svc.createValue(variableId.trim(), body);
  }

  @Patch(":variableId/values/:valueId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateValue(
    @Param("variableId") variableId: string,
    @Param("valueId") valueId: string,
    @Body() body: UpdateTransportVariableValueDto,
  ) {
    return this.svc.updateValue(variableId.trim(), valueId.trim(), body);
  }

  @Delete(":variableId/values/:valueId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteValue(@Param("variableId") variableId: string, @Param("valueId") valueId: string) {
    return this.svc.deleteValue(variableId.trim(), valueId.trim());
  }

  @Get(":id")
  getOne(@Param("id") id: string) {
    return this.svc.getVariable(id.trim());
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateVariable(@Param("id") id: string, @Body() body: UpdateTransportVariableDto) {
    return this.svc.updateVariable(id.trim(), body);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteVariable(@Param("id") id: string) {
    return this.svc.deleteVariable(id.trim());
  }
}

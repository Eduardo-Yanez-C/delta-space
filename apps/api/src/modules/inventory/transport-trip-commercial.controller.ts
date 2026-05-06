import {
  Body,
  Controller,
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
import { CreateTransportTripCommercialDto } from "./dto/create-transport-trip-commercial.dto";
import { UpdateTransportTripCommercialDto } from "./dto/update-transport-trip-commercial.dto";
import { TransportTripCommercialService } from "./transport-trip-commercial.service";

@Controller("inventory/transport-trips")
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TransportTripCommercialController {
  constructor(private readonly trips: TransportTripCommercialService) {}

  @Get()
  list(
    @Query("projectId") projectId?: string,
    @Query("groupKey") groupKey?: string,
    @Query("status") status?: string,
  ) {
    return this.trips.list({
      projectId: projectId?.trim() || null,
      groupKey: groupKey?.trim() || null,
      status: status?.trim() || null,
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() body: CreateTransportTripCommercialDto) {
    return this.trips.create(body);
  }

  @Get(":id")
  one(@Param("id") id: string) {
    return this.trips.getOne(id.trim());
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(@Param("id") id: string, @Body() body: UpdateTransportTripCommercialDto) {
    return this.trips.update(id.trim(), body);
  }

  @Post(":id/recalculate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  recalculate(@Param("id") id: string) {
    return this.trips.recalculate(id.trim());
  }

  @Post(":id/close")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  close(@Param("id") id: string) {
    return this.trips.close(id.trim());
  }
}

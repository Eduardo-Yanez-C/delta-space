import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { CreateTransportCommercialTariffDto } from "./dto/create-transport-commercial-tariff.dto";
import { UpdateTransportCommercialTariffDto } from "./dto/update-transport-commercial-tariff.dto";
import { UpsertTransportGroupCommercialDto } from "./dto/upsert-transport-group-commercial.dto";
import { TransportCommercialService } from "./transport-commercial.service";

@Controller("inventory/transport-commercial")
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class TransportCommercialController {
  constructor(private readonly transportCommercialService: TransportCommercialService) {}

  @Get("tariffs")
  listTariffs(
    @Query("projectId") projectId?: string,
    @Query("supplierId") supplierId?: string,
  ) {
    return this.transportCommercialService.listTariffs({
      projectId: projectId?.trim() || null,
      supplierId: supplierId?.trim() || null,
    });
  }

  @Post("tariffs")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  createTariff(@Body() body: CreateTransportCommercialTariffDto) {
    return this.transportCommercialService.createTariff(body);
  }

  @Patch("tariffs/:id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateTariff(@Param("id") id: string, @Body() body: UpdateTransportCommercialTariffDto) {
    return this.transportCommercialService.updateTariff(id.trim(), body);
  }

  @Delete("tariffs/:id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteTariff(@Param("id") id: string) {
    return this.transportCommercialService.deleteTariff(id.trim());
  }

  /** Varios groupKey separados por coma o repetidos en query. */
  @Get("deals")
  async dealsBatch(@Query("groupKeys") groupKeysRaw?: string) {
    const parts = (groupKeysRaw ?? "")
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const rows = await this.transportCommercialService.dealsForGroupKeys(parts);
    return { deals: rows };
  }

  @Get("deals/:groupKey")
  async dealOne(@Param("groupKey") groupKey: string) {
    const gk = decodeURIComponent(groupKey).trim();
    const row = await this.transportCommercialService.getDealByGroupKey(gk);
    return { deal: row };
  }

  @Put("deals")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  upsertDeal(@Body() body: UpsertTransportGroupCommercialDto) {
    return this.transportCommercialService.upsertDeal(body);
  }
}

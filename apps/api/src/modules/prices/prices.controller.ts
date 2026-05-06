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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import type { AuthUserPayload } from "../auth/auth.service";
import { PricesService } from "./prices.service";
import { ClosePriceValidityDto } from "./dto/close-price-validity.dto";
import { CreatePriceDto } from "./dto/create-price.dto";

@Controller("prices")
@UseGuards(JwtAuthGuard)
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  findAll(
    @Query("productId") productId: string | undefined,
    @Query("supplierId") supplierId: string | undefined,
    @Query("validAt") validAt: string | undefined,
    @Query("supplyOrigin") supplyOrigin: string | undefined,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.pricesService.findAll(
      {
        productId: productId || undefined,
        supplierId: supplierId || undefined,
        validAt: validAt || undefined,
        supplyOrigin: supplyOrigin || undefined,
      },
      user,
    );
  }

  @Patch(":id/close-validity")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  closeValidity(
    @Param("id") id: string,
    @Body() body: ClosePriceValidityDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.pricesService.closeOpenValidity(id, body ?? {}, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.pricesService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() dto: CreatePriceDto) {
    return this.pricesService.create(dto);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import type { AuthUserPayload } from "../auth/auth.service";
import { FvCalculationService } from "./fv-calculation.service";
import { CreateFvCalculationDto } from "./dto/create-fv-calculation.dto";

@Controller("quotes/:quoteId/fv-calculation")
@UseGuards(JwtAuthGuard)
export class FvCalculationController {
  constructor(private readonly fvCalculation: FvCalculationService) {}

  @Get()
  async findOne(
    @Param("quoteId") quoteId: string,
    @Query("versionId") versionId: string | undefined,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const result = await this.fvCalculation.findByQuote(
      quoteId,
      versionId,
      user,
    );
    return result;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  async create(
    @Param("quoteId") quoteId: string,
    @Body() dto: CreateFvCalculationDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const quoteVersionId = dto.quoteVersionId;
    return this.fvCalculation.save(quoteId, dto, user, quoteVersionId);
  }
}

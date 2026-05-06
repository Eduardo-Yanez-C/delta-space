import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import type { AuthUserPayload } from "../auth/auth.service";
import { QuotesService } from "./quotes.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { FilterQuotesDto } from "./dto/filter-quotes.dto";

@Controller("quotes")
@UseGuards(JwtAuthGuard)
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  findAll(
    @Query() query: FilterQuotesDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quotesService.findAll(query, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.quotesService.findOne(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: AuthUserPayload) {
    return this.quotesService.create(dto, user);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(
    @Param("id") id: string,
    @Body() dto: UpdateQuoteDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quotesService.update(id, dto, user);
  }
}

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
import { JwtAuthGuard } from "../../auth/jwt-auth.guard";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { Roles } from "../../auth/decorators/roles.decorator";
import { RolesGuard } from "../../auth/roles.guard";
import type { AuthUserPayload } from "../../auth/auth.service";
import { QuoteItemsService } from "./quote-items.service";
import { CreateQuoteItemDto } from "./dto/create-quote-item.dto";
import { UpdateQuoteItemDto } from "./dto/update-quote-item.dto";

@Controller("quotes/:quoteId/versions/:versionId/items")
@UseGuards(JwtAuthGuard)
export class QuoteItemsController {
  constructor(private readonly itemsService: QuoteItemsService) {}

  @Get()
  findAll(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.itemsService.findAll(quoteId, versionId, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  addItem(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: CreateQuoteItemDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.itemsService.addItem(quoteId, versionId, dto, user);
  }

  @Patch(":itemId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  updateItem(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateQuoteItemDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.itemsService.updateItem(
      quoteId,
      versionId,
      itemId,
      dto,
      user,
    );
  }

  @Delete(":itemId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  removeItem(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("itemId") itemId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.itemsService.removeItem(quoteId, versionId, itemId, user);
  }
}

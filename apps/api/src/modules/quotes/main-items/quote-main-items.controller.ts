import {
  Body,
  Controller,
  Delete,
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
import { QuoteMainItemsService } from "./quote-main-items.service";
import { CreateMainItemDto } from "./dto/create-main-item.dto";
import { CreateLineDto } from "./dto/create-line.dto";
import { UpdateLineDto } from "./dto/update-line.dto";
import { UpdateMainItemDto } from "./dto/update-main-item.dto";

@Controller("quotes/:quoteId/versions/:versionId")
@UseGuards(JwtAuthGuard)
export class QuoteMainItemsController {
  constructor(private readonly mainItemsService: QuoteMainItemsService) {}

  @Post("main-items")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createMainItem(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Body() dto: CreateMainItemDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.createMainItem(quoteId, versionId, dto, user);
  }

  @Patch("main-items/:mainItemId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  updateMainItem(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("mainItemId") mainItemId: string,
    @Body() dto: UpdateMainItemDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.updateMainItem(
      quoteId,
      versionId,
      mainItemId,
      dto,
      user,
    );
  }

  @Post("main-items/:mainItemId/duplicate")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  duplicateMainItem(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("mainItemId") mainItemId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.duplicateMainItem(
      quoteId,
      versionId,
      mainItemId,
      user,
    );
  }

  @Post("main-items/:mainItemId/lines")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createLine(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("mainItemId") mainItemId: string,
    @Body() dto: CreateLineDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.createLine(
      quoteId,
      versionId,
      mainItemId,
      dto,
      user,
    );
  }

  @Post("lines/:lineId/duplicate")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  duplicateLine(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.duplicateLine(quoteId, versionId, lineId, user);
  }

  @Patch("lines/:lineId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  updateLine(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("lineId") lineId: string,
    @Body() dto: UpdateLineDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.updateLine(
      quoteId,
      versionId,
      lineId,
      dto,
      user,
    );
  }

  @Delete("lines/:lineId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  deleteLine(
    @Param("quoteId") quoteId: string,
    @Param("versionId") versionId: string,
    @Param("lineId") lineId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.mainItemsService.deleteLine(quoteId, versionId, lineId, user);
  }
}

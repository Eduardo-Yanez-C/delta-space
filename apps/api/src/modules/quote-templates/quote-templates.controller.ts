import {
  Body,
  Controller,
  Delete,
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
import type { AuthUserPayload } from "../auth/auth.service";
import { QuoteTemplatesService } from "./quote-templates.service";
import { CreateQuoteFromTemplateDto } from "./dto/create-quote-from-template.dto";
import { CreateQuoteTemplateDto } from "./dto/create-quote-template.dto";
import { CreateTemplateLineDto } from "./dto/create-template-line.dto";
import { CreateTemplateItemDto } from "./dto/create-template-item.dto";
import { CreateTemplateFromQuoteDto } from "./dto/create-template-from-quote.dto";
import { UpdateQuoteTemplateDto } from "./dto/update-quote-template.dto";
import { UpdateTemplateItemDto } from "./dto/update-template-item.dto";
import { UpdateTemplateLineDto } from "./dto/update-template-line.dto";

@Controller("quote-templates")
@UseGuards(JwtAuthGuard)
export class QuoteTemplatesController {
  constructor(private readonly quoteTemplatesService: QuoteTemplatesService) {}

  @Get()
  findAll(@Query("quoteKind") quoteKind?: string) {
    return this.quoteTemplatesService.findAll(quoteKind);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createTemplate(@Body() body: CreateQuoteTemplateDto) {
    return this.quoteTemplatesService.createTemplate(body);
  }

  @Post("from-quote-version")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createTemplateFromQuoteVersion(
    @Body() body: CreateTemplateFromQuoteDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quoteTemplatesService.createTemplateFromQuoteVersion(body, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.quoteTemplatesService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  updateTemplate(@Param("id") id: string, @Body() body: UpdateQuoteTemplateDto) {
    return this.quoteTemplatesService.updateTemplate(id, body);
  }

  @Post(":id/create-quote")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createQuoteFromTemplate(
    @Param("id") id: string,
    @Body() body: CreateQuoteFromTemplateDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.quoteTemplatesService.createQuoteFromTemplate(id, body, user);
  }

  @Post(":templateId/items")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createTemplateItem(
    @Param("templateId") templateId: string,
    @Body() body: CreateTemplateItemDto,
  ) {
    return this.quoteTemplatesService.createTemplateItem(templateId, body);
  }

  @Patch(":templateId/items/:itemId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  updateTemplateItem(
    @Param("templateId") templateId: string,
    @Param("itemId") itemId: string,
    @Body() body: UpdateTemplateItemDto,
  ) {
    return this.quoteTemplatesService.updateTemplateItem(templateId, itemId, body);
  }

  @Delete(":templateId/items/:itemId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  deleteTemplateItem(
    @Param("templateId") templateId: string,
    @Param("itemId") itemId: string,
  ) {
    return this.quoteTemplatesService.deleteTemplateItem(templateId, itemId);
  }

  @Post(":templateId/items/:itemId/lines")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  createLine(
    @Param("templateId") templateId: string,
    @Param("itemId") itemId: string,
    @Body() body: CreateTemplateLineDto,
  ) {
    return this.quoteTemplatesService.createLine(templateId, itemId, body);
  }

  @Patch(":templateId/lines/:lineId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  updateLine(
    @Param("templateId") templateId: string,
    @Param("lineId") lineId: string,
    @Body() body: UpdateTemplateLineDto,
  ) {
    return this.quoteTemplatesService.updateLine(templateId, lineId, body);
  }

  @Delete(":templateId/lines/:lineId")
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS")
  deleteLine(
    @Param("templateId") templateId: string,
    @Param("lineId") lineId: string,
  ) {
    return this.quoteTemplatesService.deleteLine(templateId, lineId);
  }
}

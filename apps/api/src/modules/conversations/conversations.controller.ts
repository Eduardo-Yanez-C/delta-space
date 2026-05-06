import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthUserPayload } from "../auth/auth.service";
import { ConversationsService } from "./conversations.service";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { CreateEntityPdfDto } from "./dto/create-entity-pdf.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { ResolveSharedEntityDto } from "./dto/resolve-shared-entity.dto";
import { ToggleReactionDto } from "./dto/toggle-reaction.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get("directory-users")
  async listDirectoryUsers(
    @CurrentUser() user: AuthUserPayload,
    @Res({ passthrough: true }) res: Response,
    @Query("presentOnly") presentOnlyRaw?: string,
  ) {
    const presentOnly =
      presentOnlyRaw === "true" ||
      presentOnlyRaw === "1" ||
      presentOnlyRaw === "yes";
    const out = await this.conversationsService.listDirectoryUsers(user.id, {
      presentOnly,
    });
    res.setHeader("X-PV-Directory-Row-Count", String(out.users.length));
    const trace = this.conversationsService.getLastDirectoryTraceForUser(user.id);
    if (trace) {
      res.setHeader("X-PV-Lan-Instance-Id", trace.lanInstanceId);
      res.setHeader("X-PV-Lan-Peer-Count", String(trace.peerCount));
      res.setHeader("X-PV-Mesh-Configured", trace.meshSecretConfigured ? "1" : "0");
    }
    return out;
  }

  /** Última traza del directorio (tras un GET directory-users). Prueba real en LAN. */
  @Get("directory-diagnostics")
  directoryDiagnostics(@CurrentUser() user: AuthUserPayload) {
    const t = this.conversationsService.getLastDirectoryTraceForUser(user.id);
    if (!t) {
      return {
        message:
          "Aún no hay traza. Abra «Nueva conversación» una vez y vuelva a llamar este endpoint.",
      };
    }
    return t;
  }

  @Get()
  list(
    @CurrentUser() user: AuthUserPayload,
    @Query("includeArchived") includeArchivedRaw?: string,
  ) {
    const includeArchived =
      includeArchivedRaw === "true" ||
      includeArchivedRaw === "1" ||
      includeArchivedRaw === "yes";
    return this.conversationsService.listForUser(user.id, { includeArchived });
  }

  @Post()
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  create(
    @Body() dto: CreateConversationDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.createConversation(dto, user.id);
  }

  @Patch(":id/archive")
  archiveForMe(
    @Param("id") id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.archiveForUser(id, user.id);
  }

  @Patch(":id/unarchive")
  unarchiveForMe(
    @Param("id") id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.unarchiveForUser(id, user.id);
  }

  @Get(":id")
  getOne(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.conversationsService.getOne(id, user.id);
  }

  @Get(":id/messages")
  getMessages(
    @Param("id") id: string,
    @Query("limit") limitStr: string | undefined,
    @Query("before") before: string | undefined,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const limit =
      limitStr !== undefined && limitStr !== ""
        ? parseInt(limitStr, 10)
        : undefined;
    return this.conversationsService.getMessages(id, user.id, {
      limit: Number.isFinite(limit) ? limit : undefined,
      before: before?.trim() || undefined,
    });
  }

  @Post(":id/messages")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  createMessage(
    @Param("id") id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.createMessage(id, user.id, dto, user);
  }

  @Post(":id/messages/file")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024 } }),
  )
  createFileMessage(
    @Param("id") id: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          mimetype: string;
          size?: number;
          originalname?: string;
        }
      | undefined,
    @Body()
    body: {
      body?: string;
      replyToMessageId?: string;
    },
    @CurrentUser() user: AuthUserPayload,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(
        "Debe adjuntar un archivo (campo 'file').",
      );
    }
    return this.conversationsService.createFileMessage(id, user.id, file, body, user);
  }

  @Post("share/entity-pdf")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async createEntityPdf(
    @Body() dto: CreateEntityPdfDto,
    @Res() res: Response,
  ) {
    const buf = await this.conversationsService.generateEntityPdfBuffer(
      dto.entityType,
      dto.title,
      dto.summary,
    );
    const safe = dto.title.trim().replace(/[^\w\-]+/g, "-").slice(0, 80) || "entidad";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Length", String(buf.length));
    res.setHeader("Content-Disposition", `attachment; filename="${safe}.pdf"`);
    res.send(buf);
  }

  @Post(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUserPayload) {
    return this.conversationsService.markRead(id, user.id);
  }

  @Post("messages/:messageId/shared-entity/resolve")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  resolveSharedEntity(
    @Param("messageId") messageId: string,
    @Body() dto: ResolveSharedEntityDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.resolveSharedEntityMessage(
      messageId,
      user.id,
      dto,
    );
  }

  @Get("messages/:messageId/shared-entity/context")
  sharedEntityContext(
    @Param("messageId") messageId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.getSharedEntityResolutionContext(
      messageId,
      user.id,
    );
  }

  @Post("messages/:messageId/reactions/toggle")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  toggleReaction(
    @Param("messageId") messageId: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.toggleReaction(messageId, user.id, dto.emoji);
  }

  /** Compatibilidad: algunos clientes envían la ruta con conversationId en el path. */
  @Post(":conversationId/messages/:messageId/reactions/toggle")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  toggleReactionCompat(
    @Param("messageId") messageId: string,
    @Body() dto: ToggleReactionDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.conversationsService.toggleReaction(messageId, user.id, dto.emoji);
  }

  @Get("messages/:messageId/attachments/:attachmentId/download")
  async downloadAttachment(
    @Param("messageId") messageId: string,
    @Param("attachmentId") attachmentId: string,
    @CurrentUser() user: AuthUserPayload,
    @Res() res: Response,
  ) {
    const { buffer, fileName, mimeType, sizeBytes } =
      await this.conversationsService.getAttachmentForDownload(
        messageId,
        attachmentId,
        user.id,
      );
    res.setHeader("Content-Type", mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(sizeBytes));
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileName)}"`,
    );
    res.send(buffer);
  }
}

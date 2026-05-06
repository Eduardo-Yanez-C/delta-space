"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const current_user_decorator_1 = require("../auth/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const conversations_service_1 = require("./conversations.service");
const create_conversation_dto_1 = require("./dto/create-conversation.dto");
const create_entity_pdf_dto_1 = require("./dto/create-entity-pdf.dto");
const create_message_dto_1 = require("./dto/create-message.dto");
const resolve_shared_entity_dto_1 = require("./dto/resolve-shared-entity.dto");
const toggle_reaction_dto_1 = require("./dto/toggle-reaction.dto");
let ConversationsController = class ConversationsController {
    constructor(conversationsService) {
        this.conversationsService = conversationsService;
    }
    async listDirectoryUsers(user, res, presentOnlyRaw) {
        const presentOnly = presentOnlyRaw === "true" ||
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
    directoryDiagnostics(user) {
        const t = this.conversationsService.getLastDirectoryTraceForUser(user.id);
        if (!t) {
            return {
                message: "Aún no hay traza. Abra «Nueva conversación» una vez y vuelva a llamar este endpoint.",
            };
        }
        return t;
    }
    list(user, includeArchivedRaw) {
        const includeArchived = includeArchivedRaw === "true" ||
            includeArchivedRaw === "1" ||
            includeArchivedRaw === "yes";
        return this.conversationsService.listForUser(user.id, { includeArchived });
    }
    create(dto, user) {
        return this.conversationsService.createConversation(dto, user.id);
    }
    archiveForMe(id, user) {
        return this.conversationsService.archiveForUser(id, user.id);
    }
    unarchiveForMe(id, user) {
        return this.conversationsService.unarchiveForUser(id, user.id);
    }
    getOne(id, user) {
        return this.conversationsService.getOne(id, user.id);
    }
    getMessages(id, limitStr, before, user) {
        const limit = limitStr !== undefined && limitStr !== ""
            ? parseInt(limitStr, 10)
            : undefined;
        return this.conversationsService.getMessages(id, user.id, {
            limit: Number.isFinite(limit) ? limit : undefined,
            before: before?.trim() || undefined,
        });
    }
    createMessage(id, dto, user) {
        return this.conversationsService.createMessage(id, user.id, dto, user);
    }
    createFileMessage(id, file, body, user) {
        if (!file?.buffer) {
            throw new common_1.BadRequestException("Debe adjuntar un archivo (campo 'file').");
        }
        return this.conversationsService.createFileMessage(id, user.id, file, body, user);
    }
    async createEntityPdf(dto, res) {
        const buf = await this.conversationsService.generateEntityPdfBuffer(dto.entityType, dto.title, dto.summary);
        const safe = dto.title.trim().replace(/[^\w\-]+/g, "-").slice(0, 80) || "entidad";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Length", String(buf.length));
        res.setHeader("Content-Disposition", `attachment; filename="${safe}.pdf"`);
        res.send(buf);
    }
    markRead(id, user) {
        return this.conversationsService.markRead(id, user.id);
    }
    resolveSharedEntity(messageId, dto, user) {
        return this.conversationsService.resolveSharedEntityMessage(messageId, user.id, dto);
    }
    sharedEntityContext(messageId, user) {
        return this.conversationsService.getSharedEntityResolutionContext(messageId, user.id);
    }
    toggleReaction(messageId, dto, user) {
        return this.conversationsService.toggleReaction(messageId, user.id, dto.emoji);
    }
    /** Compatibilidad: algunos clientes envían la ruta con conversationId en el path. */
    toggleReactionCompat(messageId, dto, user) {
        return this.conversationsService.toggleReaction(messageId, user.id, dto.emoji);
    }
    async downloadAttachment(messageId, attachmentId, user, res) {
        const { absolutePath, fileName, mimeType, sizeBytes } = await this.conversationsService.getAttachmentForDownload(messageId, attachmentId, user.id);
        res.setHeader("Content-Type", mimeType || "application/octet-stream");
        res.setHeader("Content-Length", String(sizeBytes));
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.sendFile(absolutePath);
    }
};
exports.ConversationsController = ConversationsController;
__decorate([
    (0, common_1.Get)("directory-users"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Query)("presentOnly")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "listDirectoryUsers", null);
__decorate([
    (0, common_1.Get)("directory-diagnostics"),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "directoryDiagnostics", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)("includeArchived")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_conversation_dto_1.CreateConversationDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(":id/archive"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "archiveForMe", null);
__decorate([
    (0, common_1.Patch)(":id/unarchive"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "unarchiveForMe", null);
__decorate([
    (0, common_1.Get)(":id"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)(":id/messages"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Query)("limit")),
    __param(2, (0, common_1.Query)("before")),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)(":id/messages"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_message_dto_1.CreateMessageDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "createMessage", null);
__decorate([
    (0, common_1.Post)(":id/messages/file"),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)("file", { limits: { fileSize: 15 * 1024 * 1024 } })),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "createFileMessage", null);
__decorate([
    (0, common_1.Post)("share/entity-pdf"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_entity_pdf_dto_1.CreateEntityPdfDto, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "createEntityPdf", null);
__decorate([
    (0, common_1.Post)(":id/read"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)("messages/:messageId/shared-entity/resolve"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Param)("messageId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, resolve_shared_entity_dto_1.ResolveSharedEntityDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "resolveSharedEntity", null);
__decorate([
    (0, common_1.Get)("messages/:messageId/shared-entity/context"),
    __param(0, (0, common_1.Param)("messageId")),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "sharedEntityContext", null);
__decorate([
    (0, common_1.Post)("messages/:messageId/reactions/toggle"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Param)("messageId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, toggle_reaction_dto_1.ToggleReactionDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "toggleReaction", null);
__decorate([
    (0, common_1.Post)(":conversationId/messages/:messageId/reactions/toggle"),
    (0, common_1.UsePipes)(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    })),
    __param(0, (0, common_1.Param)("messageId")),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, toggle_reaction_dto_1.ToggleReactionDto, Object]),
    __metadata("design:returntype", void 0)
], ConversationsController.prototype, "toggleReactionCompat", null);
__decorate([
    (0, common_1.Get)("messages/:messageId/attachments/:attachmentId/download"),
    __param(0, (0, common_1.Param)("messageId")),
    __param(1, (0, common_1.Param)("attachmentId")),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "downloadAttachment", null);
exports.ConversationsController = ConversationsController = __decorate([
    (0, common_1.Controller)("conversations"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [conversations_service_1.ConversationsService])
], ConversationsController);

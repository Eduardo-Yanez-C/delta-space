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
var ConversationsGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const common_1 = require("@nestjs/common");
const auth_service_1 = require("../auth/auth.service");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const conversation_presence_service_1 = require("./conversation-presence.service");
const conversations_jwt_verify_1 = require("./conversations-jwt-verify");
let ConversationsGateway = ConversationsGateway_1 = class ConversationsGateway {
    constructor(authService, prisma, presence) {
        this.authService = authService;
        this.prisma = prisma;
        this.presence = presence;
        this.log = new common_1.Logger(ConversationsGateway_1.name);
    }
    getRoom(conversationId) {
        return `conv:${conversationId}`;
    }
    /** Sala por usuario: recibe mensajes de todas sus conversaciones aunque no tenga el hilo abierto. */
    userRoom(userId) {
        return `user:${userId}`;
    }
    extractToken(client) {
        const authToken = client.handshake.auth?.token;
        if (typeof authToken === "string" && authToken.trim() !== "") {
            return authToken.trim();
        }
        const headerRaw = client.handshake.headers.authorization;
        if (typeof headerRaw !== "string") {
            return null;
        }
        const m = /^Bearer\s+(.+)$/i.exec(headerRaw.trim());
        return m?.[1] ?? null;
    }
    async handleConnection(client) {
        try {
            const token = this.extractToken(client);
            if (!token) {
                throw new common_1.UnauthorizedException("Falta token");
            }
            const payload = (0, conversations_jwt_verify_1.verifyJwtForConversationsSocket)(token);
            let user = await this.authService.validateUserById(payload.sub);
            if (!user && payload.email) {
                user = await this.authService.validateUserByEmail(payload.email);
            }
            if (!user) {
                throw new common_1.UnauthorizedException("Usuario no válido en este equipo");
            }
            client.data.user = user;
            await client.join(this.userRoom(user.id));
            const becameOnline = this.presence.addConnection(user.id, client.id);
            if (becameOnline) {
                this.server.emit("conversations:presence:delta", { userId: user.id, online: true });
            }
        }
        catch {
            client.disconnect(true);
        }
    }
    handleDisconnect(client) {
        const wentOffline = this.presence.removeSocket(client.id);
        if (wentOffline) {
            this.server.emit("conversations:presence:delta", { userId: wentOffline, online: false });
        }
    }
    async assertMember(conversationId, userId) {
        const membership = await this.prisma.conversationMember.findFirst({
            where: {
                conversationId,
                userId,
                leftAt: null,
            },
            select: { id: true },
        });
        if (!membership) {
            throw new common_1.UnauthorizedException("No pertenece a esta conversación");
        }
    }
    async onJoin(client, body) {
        const user = client.data.user;
        if (!user) {
            throw new common_1.UnauthorizedException("Sesión no válida");
        }
        const conversationId = body?.conversationId?.trim() ?? "";
        if (!conversationId) {
            throw new common_1.UnauthorizedException("conversationId requerido");
        }
        await this.assertMember(conversationId, user.id);
        await client.join(this.getRoom(conversationId));
        return { ok: true, conversationId };
    }
    async onLeave(client, body) {
        const conversationId = body?.conversationId?.trim() ?? "";
        if (!conversationId) {
            return { ok: true, conversationId: "" };
        }
        await client.leave(this.getRoom(conversationId));
        return { ok: true, conversationId };
    }
    async emitMessageNew(conversationId, message) {
        const members = await this.prisma.conversationMember.findMany({
            where: { conversationId, leftAt: null },
            select: { userId: true },
        });
        const memberIds = members.map((m) => m.userId);
        const payload = { conversationId, message };
        const presenceByMember = memberIds.map((uid) => ({
            userId: uid,
            socketCount: this.presence.getSocketCountForUser(uid),
        }));
        if (memberIds.length > 0) {
            const rooms = memberIds.map((id) => this.userRoom(id));
            this.server.to(rooms).emit("conversations:message:new", payload);
        }
        this.log.log(JSON.stringify({
            pvConvMessageEmit: true,
            conversationId,
            messageId: message.id,
            authorId: message.authorId,
            deliveryMode: "user_rooms",
            memberUserIds: memberIds,
            memberCount: memberIds.length,
            presenceByMember,
        }));
    }
    async emitMessageReactionUpdated(conversationId, messageId, reactions) {
        const members = await this.prisma.conversationMember.findMany({
            where: { conversationId, leftAt: null },
            select: { userId: true },
        });
        const memberIds = members.map((m) => m.userId);
        if (memberIds.length > 0) {
            const rooms = memberIds.map((id) => this.userRoom(id));
            this.server.to(rooms).emit("conversations:message:reaction", {
                conversationId,
                messageId,
                reactions,
            });
        }
    }
};
exports.ConversationsGateway = ConversationsGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", Function)
], ConversationsGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)("conversations:join"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConversationsGateway.prototype, "onJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)("conversations:leave"),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ConversationsGateway.prototype, "onLeave", null);
exports.ConversationsGateway = ConversationsGateway = ConversationsGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        path: "/api/socket.io",
        namespace: "/conversations",
        cors: { origin: true, credentials: true },
    }),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        prisma_service_1.PrismaService,
        conversation_presence_service_1.ConversationPresenceService])
], ConversationsGateway);

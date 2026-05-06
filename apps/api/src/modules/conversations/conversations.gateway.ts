import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Logger, UnauthorizedException } from "@nestjs/common";
import type { Server, Socket } from "socket.io";
import { AuthService, type AuthUserPayload } from "../auth/auth.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ConversationPresenceService } from "./conversation-presence.service";
import { verifyJwtForConversationsSocket } from "./conversations-jwt-verify";

type AuthedSocket = Socket & { data: { user?: AuthUserPayload } };

@WebSocketGateway({
  path: "/api/socket.io",
  namespace: "/conversations",
  cors: { origin: true, credentials: true },
})
export class ConversationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly log = new Logger(ConversationsGateway.name);

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly presence: ConversationPresenceService,
  ) {}

  private getRoom(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  /** Sala por usuario: recibe mensajes de todas sus conversaciones aunque no tenga el hilo abierto. */
  private userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: Socket): string | null {
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

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        throw new UnauthorizedException("Falta token");
      }
      const payload = verifyJwtForConversationsSocket(token);
      let user = await this.authService.validateUserById(payload.sub);
      if (!user && payload.email) {
        user = await this.authService.validateUserByEmail(payload.email);
      }
      if (!user) {
        throw new UnauthorizedException("Usuario no válido en este equipo");
      }
      client.data.user = user;
      await client.join(this.userRoom(user.id));
      const becameOnline = this.presence.addConnection(user.id, client.id);
      if (becameOnline) {
        this.server.emit("conversations:presence:delta", { userId: user.id, online: true });
      }
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthedSocket): void {
    const wentOffline = this.presence.removeSocket(client.id);
    if (wentOffline) {
      this.server.emit("conversations:presence:delta", { userId: wentOffline, online: false });
    }
  }

  private async assertMember(conversationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.conversationMember.findFirst({
      where: {
        conversationId,
        userId,
        leftAt: null,
      },
      select: { id: true },
    });
    if (!membership) {
      throw new UnauthorizedException("No pertenece a esta conversación");
    }
  }

  @SubscribeMessage("conversations:join")
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<{ ok: true; conversationId: string }> {
    const user = client.data.user;
    if (!user) {
      throw new UnauthorizedException("Sesión no válida");
    }
    const conversationId = body?.conversationId?.trim() ?? "";
    if (!conversationId) {
      throw new UnauthorizedException("conversationId requerido");
    }
    await this.assertMember(conversationId, user.id);
    await client.join(this.getRoom(conversationId));
    return { ok: true, conversationId };
  }

  @SubscribeMessage("conversations:leave")
  async onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { conversationId?: string },
  ): Promise<{ ok: true; conversationId: string }> {
    const conversationId = body?.conversationId?.trim() ?? "";
    if (!conversationId) {
      return { ok: true, conversationId: "" };
    }
    await client.leave(this.getRoom(conversationId));
    return { ok: true, conversationId };
  }

  async emitMessageNew(
    conversationId: string,
    message: {
      id: string;
      body: string;
      createdAt: string;
      authorId: string;
      authorName: string;
      metadata: unknown;
      reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
      attachments?: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        downloadUrl: string;
      }>;
    },
  ): Promise<void> {
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

    this.log.log(
      JSON.stringify({
        pvConvMessageEmit: true,
        conversationId,
        messageId: message.id,
        authorId: message.authorId,
        deliveryMode: "user_rooms",
        memberUserIds: memberIds,
        memberCount: memberIds.length,
        presenceByMember,
      }),
    );
  }

  async emitMessageReactionUpdated(
    conversationId: string,
    messageId: string,
    reactions: Array<{ emoji: string; count: number; reactedByMe: boolean }>,
  ): Promise<void> {
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
}

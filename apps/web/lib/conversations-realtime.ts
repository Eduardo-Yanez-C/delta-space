import { io, type Socket } from "socket.io-client";
import { getAuthToken, getLocalConversationsApiBase, type ConversationMessageDto } from "./api";

export type ConversationMessageNewEvent = {
  conversationId: string;
  message: ConversationMessageDto;
};

export type ConversationReactionEvent = {
  conversationId: string;
  messageId: string;
  reactions: ConversationMessageDto["reactions"];
};

type MessageHandler = (event: ConversationMessageNewEvent) => void;
type ReactionHandler = (event: ConversationReactionEvent) => void;
export type ConversationPresenceDeltaEvent = { userId: string; online: boolean };

type PresenceDeltaHandler = (event: ConversationPresenceDeltaEvent) => void;

function normalizeRealtimeMessage(raw: ConversationMessageDto): ConversationMessageDto {
  return {
    ...raw,
    metadata: raw?.metadata ?? null,
    sharedEntity: raw?.sharedEntity ?? null,
    reactions: Array.isArray(raw?.reactions) ? raw.reactions : [],
    attachments: Array.isArray(raw?.attachments) ? raw.attachments : [],
  };
}

class ConversationsRealtimeClient {
  private socket: Socket | null = null;
  private apiBase: string | null = null;
  private handlers = new Set<MessageHandler>();
  private reactionHandlers = new Set<ReactionHandler>();
  private presenceHandlers = new Set<PresenceDeltaHandler>();
  /** Hilo al que debe volver a unirse tras reconectar el socket (misma pestaña). */
  private activeConversationId: string | null = null;

  private apiBaseToOrigin(base: string): string {
    const normalized = base.replace(/\/$/, "");
    if (normalized.endsWith("/api")) {
      return normalized.slice(0, -4);
    }
    return normalized;
  }

  private tearDownSocket(): void {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  /** Usa siempre el Nest local de conversaciones, no `getApiBase()` (nodo de datos). */
  connect(apiBase = getLocalConversationsApiBase()): void {
    if (typeof window === "undefined") return;
    const token = getAuthToken();
    if (!token) return;
    if (this.socket && this.apiBase === apiBase) return;
    this.tearDownSocket();
    this.apiBase = apiBase;
    const origin = this.apiBaseToOrigin(apiBase);
    const socket = io(`${origin}/conversations`, {
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
      auth: { token },
    });
    socket.on("conversations:message:new", (event: ConversationMessageNewEvent) => {
      const safeEvent: ConversationMessageNewEvent = {
        conversationId: event?.conversationId ?? "",
        message: normalizeRealtimeMessage(event?.message as ConversationMessageDto),
      };
      for (const handler of this.handlers) {
        handler(safeEvent);
      }
    });
    socket.on("conversations:message:reaction", (event: ConversationReactionEvent) => {
      const safeEvent: ConversationReactionEvent = {
        conversationId: event?.conversationId ?? "",
        messageId: event?.messageId ?? "",
        reactions: Array.isArray(event?.reactions) ? event.reactions : [],
      };
      for (const handler of this.reactionHandlers) {
        handler(safeEvent);
      }
    });
    socket.on("conversations:presence:delta", (event: ConversationPresenceDeltaEvent) => {
      if (!event || typeof event.userId !== "string") return;
      for (const handler of this.presenceHandlers) {
        handler({
          userId: event.userId,
          online: event.online === true,
        });
      }
    });
    socket.on("connect", () => {
      if (this.activeConversationId) {
        socket.emit("conversations:join", { conversationId: this.activeConversationId });
      }
    });
    this.socket = socket;
  }

  /** Cierra socket y olvida el hilo activo (p. ej. logout). */
  disconnect(): void {
    this.activeConversationId = null;
    this.tearDownSocket();
    this.apiBase = null;
  }

  joinConversation(conversationId: string): void {
    this.activeConversationId = conversationId;
    if (typeof window !== "undefined") {
      const bridge = (window as unknown as { __DESKTOP__?: { setChatAttentionFlash?: (v: boolean) => void } })
        .__DESKTOP__;
      if (bridge?.setChatAttentionFlash) {
        void bridge.setChatAttentionFlash(false);
      }
    }
    if (!this.socket || !conversationId) return;
    this.socket.emit("conversations:join", { conversationId });
  }

  /** Hilo con `joinConversation` activo (vista conversaciones con un chat abierto). */
  getActiveJoinedConversationId(): string | null {
    return this.activeConversationId;
  }

  leaveConversation(conversationId: string): void {
    if (this.activeConversationId === conversationId) {
      this.activeConversationId = null;
    }
    if (!this.socket || !conversationId) return;
    this.socket.emit("conversations:leave", { conversationId });
  }

  onMessageNew(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  onReaction(handler: ReactionHandler): () => void {
    this.reactionHandlers.add(handler);
    return () => {
      this.reactionHandlers.delete(handler);
    };
  }

  onPresenceDelta(handler: PresenceDeltaHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => {
      this.presenceHandlers.delete(handler);
    };
  }
}

export const conversationsRealtime = new ConversationsRealtimeClient();

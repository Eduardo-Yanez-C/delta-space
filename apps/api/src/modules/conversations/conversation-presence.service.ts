import { Injectable } from "@nestjs/common";

/**
 * Presencia en memoria: usuarios con al menos un socket conectado al namespace
 * `/conversations` en este proceso (un nodo API). Sin replicación multi-nodo.
 */
@Injectable()
export class ConversationPresenceService {
  private readonly socketIdsByUser = new Map<string, Set<string>>();
  private readonly userIdBySocketId = new Map<string, string>();

  /** @returns true si pasa a haber presencia (primer socket de ese usuario en este nodo). */
  addConnection(userId: string, socketId: string): boolean {
    const wasPresent = this.isUserPresent(userId);
    let set = this.socketIdsByUser.get(userId);
    if (!set) {
      set = new Set();
      this.socketIdsByUser.set(userId, set);
    }
    set.add(socketId);
    this.userIdBySocketId.set(socketId, userId);
    return !wasPresent;
  }

  /** @returns userId si deja de tener presencia (último socket cerrado). */
  removeSocket(socketId: string): string | null {
    const userId = this.userIdBySocketId.get(socketId);
    if (!userId) return null;
    this.userIdBySocketId.delete(socketId);
    const set = this.socketIdsByUser.get(userId);
    if (!set) return null;
    set.delete(socketId);
    if (set.size === 0) {
      this.socketIdsByUser.delete(userId);
      return userId;
    }
    return null;
  }

  isUserPresent(userId: string): boolean {
    const n = this.socketIdsByUser.get(userId)?.size ?? 0;
    return n > 0;
  }

  /** Cantidad de sockets conectados para ese usuario en este proceso (diagnóstico). */
  getSocketCountForUser(userId: string): number {
    return this.socketIdsByUser.get(userId)?.size ?? 0;
  }

  /** UserIds con al menos un socket en este proceso (presencia agregada LAN vía mesh/presence). */
  getPresentUserIds(): string[] {
    return [...this.socketIdsByUser.keys()];
  }
}

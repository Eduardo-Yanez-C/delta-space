"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationPresenceService = void 0;
const common_1 = require("@nestjs/common");
/**
 * Presencia en memoria: usuarios con al menos un socket conectado al namespace
 * `/conversations` en este proceso (un nodo API). Sin replicación multi-nodo.
 */
let ConversationPresenceService = class ConversationPresenceService {
    constructor() {
        this.socketIdsByUser = new Map();
        this.userIdBySocketId = new Map();
    }
    /** @returns true si pasa a haber presencia (primer socket de ese usuario en este nodo). */
    addConnection(userId, socketId) {
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
    removeSocket(socketId) {
        const userId = this.userIdBySocketId.get(socketId);
        if (!userId)
            return null;
        this.userIdBySocketId.delete(socketId);
        const set = this.socketIdsByUser.get(userId);
        if (!set)
            return null;
        set.delete(socketId);
        if (set.size === 0) {
            this.socketIdsByUser.delete(userId);
            return userId;
        }
        return null;
    }
    isUserPresent(userId) {
        const n = this.socketIdsByUser.get(userId)?.size ?? 0;
        return n > 0;
    }
    /** Cantidad de sockets conectados para ese usuario en este proceso (diagnóstico). */
    getSocketCountForUser(userId) {
        return this.socketIdsByUser.get(userId)?.size ?? 0;
    }
    /** UserIds con al menos un socket en este proceso (presencia agregada LAN vía mesh/presence). */
    getPresentUserIds() {
        return [...this.socketIdsByUser.keys()];
    }
};
exports.ConversationPresenceService = ConversationPresenceService;
exports.ConversationPresenceService = ConversationPresenceService = __decorate([
    (0, common_1.Injectable)()
], ConversationPresenceService);

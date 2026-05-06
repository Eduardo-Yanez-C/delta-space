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
exports.P2pInternalController = void 0;
const common_1 = require("@nestjs/common");
const conversations_service_1 = require("./conversations.service");
const p2p_ingress_guard_1 = require("./p2p-ingress.guard");
let P2pInternalController = class P2pInternalController {
    constructor(conversations) {
        this.conversations = conversations;
    }
    async ingestChat(body) {
        return this.conversations.ingestP2pChatMessage(body);
    }
    async ingestPresence(body) {
        return this.conversations.ingestP2pPresence(body);
    }
    async outboundAck(body) {
        return this.conversations.applyP2pOutboundAck(body);
    }
    async syncSince(body) {
        return this.conversations.p2pSyncGetMessagesSince(body);
    }
    async fileOffer(body) {
        return this.conversations.ingestP2pFileOffer(body);
    }
    async fileProgress(body) {
        return this.conversations.ingestP2pFileProgress(body);
    }
    async fileComplete(body) {
        return this.conversations.ingestP2pFileComplete(body);
    }
};
exports.P2pInternalController = P2pInternalController;
__decorate([
    (0, common_1.Post)("chat-message"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "ingestChat", null);
__decorate([
    (0, common_1.Post)("presence"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "ingestPresence", null);
__decorate([
    (0, common_1.Post)("outbound-ack"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "outboundAck", null);
__decorate([
    (0, common_1.Post)("sync-since"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "syncSince", null);
__decorate([
    (0, common_1.Post)("file-offer"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "fileOffer", null);
__decorate([
    (0, common_1.Post)("file-progress"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "fileProgress", null);
__decorate([
    (0, common_1.Post)("file-complete"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], P2pInternalController.prototype, "fileComplete", null);
exports.P2pInternalController = P2pInternalController = __decorate([
    (0, common_1.Controller)("p2p/internal"),
    (0, common_1.UseGuards)(p2p_ingress_guard_1.P2pIngressGuard),
    __metadata("design:paramtypes", [conversations_service_1.ConversationsService])
], P2pInternalController);

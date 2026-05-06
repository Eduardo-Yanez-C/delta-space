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
exports.P2pUserController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const lan_p2p_bridge_service_1 = require("../lan-p2p-bridge/lan-p2p-bridge.service");
const conversations_service_1 = require("./conversations.service");
let P2pUserController = class P2pUserController {
    constructor(bridge, conversations) {
        this.bridge = bridge;
        this.conversations = conversations;
    }
    async localPeer() {
        return this.bridge.getLocalPeerIdJson();
    }
    async registerIdentity(req, body) {
        const user = req.user;
        if (!user?.id) {
            return { ok: false };
        }
        const peerId = (body.peerId ?? "").trim();
        const installationId = (body.installationId ?? "").trim();
        if (!peerId || !installationId) {
            return { ok: false, error: "peerId e installationId requeridos" };
        }
        await this.conversations.registerUserP2pIdentity({
            userId: user.id,
            peerId,
            installationId,
            displayName: body.displayName?.trim(),
        });
        return { ok: true };
    }
};
exports.P2pUserController = P2pUserController;
__decorate([
    (0, common_1.Get)("local-peer"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], P2pUserController.prototype, "localPeer", null);
__decorate([
    (0, common_1.Post)("register-identity"),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], P2pUserController.prototype, "registerIdentity", null);
exports.P2pUserController = P2pUserController = __decorate([
    (0, common_1.Controller)("p2p"),
    __metadata("design:paramtypes", [lan_p2p_bridge_service_1.LanP2pBridgeService,
        conversations_service_1.ConversationsService])
], P2pUserController);

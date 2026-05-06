"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const lan_module_1 = require("../lan/lan.module");
const conversations_controller_1 = require("./conversations.controller");
const conversations_mesh_controller_1 = require("./conversations-mesh.controller");
const conversation_presence_service_1 = require("./conversation-presence.service");
const conversations_gateway_1 = require("./conversations.gateway");
const conversations_service_1 = require("./conversations.service");
const lan_mesh_guard_1 = require("./lan-mesh.guard");
const p2p_internal_controller_1 = require("./p2p-internal.controller");
const p2p_ingress_guard_1 = require("./p2p-ingress.guard");
const p2p_user_controller_1 = require("./p2p-user.controller");
let ConversationsModule = class ConversationsModule {
};
exports.ConversationsModule = ConversationsModule;
exports.ConversationsModule = ConversationsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, lan_module_1.LanModule],
        controllers: [
            conversations_controller_1.ConversationsController,
            conversations_mesh_controller_1.ConversationsMeshController,
            p2p_internal_controller_1.P2pInternalController,
            p2p_user_controller_1.P2pUserController,
        ],
        providers: [
            lan_mesh_guard_1.LanMeshGuard,
            p2p_ingress_guard_1.P2pIngressGuard,
            conversation_presence_service_1.ConversationPresenceService,
            conversations_service_1.ConversationsService,
            conversations_gateway_1.ConversationsGateway,
        ],
        exports: [conversations_service_1.ConversationsService],
    })
], ConversationsModule);

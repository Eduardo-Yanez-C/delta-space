import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LanModule } from "../lan/lan.module";
import { ConversationsController } from "./conversations.controller";
import { ConversationsMeshController } from "./conversations-mesh.controller";
import { ConversationPresenceService } from "./conversation-presence.service";
import { ConversationsGateway } from "./conversations.gateway";
import { ConversationsService } from "./conversations.service";
import { LanMeshGuard } from "./lan-mesh.guard";
import { P2pInternalController } from "./p2p-internal.controller";
import { P2pIngressGuard } from "./p2p-ingress.guard";
import { P2pUserController } from "./p2p-user.controller";

@Module({
  imports: [AuthModule, LanModule],
  controllers: [
    ConversationsController,
    ConversationsMeshController,
    P2pInternalController,
    P2pUserController,
  ],
  providers: [
    LanMeshGuard,
    P2pIngressGuard,
    ConversationPresenceService,
    ConversationsService,
    ConversationsGateway,
  ],
  exports: [ConversationsService],
})
export class ConversationsModule {}

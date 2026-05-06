import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ConversationsService } from "./conversations.service";
import { P2pIngressGuard } from "./p2p-ingress.guard";

@Controller("p2p/internal")
@UseGuards(P2pIngressGuard)
export class P2pInternalController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post("chat-message")
  async ingestChat(@Body() body: Record<string, unknown>) {
    return this.conversations.ingestP2pChatMessage(body);
  }

  @Post("presence")
  async ingestPresence(@Body() body: Record<string, unknown>) {
    return this.conversations.ingestP2pPresence(body);
  }

  @Post("outbound-ack")
  async outboundAck(@Body() body: Record<string, unknown>) {
    return this.conversations.applyP2pOutboundAck(body);
  }

  @Post("sync-since")
  async syncSince(@Body() body: Record<string, unknown>) {
    return this.conversations.p2pSyncGetMessagesSince(body);
  }

  @Post("file-offer")
  async fileOffer(@Body() body: Record<string, unknown>) {
    return this.conversations.ingestP2pFileOffer(body);
  }

  @Post("file-progress")
  async fileProgress(@Body() body: Record<string, unknown>) {
    return this.conversations.ingestP2pFileProgress(body);
  }

  @Post("file-complete")
  async fileComplete(@Body() body: Record<string, unknown>) {
    return this.conversations.ingestP2pFileComplete(body);
  }
}

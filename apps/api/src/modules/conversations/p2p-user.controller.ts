import { Controller, Get, Post, Body, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LanP2pBridgeService } from "../lan-p2p-bridge/lan-p2p-bridge.service";
import { ConversationsService } from "./conversations.service";
import type { AuthUserPayload } from "../auth/auth.service";

type ReqWithUser = Request & { user?: AuthUserPayload };

@Controller("p2p")
export class P2pUserController {
  constructor(
    private readonly bridge: LanP2pBridgeService,
    private readonly conversations: ConversationsService,
  ) {}

  @Get("local-peer")
  @UseGuards(JwtAuthGuard)
  async localPeer() {
    return this.bridge.getLocalPeerIdJson();
  }

  @Post("register-identity")
  @UseGuards(JwtAuthGuard)
  async registerIdentity(
    @Req() req: ReqWithUser,
    @Body() body: { peerId?: string; installationId?: string; displayName?: string },
  ) {
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
}

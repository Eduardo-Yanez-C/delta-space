import { Global, Module } from "@nestjs/common";
import { LanP2pBridgeService } from "./lan-p2p-bridge.service";

@Global()
@Module({
  providers: [LanP2pBridgeService],
  exports: [LanP2pBridgeService],
})
export class LanP2pBridgeModule {}

import { Module } from "@nestjs/common";
import { LanDiscoveryService } from "./lan-discovery.service";
import { LanController } from "./lan.controller";

@Module({
  controllers: [LanController],
  providers: [LanDiscoveryService],
  exports: [LanDiscoveryService],
})
export class LanModule {}

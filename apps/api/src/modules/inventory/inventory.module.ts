import { Module } from "@nestjs/common";
import { TransportVariablesModule } from "../transport-variables/transport-variables.module";
import { InventoryBomExtractService } from "./inventory-bom-extract.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { TransportCommercialController } from "./transport-commercial.controller";
import { TransportCommercialService } from "./transport-commercial.service";
import { TransportTripCommercialController } from "./transport-trip-commercial.controller";
import { TransportTripCommercialService } from "./transport-trip-commercial.service";

@Module({
  imports: [TransportVariablesModule],
  controllers: [InventoryController, TransportCommercialController, TransportTripCommercialController],
  providers: [InventoryService, InventoryBomExtractService, TransportCommercialService, TransportTripCommercialService],
  exports: [InventoryService, InventoryBomExtractService, TransportCommercialService, TransportTripCommercialService],
})
export class InventoryModule {}

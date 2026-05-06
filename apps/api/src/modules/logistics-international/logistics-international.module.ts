import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { LogisticsInternationalController } from "./logistics-international.controller";
import { LogisticsInternationalService } from "./logistics-international.service";

@Module({
  imports: [InventoryModule],
  controllers: [LogisticsInternationalController],
  providers: [LogisticsInternationalService],
})
export class LogisticsInternationalModule {}

import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { TransportContractsController } from "./transport-contracts.controller";
import { TransportContractsService } from "./transport-contracts.service";

@Module({
  imports: [PrismaModule],
  controllers: [TransportContractsController],
  providers: [TransportContractsService],
  exports: [TransportContractsService],
})
export class TransportContractsModule {}

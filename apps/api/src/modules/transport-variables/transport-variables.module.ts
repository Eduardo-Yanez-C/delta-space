import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { TransportVariablesController } from "./transport-variables.controller";
import { TransportVariablesService } from "./transport-variables.service";

@Module({
  imports: [PrismaModule],
  controllers: [TransportVariablesController],
  providers: [TransportVariablesService],
  exports: [TransportVariablesService],
})
export class TransportVariablesModule {}

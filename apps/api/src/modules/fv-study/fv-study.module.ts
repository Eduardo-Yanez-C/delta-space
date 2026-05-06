import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { QuotesModule } from "../quotes/quotes.module";
import { FvStudyController } from "./fv-study.controller";
import { FvStudyService } from "./fv-study.service";
import { SolarExplorerService } from "./solar-explorer.service";

@Module({
  imports: [PrismaModule, QuotesModule],
  controllers: [FvStudyController],
  providers: [FvStudyService, SolarExplorerService],
  exports: [FvStudyService],
})
export class FvStudyModule {}

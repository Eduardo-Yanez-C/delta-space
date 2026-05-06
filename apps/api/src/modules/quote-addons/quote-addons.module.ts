import { Module } from "@nestjs/common";
import { QuoteAddOnsController } from "./quote-addons.controller";
import { QuoteAddOnsService } from "./quote-addons.service";

@Module({
  controllers: [QuoteAddOnsController],
  providers: [QuoteAddOnsService],
  exports: [QuoteAddOnsService],
})
export class QuoteAddOnsModule {}

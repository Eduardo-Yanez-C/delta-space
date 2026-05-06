import { Module } from "@nestjs/common";
import { QuoteTemplatesController } from "./quote-templates.controller";
import { QuoteTemplatesService } from "./quote-templates.service";
import { QuotesModule } from "../quotes/quotes.module";

@Module({
  imports: [QuotesModule],
  controllers: [QuoteTemplatesController],
  providers: [QuoteTemplatesService],
  exports: [QuoteTemplatesService],
})
export class QuoteTemplatesModule {}

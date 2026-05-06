import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infra/prisma/prisma.module";
import { QuoteAddOnsModule } from "../quote-addons/quote-addons.module";
import { CompanyProfileModule } from "../company-profile/company-profile.module";
import { QuoteDocumentCompanyProfileController } from "./quote-document-company-profile.controller";
import { QuotesController } from "./quotes.controller";
import { QuotesService } from "./quotes.service";
import { QuoteVersionsController } from "./versions/quote-versions.controller";
import { QuoteVersionsService } from "./versions/quote-versions.service";
import { QuoteItemsController } from "./items/quote-items.controller";
import { QuoteItemsService } from "./items/quote-items.service";
import { QuoteMainItemsController } from "./main-items/quote-main-items.controller";
import { QuoteMainItemsService } from "./main-items/quote-main-items.service";
import { MarginHierarchyController } from "./margin-hierarchy/margin-hierarchy.controller";
import { MarginHierarchyService } from "./margin-hierarchy/margin-hierarchy.service";
import { MarginSnapshotsController } from "./margin-snapshots/margin-snapshots.controller";
import { MarginSnapshotsQuoteController } from "./margin-snapshots/margin-snapshots-quote.controller";
import { MarginSnapshotsService } from "./margin-snapshots/margin-snapshots.service";
import { TechnicalValidationsService } from "./technical-validations/technical-validations.service";

/**
 * Paridad cercana a dist para cotizaciones, versiones, ítems, jerarquía MARGIN, snapshots y documento.
 */
@Module({
  imports: [PrismaModule, QuoteAddOnsModule, CompanyProfileModule],
  controllers: [
    QuoteDocumentCompanyProfileController,
    QuotesController,
    QuoteVersionsController,
    QuoteItemsController,
    QuoteMainItemsController,
    MarginHierarchyController,
    MarginSnapshotsController,
    MarginSnapshotsQuoteController,
  ],
  providers: [
    QuotesService,
    QuoteVersionsService,
    QuoteItemsService,
    QuoteMainItemsService,
    MarginHierarchyService,
    MarginSnapshotsService,
    TechnicalValidationsService,
  ],
  exports: [QuotesService, QuoteVersionsService],
})
export class QuotesModule {}

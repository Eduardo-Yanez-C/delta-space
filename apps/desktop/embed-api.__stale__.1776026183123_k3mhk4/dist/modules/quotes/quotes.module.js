"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotesModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../../infra/prisma/prisma.module");
const quote_addons_module_1 = require("../quote-addons/quote-addons.module");
const company_profile_module_1 = require("../company-profile/company-profile.module");
const quote_document_company_profile_controller_1 = require("./quote-document-company-profile.controller");
const quotes_controller_1 = require("./quotes.controller");
const quotes_service_1 = require("./quotes.service");
const quote_versions_controller_1 = require("./versions/quote-versions.controller");
const quote_versions_service_1 = require("./versions/quote-versions.service");
const quote_items_controller_1 = require("./items/quote-items.controller");
const quote_items_service_1 = require("./items/quote-items.service");
const quote_main_items_controller_1 = require("./main-items/quote-main-items.controller");
const quote_main_items_service_1 = require("./main-items/quote-main-items.service");
const margin_hierarchy_controller_1 = require("./margin-hierarchy/margin-hierarchy.controller");
const margin_hierarchy_service_1 = require("./margin-hierarchy/margin-hierarchy.service");
const margin_snapshots_controller_1 = require("./margin-snapshots/margin-snapshots.controller");
const margin_snapshots_quote_controller_1 = require("./margin-snapshots/margin-snapshots-quote.controller");
const margin_snapshots_service_1 = require("./margin-snapshots/margin-snapshots.service");
const technical_validations_service_1 = require("./technical-validations/technical-validations.service");
/**
 * Paridad cercana a dist para cotizaciones, versiones, ítems, jerarquía MARGIN, snapshots y documento.
 */
let QuotesModule = class QuotesModule {
};
exports.QuotesModule = QuotesModule;
exports.QuotesModule = QuotesModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, quote_addons_module_1.QuoteAddOnsModule, company_profile_module_1.CompanyProfileModule],
        controllers: [
            quote_document_company_profile_controller_1.QuoteDocumentCompanyProfileController,
            quotes_controller_1.QuotesController,
            quote_versions_controller_1.QuoteVersionsController,
            quote_items_controller_1.QuoteItemsController,
            quote_main_items_controller_1.QuoteMainItemsController,
            margin_hierarchy_controller_1.MarginHierarchyController,
            margin_snapshots_controller_1.MarginSnapshotsController,
            margin_snapshots_quote_controller_1.MarginSnapshotsQuoteController,
        ],
        providers: [
            quotes_service_1.QuotesService,
            quote_versions_service_1.QuoteVersionsService,
            quote_items_service_1.QuoteItemsService,
            quote_main_items_service_1.QuoteMainItemsService,
            margin_hierarchy_service_1.MarginHierarchyService,
            margin_snapshots_service_1.MarginSnapshotsService,
            technical_validations_service_1.TechnicalValidationsService,
        ],
        exports: [quotes_service_1.QuotesService, quote_versions_service_1.QuoteVersionsService],
    })
], QuotesModule);

"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("./infra/prisma/prisma.module");
const auth_module_1 = require("./modules/auth/auth.module");
const dashboard_module_1 = require("./modules/dashboard/dashboard.module");
const brands_module_1 = require("./modules/brands/brands.module");
const categories_module_1 = require("./modules/categories/categories.module");
const clients_module_1 = require("./modules/clients/clients.module");
const prices_module_1 = require("./modules/prices/prices.module");
const product_models_module_1 = require("./modules/product-models/product-models.module");
const quotes_module_1 = require("./modules/quotes/quotes.module");
const fv_calculation_module_1 = require("./modules/fv-calculation/fv-calculation.module");
const fv_study_module_1 = require("./modules/fv-study/fv-study.module");
const health_module_1 = require("./modules/health/health.module");
const installations_module_1 = require("./modules/installations/installations.module");
const implantation_design_module_1 = require("./modules/implantation-design/implantation-design.module");
const products_module_1 = require("./modules/products/products.module");
const quote_addons_module_1 = require("./modules/quote-addons/quote-addons.module");
const quote_templates_module_1 = require("./modules/quote-templates/quote-templates.module");
const company_profile_module_1 = require("./modules/company-profile/company-profile.module");
const suppliers_module_1 = require("./modules/suppliers/suppliers.module");
const users_module_1 = require("./modules/users/users.module");
const on_premise_license_module_1 = require("./modules/on-premise-license/on-premise-license.module");
const conversations_module_1 = require("./modules/conversations/conversations.module");
const desktop_developer_license_module_1 = require("./modules/desktop-developer-license/desktop-developer-license.module");
const lan_module_1 = require("./modules/lan/lan.module");
const lan_p2p_bridge_module_1 = require("./modules/lan-p2p-bridge/lan-p2p-bridge.module");
const admin_data_cleanup_module_1 = require("./modules/admin-data-cleanup/admin-data-cleanup.module");
const commercial_performance_module_1 = require("./modules/commercial-performance/commercial-performance.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                // Misma precedencia que Electron (license/embedded-hmac.js): env.embedded domina sobre .env
                // para claves duplicadas (p. ej. LICENSE_HMAC_SECRET). Así Nest y el main process leen el mismo valor.
                envFilePath: ["env.embedded", ".env"],
            }),
            prisma_module_1.PrismaModule,
            on_premise_license_module_1.OnPremiseLicenseModule,
            desktop_developer_license_module_1.DesktopDeveloperLicenseModule,
            conversations_module_1.ConversationsModule,
            health_module_1.HealthModule,
            lan_module_1.LanModule,
            lan_p2p_bridge_module_1.LanP2pBridgeModule,
            installations_module_1.InstallationsModule,
            auth_module_1.AuthModule,
            dashboard_module_1.DashboardModule,
            users_module_1.UsersModule,
            clients_module_1.ClientsModule,
            categories_module_1.CategoriesModule,
            brands_module_1.BrandsModule,
            product_models_module_1.ProductModelsModule,
            suppliers_module_1.SuppliersModule,
            products_module_1.ProductsModule,
            prices_module_1.PricesModule,
            quotes_module_1.QuotesModule,
            fv_calculation_module_1.FvCalculationModule,
            implantation_design_module_1.ImplantationDesignModule,
            fv_study_module_1.FvStudyModule,
            quote_templates_module_1.QuoteTemplatesModule,
            quote_addons_module_1.QuoteAddOnsModule,
            company_profile_module_1.CompanyProfileModule,
            admin_data_cleanup_module_1.AdminDataCleanupModule,
            commercial_performance_module_1.CommercialPerformanceModule,
        ],
    })
], AppModule);

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ObjectStorageModule } from "./infra/object-storage/object-storage.module";
import { PrismaModule } from "./infra/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { BrandsModule } from "./modules/brands/brands.module";
import { CategoriesModule } from "./modules/categories/categories.module";
import { ClientsModule } from "./modules/clients/clients.module";
import { PricesModule } from "./modules/prices/prices.module";
import { ProductModelsModule } from "./modules/product-models/product-models.module";
import { QuotesModule } from "./modules/quotes/quotes.module";
import { FvCalculationModule } from "./modules/fv-calculation/fv-calculation.module";
import { FvStudyModule } from "./modules/fv-study/fv-study.module";
import { HealthModule } from "./modules/health/health.module";
import { InstallationsModule } from "./modules/installations/installations.module";
import { ImplantationDesignModule } from "./modules/implantation-design/implantation-design.module";
import { ProductsModule } from "./modules/products/products.module";
import { QuoteAddOnsModule } from "./modules/quote-addons/quote-addons.module";
import { QuoteTemplatesModule } from "./modules/quote-templates/quote-templates.module";
import { CompanyProfileModule } from "./modules/company-profile/company-profile.module";
import { SuppliersModule } from "./modules/suppliers/suppliers.module";
import { UsersModule } from "./modules/users/users.module";
import { OnPremiseLicenseModule } from "./modules/on-premise-license/on-premise-license.module";
import { ConversationsModule } from "./modules/conversations/conversations.module";
import { DesktopDeveloperLicenseModule } from "./modules/desktop-developer-license/desktop-developer-license.module";
import { LanModule } from "./modules/lan/lan.module";
import { LanP2pBridgeModule } from "./modules/lan-p2p-bridge/lan-p2p-bridge.module";
import { AdminDataCleanupModule } from "./modules/admin-data-cleanup/admin-data-cleanup.module";
import { CommercialPerformanceModule } from "./modules/commercial-performance/commercial-performance.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { TasksModule } from "./modules/tasks/tasks.module";
import { RisksModule } from "./modules/risks/risks.module";
import { SuiteAgentModule } from "./modules/suite-agent/suite-agent.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { LogisticsInternationalModule } from "./modules/logistics-international/logistics-international.module";
import { TransportContractsModule } from "./modules/transport-contracts/transport-contracts.module";
import { TransportVariablesModule } from "./modules/transport-variables/transport-variables.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Misma precedencia que Electron (license/embedded-hmac.js): env.embedded domina sobre .env
      // para claves duplicadas (p. ej. LICENSE_HMAC_SECRET). Así Nest y el main process leen el mismo valor.
      envFilePath: ["env.embedded", ".env"],
    }),
    PrismaModule,
    ObjectStorageModule,
    OnPremiseLicenseModule,
    DesktopDeveloperLicenseModule,
    ConversationsModule,
    HealthModule,
    LanModule,
    LanP2pBridgeModule,
    InstallationsModule,
    AuthModule,
    DashboardModule,
    UsersModule,
    ClientsModule,
    CategoriesModule,
    BrandsModule,
    ProductModelsModule,
    SuppliersModule,
    ProductsModule,
    PricesModule,
    QuotesModule,
    FvCalculationModule,
    ImplantationDesignModule,
    FvStudyModule,
    QuoteTemplatesModule,
    QuoteAddOnsModule,
    CompanyProfileModule,
    AdminDataCleanupModule,
    CommercialPerformanceModule,
    OrganizationModule,
    ProjectsModule,
    TasksModule,
    RisksModule,
    SuiteAgentModule,
    InventoryModule,
    LogisticsInternationalModule,
    TransportContractsModule,
    TransportVariablesModule,
  ],
})
export class AppModule {}

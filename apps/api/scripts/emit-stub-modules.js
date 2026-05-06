const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const src = path.join(root, "src/modules");

const stubs = [
  ["dashboard/dashboard.module.ts", "DashboardModule"],
  ["brands/brands.module.ts", "BrandsModule"],
  ["categories/categories.module.ts", "CategoriesModule"],
  ["clients/clients.module.ts", "ClientsModule"],
  ["prices/prices.module.ts", "PricesModule"],
  ["product-models/product-models.module.ts", "ProductModelsModule"],
  ["fv-calculation/fv-calculation.module.ts", "FvCalculationModule"],
  ["health/health.module.ts", "HealthModule"],
  ["installations/installations.module.ts", "InstallationsModule"],
  ["products/products.module.ts", "ProductsModule"],
  ["quote-addons/quote-addons.module.ts", "QuoteAddOnsModule"],
  ["quote-templates/quote-templates.module.ts", "QuoteTemplatesModule"],
  ["company-profile/company-profile.module.ts", "CompanyProfileModule"],
  ["suppliers/suppliers.module.ts", "SuppliersModule"],
  ["users/users.module.ts", "UsersModule"],
  ["on-premise-license/on-premise-license.module.ts", "OnPremiseLicenseModule"],
  ["conversations/conversations.module.ts", "ConversationsModule"],
  ["desktop-developer-license/desktop-developer-license.module.ts", "DesktopDeveloperLicenseModule"],
];

const tpl = (name) => `import { Module } from "@nestjs/common";

/** Stub: reconstrucción pendiente desde dist (paralelo; no usado mientras se ejecuta dist/). */
@Module({ imports: [], controllers: [], providers: [], exports: [] })
export class ${name} {}
`;

for (const [rel, className] of stubs) {
  const p = path.join(src, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, tpl(className), "utf8");
}
console.log("Stub modules ensured.");

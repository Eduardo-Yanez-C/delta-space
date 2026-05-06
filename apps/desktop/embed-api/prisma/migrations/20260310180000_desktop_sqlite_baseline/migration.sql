-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "fullName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    "lastReadAt" DATETIME,
    CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FvStudy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "referenceBillAmount" REAL,
    "referenceConsumptionKwh" REAL,
    "valorKwhConsumo" REAL NOT NULL,
    "valorKwhInyeccion" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "connectionType" TEXT NOT NULL,
    "tipoProyecto" TEXT NOT NULL,
    "systemType" TEXT DEFAULT 'ON_GRID',
    "potenciaSistemaKwp" REAL NOT NULL,
    "potenciaPorPanelWp" REAL NOT NULL,
    "coberturaDeseada" REAL NOT NULL,
    "hspDailyUsed" REAL NOT NULL,
    "performanceRatioUsed" REAL NOT NULL,
    "calculationMethodVersion" TEXT NOT NULL,
    "cantidadPaneles" INTEGER NOT NULL,
    "generacionAnualKwh" REAL NOT NULL,
    "ahorroAnual" REAL NOT NULL,
    "porcentajeAhorro" REAL NOT NULL,
    "pagoResidualAnual" REAL NOT NULL,
    "generationSource" TEXT NOT NULL DEFAULT 'INTERNAL',
    "solarResourceProvider" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "mountingType" TEXT,
    "tiltDegrees" REAL,
    "azimuthDegrees" REAL,
    "solarResourceRequestedAt" DATETIME,
    "solarResourceMetadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FvStudy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FvStudy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImplantationDesign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fvStudyId" TEXT NOT NULL,
    "centerLat" REAL NOT NULL,
    "centerLng" REAL NOT NULL,
    "zoom" INTEGER NOT NULL,
    "roofPolygonGeoJson" TEXT,
    "panelProductId" TEXT,
    "panelNameSnapshot" TEXT,
    "panelPowerWSnapshot" INTEGER,
    "panelWidthMmSnapshot" INTEGER,
    "panelLengthMmSnapshot" INTEGER,
    "panelOrientationMode" TEXT,
    "spacingHorizontalMm" INTEGER,
    "spacingVerticalMm" INTEGER,
    "screenshotUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImplantationDesign_fvStudyId_fkey" FOREIGN KEY ("fvStudyId") REFERENCES "FvStudy" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ImplantationDesign_panelProductId_fkey" FOREIGN KEY ("panelProductId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImplantationPanelPlacement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "implantationDesignId" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,
    "originLat" REAL NOT NULL,
    "originLng" REAL NOT NULL,
    "orientationDeg" REAL,
    "stringId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ImplantationPanelPlacement_implantationDesignId_fkey" FOREIGN KEY ("implantationDesignId") REFERENCES "ImplantationDesign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FvStudyMonth" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fvStudyId" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "consumptionKwh" REAL NOT NULL,
    "consumptionValue" REAL,
    "generationKwh" REAL NOT NULL,
    "generationValue" REAL,
    "savingsPercent" REAL,
    "estimatedPayment" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FvStudyMonth_fvStudyId_fkey" FOREIGN KEY ("fvStudyId") REFERENCES "FvStudy" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "city" TEXT,
    "defaultCurrency" TEXT,
    "supplyOrigin" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "paymentTerms" TEXT,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" INTEGER,
    CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,
    CONSTRAINT "ProductModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "internalCode" TEXT,
    "sku" TEXT,
    "technicalSheetUrl" TEXT,
    "realManufacturer" TEXT,
    "commercialStatus" TEXT NOT NULL DEFAULT 'ACTIVO',
    "defaultCurrency" TEXT,
    "unit" TEXT NOT NULL,
    "purchaseUnit" TEXT,
    "warranty" TEXT,
    "leadTimeDays" INTEGER,
    "stockReference" TEXT,
    "origin" TEXT,
    "internalNotes" TEXT,
    "connectionType" TEXT,
    "nominalVoltageV" INTEGER,
    "inverterType" TEXT,
    "isBatteryComponent" BOOLEAN,
    "technicalType" TEXT,
    "powerW" INTEGER,
    "maxCurrentA" REAL,
    "efficiencyPercent" REAL,
    "categoryId" INTEGER NOT NULL,
    "brandId" INTEGER,
    "brandNameFree" TEXT,
    "modelId" INTEGER,
    "modelNameFree" TEXT,
    "primarySupplierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_primarySupplierId_fkey" FOREIGN KEY ("primarySupplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductPanelSpecs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "powerW" INTEGER,
    "efficiencyPercent" REAL,
    "vmpV" REAL,
    "impA" REAL,
    "vocV" REAL,
    "iscA" REAL,
    "bifacialityPercent" REAL,
    "cellType" TEXT,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "weightKg" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductPanelSpecs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductInverterSpecs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "inverterType" TEXT,
    "powerAcW" INTEGER,
    "maxPvVoltageV" REAL,
    "startupVoltageV" REAL,
    "mpptVoltageMinV" REAL,
    "mpptVoltageMaxV" REAL,
    "maxDcCurrentA" REAL,
    "efficiencyPercent" REAL,
    "connectionType" TEXT,
    "ipRating" TEXT,
    "communication" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductInverterSpecs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductBatterySpecs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "capacityKwh" REAL,
    "nominalVoltageV" REAL,
    "maxChargeDischargePowerW" REAL,
    "chemistry" TEXT,
    "cycles" INTEGER,
    "weightKg" REAL,
    "dimensionsMm" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductBatterySpecs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductSupplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "moq" TEXT,
    "warranty" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSupplier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "price" DECIMAL NOT NULL,
    "cost" DECIMAL,
    "purchasePrice" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "priceListType" TEXT NOT NULL DEFAULT 'BASE',
    "validFrom" DATETIME NOT NULL,
    "validTo" DATETIME,
    "lastQuoteReceivedAt" DATETIME,
    "lastUpdatedAt" DATETIME,
    "suggestedMarginPercent" DECIMAL,
    "supplierDiscountPercent" DECIMAL,
    "logisticCostEstimate" DECIMAL,
    "customsCostEstimate" DECIMAL,
    "totalLandedCost" DECIMAL,
    "moq" TEXT,
    "warranty" TEXT,
    "quoteReference" TEXT,
    "quoteReceivedAt" DATETIME,
    "validityIndicator" TEXT,
    "internalCommercialNotes" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ProductPrice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceFvStudyId" TEXT,
    "suggestedItemsFromStudy" BOOLEAN NOT NULL DEFAULT false,
    "sourceQuoteTemplateId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'BORRADOR',
    "title" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "commercialSequence" INTEGER,
    "commercialNumber" TEXT,
    "internalNotes" TEXT,
    "clientNotes" TEXT,
    "currency" TEXT,
    "validUntil" DATETIME,
    "paymentTerms" TEXT,
    "deliveryDays" INTEGER,
    "commercialStage" TEXT,
    "leadNumber" TEXT,
    "salespersonId" TEXT,
    "quoteKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "technicalBasicsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Quote_sourceFvStudyId_fkey" FOREIGN KEY ("sourceFvStudyId") REFERENCES "FvStudy" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_sourceQuoteTemplateId_fkey" FOREIGN KEY ("sourceQuoteTemplateId") REFERENCES "QuoteTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Quote_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MarginTemplateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "sourceQuoteId" TEXT,
    "sourceQuoteVersionId" TEXT,
    "systemType" TEXT,
    "mountStructureType" TEXT,
    "schemaVersion" TEXT NOT NULL DEFAULT '1',
    "payloadJson" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarginTemplateSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "subtotal" DECIMAL NOT NULL,
    "discountsTotal" DECIMAL NOT NULL,
    "marginTotal" DECIMAL NOT NULL,
    "taxesTotal" DECIMAL NOT NULL,
    "total" DECIMAL NOT NULL,
    "globalDiscountPercent" DECIMAL,
    "globalMarginPercent" DECIMAL,
    "vatPercent" DECIMAL NOT NULL,
    "createdById" TEXT NOT NULL,
    "fvSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuoteVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteFvCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "quoteVersionId" TEXT,
    "consumoMensualKwh" REAL NOT NULL,
    "consumoAnualKwh" REAL,
    "cuentaMensual" REAL NOT NULL,
    "valorKwhConsumo" REAL NOT NULL,
    "valorKwhInyeccion" REAL NOT NULL,
    "coberturaDeseada" REAL NOT NULL,
    "tipoProyecto" TEXT NOT NULL,
    "potenciaObjetivoKwp" REAL,
    "potenciaPorPanelWp" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "hspDailyUsed" REAL NOT NULL,
    "performanceRatioUsed" REAL NOT NULL,
    "calculationMethodVersion" TEXT NOT NULL,
    "plantaKwp" REAL NOT NULL,
    "cantidadPaneles" INTEGER NOT NULL,
    "generacionAnualKwh" REAL NOT NULL,
    "generacionMensualKwh" REAL NOT NULL,
    "ahorroMensual" REAL NOT NULL,
    "ahorroAnual" REAL NOT NULL,
    "porcentajeAhorro" REAL NOT NULL,
    "pagoResidual" REAL NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteFvCalculation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteFvCalculation_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteFvCalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteVersionId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "modelId" INTEGER,
    "productNameSnapshot" TEXT NOT NULL,
    "productDescriptionSnapshot" TEXT,
    "categoryNameSnapshot" TEXT,
    "brandNameSnapshot" TEXT,
    "modelNameSnapshot" TEXT,
    "currencySnapshot" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL NOT NULL,
    "unitCostSnapshot" DECIMAL,
    "discountPercentSnapshot" DECIMAL,
    "marginPercentSnapshot" DECIMAL,
    "quantity" DECIMAL NOT NULL,
    "lineTotalSnapshot" DECIMAL NOT NULL,
    "configSnapshot" TEXT,
    "sortOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteItem_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteMainItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibleInFinalQuote" BOOLEAN NOT NULL DEFAULT true,
    "totalMode" TEXT NOT NULL,
    "totalOverride" DECIMAL,
    "sourceFromFvStudyKind" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteMainItem_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteItemLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteMainItemId" TEXT NOT NULL,
    "productId" TEXT,
    "categoryId" INTEGER,
    "brandId" INTEGER,
    "modelId" INTEGER,
    "productNameSnapshot" TEXT NOT NULL,
    "productDescriptionSnapshot" TEXT,
    "categoryNameSnapshot" TEXT,
    "brandNameSnapshot" TEXT,
    "modelNameSnapshot" TEXT,
    "currencySnapshot" TEXT NOT NULL,
    "unitPriceSnapshot" DECIMAL NOT NULL,
    "unitCostSnapshot" DECIMAL,
    "discountPercentSnapshot" DECIMAL,
    "marginPercentSnapshot" DECIMAL,
    "quantity" DECIMAL NOT NULL,
    "lineTotalSnapshot" DECIMAL NOT NULL,
    "configSnapshot" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibleInFinalQuote" BOOLEAN NOT NULL DEFAULT false,
    "addOnSuggestionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteItemLine_quoteMainItemId_fkey" FOREIGN KEY ("quoteMainItemId") REFERENCES "QuoteMainItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteItemLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteItemLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteItemLine_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteItemLine_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "quoteKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "systemType" TEXT NOT NULL,
    "targetPowerKwp" DECIMAL NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuoteTemplateItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "quantityRule" TEXT NOT NULL,
    "quantityFixed" INTEGER,
    "potenciaPorPanelWp" INTEGER,
    "productNameSnapshot" TEXT NOT NULL,
    "productDescriptionSnapshot" TEXT,
    "unitPriceDefault" DECIMAL DEFAULT 0,
    "visibleInFinalQuoteDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteTemplateItem_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "QuoteTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteTemplateLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteTemplateItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "productId" TEXT,
    "productNameSnapshot" TEXT,
    "productDescriptionSnapshot" TEXT,
    "quantityRule" TEXT NOT NULL,
    "quantityFixed" INTEGER,
    "potenciaPorPanelWp" INTEGER,
    "unitPriceDefault" DECIMAL DEFAULT 0,
    "currency" TEXT,
    "visibleInFinalQuoteDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteTemplateLine_quoteTemplateItemId_fkey" FOREIGN KEY ("quoteTemplateItemId") REFERENCES "QuoteTemplateItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteTemplateLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteAddOn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "conditionType" TEXT NOT NULL,
    "thresholdNumeric" DECIMAL,
    "inputKey" TEXT NOT NULL,
    "quantityRule" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceDefault" DECIMAL DEFAULT 0,
    "currency" TEXT,
    "applicationMode" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "QuoteAddOnInput" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteVersionId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "valueNumeric" DECIMAL,
    "valueText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteAddOnInput_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteAddOnSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteVersionId" TEXT NOT NULL,
    "quoteAddOnId" TEXT NOT NULL,
    "suggestedQuantity" DECIMAL NOT NULL,
    "suggestedUnitPrice" DECIMAL NOT NULL,
    "currency" TEXT,
    "status" TEXT NOT NULL,
    "quoteItemId" TEXT,
    "quoteItemLineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteAddOnSuggestion_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteAddOnSuggestion_quoteAddOnId_fkey" FOREIGN KEY ("quoteAddOnId") REFERENCES "QuoteAddOn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteAddOnSuggestion_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuoteAddOnSuggestion_quoteItemLineId_fkey" FOREIGN KEY ("quoteItemLineId") REFERENCES "QuoteItemLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activationCodeId" TEXT NOT NULL,
    "deviceName" TEXT,
    "machineFingerprint" TEXT,
    "installationToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" DATETIME,
    "notes" TEXT,
    "appVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installation_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "logoRelativePath" TEXT,
    "logoMimeType" TEXT,
    "commercialName" TEXT,
    "legalName" TEXT,
    "taxId" TEXT,
    "businessActivity" TEXT,
    "address" TEXT,
    "commune" TEXT,
    "region" TEXT,
    "country" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "bankName" TEXT,
    "accountType" TEXT,
    "accountNumber" TEXT,
    "accountHolderName" TEXT,
    "accountHolderTaxId" TEXT,
    "transferReceiptEmail" TEXT,
    "generalNotes" TEXT,
    "quoteNote" TEXT,
    "paymentTerms" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImplantationDesign_fvStudyId_key" ON "ImplantationDesign"("fvStudyId");

-- CreateIndex
CREATE UNIQUE INDEX "FvStudyMonth_fvStudyId_monthIndex_key" ON "FvStudyMonth"("fvStudyId", "monthIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductModel_brandId_name_key" ON "ProductModel"("brandId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPanelSpecs_productId_key" ON "ProductPanelSpecs"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductInverterSpecs_productId_key" ON "ProductInverterSpecs"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatterySpecs_productId_key" ON "ProductBatterySpecs"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSupplier_productId_supplierId_key" ON "ProductSupplier"("productId", "supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_commercialSequence_key" ON "Quote"("commercialSequence");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_commercialNumber_key" ON "Quote"("commercialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_quoteId_versionNumber_key" ON "QuoteVersion"("quoteId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteItemLine_addOnSuggestionId_key" ON "QuoteItemLine"("addOnSuggestionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAddOn_code_key" ON "QuoteAddOn"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAddOnInput_quoteVersionId_inputKey_key" ON "QuoteAddOnInput"("quoteVersionId", "inputKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAddOnSuggestion_quoteItemId_key" ON "QuoteAddOnSuggestion"("quoteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAddOnSuggestion_quoteItemLineId_key" ON "QuoteAddOnSuggestion"("quoteItemLineId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteAddOnSuggestion_quoteVersionId_quoteAddOnId_key" ON "QuoteAddOnSuggestion"("quoteVersionId", "quoteAddOnId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_installationToken_key" ON "Installation"("installationToken");


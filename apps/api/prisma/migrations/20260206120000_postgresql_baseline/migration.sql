-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "fullName" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "suiteNavGrants" TEXT,
    "suiteAgentMonthlyTokenLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiteAgentUsageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT NOT NULL DEFAULT '',
    "roundIndex" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SuiteAgentUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT '—',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "location" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "description" TEXT,
    "taskStatusConfig" TEXT,
    "logisticsTransportStatusConfig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "transportVariableProfileId" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'SITE',
    "label" TEXT NOT NULL,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogisticsInternationalSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "orderRef" TEXT,
    "sourceFileName" TEXT,
    "summaryJson" TEXT NOT NULL,
    "palletsJson" TEXT NOT NULL,
    "panelsJson" TEXT NOT NULL,
    "shipmentsJson" TEXT NOT NULL,
    "transportJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LogisticsInternationalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'unidad',
    "storageLocation" TEXT,
    "destinationKind" TEXT NOT NULL DEFAULT 'GENERAL',
    "destinationNote" TEXT,
    "projectId" TEXT,
    "quoteId" TEXT,
    "productId" TEXT,
    "linksJson" TEXT,
    "logisticsInternationalSnapshotId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsCode" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isMilestone" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "assignedTo" TEXT,
    "assigneeUserId" TEXT,
    "parentTaskId" TEXT,
    "dependencyTaskId" TEXT,
    "description" TEXT,
    "contextNote" TEXT,
    "customFields" TEXT,
    "activityLog" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "taskKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,
    "baselineStartDate" TIMESTAMP(3),
    "baselineEndDate" TIMESTAMP(3),
    "baselineDurationDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "predecessorTaskId" TEXT NOT NULL,
    "successorTaskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "criticality" TEXT NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCommercialLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "externalRef" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCommercialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDecision" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "decisionDate" TIMESTAMP(3) NOT NULL,
    "responsible" TEXT,
    "responsibleUserId" TEXT,
    "impact" TEXT NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "type" TEXT,
    "notes" TEXT,

    CONSTRAINT "ProjectDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "assignedProjectId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCommitment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "owner" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'MEETING',
    "decisionId" TEXT,
    "milestoneId" TEXT,
    "riskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Risk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "probability" TEXT NOT NULL,
    "mitigation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "owner" TEXT,
    "ownerUserId" TEXT,
    "dueDate" TIMESTAMP(3),
    "mrbMatrix" TEXT,
    "riskCategory" TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "matrixKind" TEXT NOT NULL DEFAULT 'MRB',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMember" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'TEXT',
    "metadataJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserP2pIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "displayName" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserP2pIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P2pMessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetPeerId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "lastError" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2pMessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "P2pFileTransfer" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "peerId" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OFFERED',
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256Hex" TEXT NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "localPath" TEXT,
    "receivedBytes" INTEGER NOT NULL DEFAULT 0,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "P2pFileTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageSharedEntity" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "proposedImportJson" TEXT NOT NULL,
    "sourceEntityId" TEXT,
    "sourceUserId" TEXT NOT NULL,
    "sourceUserName" TEXT NOT NULL,
    "sourceNodeName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageSharedEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedEntityImportDecision" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "receiverUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolutionMode" TEXT,
    "targetEntityId" TEXT,
    "errorMessage" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedEntityImportDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FvStudy" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "referenceMonth" INTEGER NOT NULL,
    "referenceBillAmount" DOUBLE PRECISION,
    "referenceConsumptionKwh" DOUBLE PRECISION,
    "valorKwhConsumo" DOUBLE PRECISION NOT NULL,
    "valorKwhInyeccion" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "connectionType" TEXT NOT NULL,
    "tipoProyecto" TEXT NOT NULL,
    "systemType" TEXT DEFAULT 'ON_GRID',
    "utilityGridAvailable" BOOLEAN NOT NULL DEFAULT true,
    "gridExportEnabled" BOOLEAN NOT NULL DEFAULT true,
    "potenciaSistemaKwp" DOUBLE PRECISION NOT NULL,
    "potenciaPorPanelWp" DOUBLE PRECISION NOT NULL,
    "coberturaDeseada" DOUBLE PRECISION NOT NULL,
    "hspDailyUsed" DOUBLE PRECISION NOT NULL,
    "performanceRatioUsed" DOUBLE PRECISION NOT NULL,
    "calculationMethodVersion" TEXT NOT NULL,
    "cantidadPaneles" INTEGER NOT NULL,
    "generacionAnualKwh" DOUBLE PRECISION NOT NULL,
    "ahorroAnual" DOUBLE PRECISION NOT NULL,
    "porcentajeAhorro" DOUBLE PRECISION NOT NULL,
    "pagoResidualAnual" DOUBLE PRECISION NOT NULL,
    "generationSource" TEXT NOT NULL DEFAULT 'INTERNAL',
    "solarResourceProvider" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "mountingType" TEXT,
    "tiltDegrees" DOUBLE PRECISION,
    "azimuthDegrees" DOUBLE PRECISION,
    "solarResourceRequestedAt" TIMESTAMP(3),
    "solarResourceMetadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FvStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplantationDesign" (
    "id" TEXT NOT NULL,
    "fvStudyId" TEXT NOT NULL,
    "centerLat" DOUBLE PRECISION NOT NULL,
    "centerLng" DOUBLE PRECISION NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplantationDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImplantationPanelPlacement" (
    "id" TEXT NOT NULL,
    "implantationDesignId" TEXT NOT NULL,
    "positionIndex" INTEGER NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "orientationDeg" DOUBLE PRECISION,
    "stringId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImplantationPanelPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FvStudyMonth" (
    "id" TEXT NOT NULL,
    "fvStudyId" TEXT NOT NULL,
    "monthIndex" INTEGER NOT NULL,
    "consumptionKwh" DOUBLE PRECISION NOT NULL,
    "consumptionValue" DOUBLE PRECISION,
    "generationKwh" DOUBLE PRECISION NOT NULL,
    "generationValue" DOUBLE PRECISION,
    "savingsPercent" DOUBLE PRECISION,
    "estimatedPayment" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FvStudyMonth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "taxId" TEXT,
    "giro" TEXT,
    "commercialAddress" TEXT,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportContract" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "projectId" TEXT,
    "title" TEXT NOT NULL,
    "contractNumber" TEXT,
    "clientLegalName" TEXT,
    "contractorLegalName" TEXT,
    "signedAt" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "jurisdiction" TEXT,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'CLP',
    "defaultVatPercent" DOUBLE PRECISION NOT NULL DEFAULT 19,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "transportVariableProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVariable" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "defaultUnit" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVariable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVariableProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVariableProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportVariableValue" (
    "id" TEXT NOT NULL,
    "variableId" TEXT NOT NULL,
    "profileId" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportVariableValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportContractVersion" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "label" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTariffItem" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "code" TEXT,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'OTHER',
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "taxMode" TEXT NOT NULL DEFAULT 'VAT_EXTRA',
    "legalRef" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "activeFrom" TIMESTAMP(3),
    "activeTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTariffItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTariffOverride" (
    "id" TEXT NOT NULL,
    "contractVersionId" TEXT NOT NULL,
    "baseTariffItemId" TEXT,
    "action" TEXT NOT NULL DEFAULT 'ADDITION',
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "unit" TEXT NOT NULL DEFAULT 'OTHER',
    "taxMode" TEXT NOT NULL DEFAULT 'VAT_EXTRA',
    "legalRef" TEXT,
    "reason" TEXT NOT NULL,
    "documentRef" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTariffOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportCommercialTariff" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "supplierId" TEXT,
    "label" TEXT NOT NULL,
    "originHint" TEXT,
    "destinationHint" TEXT,
    "baseAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "fuelAdjustmentPercent" DOUBLE PRECISION,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportCommercialTariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportGroupCommercial" (
    "id" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "palletId" TEXT,
    "tariffId" TEXT,
    "contractVersionId" TEXT,
    "templateBaseSnapshot" DOUBLE PRECISION,
    "fuelSurchargePercent" DOUBLE PRECISION,
    "agreedAmount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "manualPrice" BOOLEAN NOT NULL DEFAULT false,
    "commercialNotes" TEXT,
    "commercialStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportGroupCommercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTripCommercial" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL,
    "palletId" TEXT,
    "tripNumber" TEXT NOT NULL,
    "supplierId" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scenario" TEXT NOT NULL DEFAULT 'COMMERCIAL',
    "kmUsed" DOUBLE PRECISION,
    "litersUsed" DOUBLE PRECISION,
    "extraChargesNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "subtotal" DOUBLE PRECISION,
    "vatAmount" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "contractVersionId" TEXT,
    "variableProfileId" TEXT,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportTripCommercial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportTripCostLine" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "concept" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "sourceKind" TEXT NOT NULL,
    "sourceRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransportTripCostLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" INTEGER,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModel" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" INTEGER NOT NULL,

    CONSTRAINT "ProductModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
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
    "maxCurrentA" DOUBLE PRECISION,
    "efficiencyPercent" DOUBLE PRECISION,
    "categoryId" INTEGER NOT NULL,
    "brandId" INTEGER,
    "brandNameFree" TEXT,
    "modelId" INTEGER,
    "modelNameFree" TEXT,
    "primarySupplierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPanelSpecs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "powerW" INTEGER,
    "efficiencyPercent" DOUBLE PRECISION,
    "vmpV" DOUBLE PRECISION,
    "impA" DOUBLE PRECISION,
    "vocV" DOUBLE PRECISION,
    "iscA" DOUBLE PRECISION,
    "bifacialityPercent" DOUBLE PRECISION,
    "cellType" TEXT,
    "lengthMm" INTEGER,
    "widthMm" INTEGER,
    "heightMm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPanelSpecs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductInverterSpecs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inverterType" TEXT,
    "powerAcW" INTEGER,
    "maxPvVoltageV" DOUBLE PRECISION,
    "startupVoltageV" DOUBLE PRECISION,
    "mpptVoltageMinV" DOUBLE PRECISION,
    "mpptVoltageMaxV" DOUBLE PRECISION,
    "maxDcCurrentA" DOUBLE PRECISION,
    "efficiencyPercent" DOUBLE PRECISION,
    "connectionType" TEXT,
    "ipRating" TEXT,
    "communication" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductInverterSpecs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBatterySpecs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "capacityKwh" DOUBLE PRECISION,
    "nominalVoltageV" DOUBLE PRECISION,
    "maxChargeDischargePowerW" DOUBLE PRECISION,
    "chemistry" TEXT,
    "cycles" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "dimensionsMm" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBatterySpecs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSupplier" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "moq" TEXT,
    "warranty" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "supplierId" TEXT,
    "price" DECIMAL(65,30) NOT NULL,
    "cost" DECIMAL(65,30),
    "purchasePrice" DECIMAL(65,30),
    "currency" TEXT NOT NULL DEFAULT 'CLP',
    "priceListType" TEXT NOT NULL DEFAULT 'BASE',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "lastQuoteReceivedAt" TIMESTAMP(3),
    "lastUpdatedAt" TIMESTAMP(3),
    "suggestedMarginPercent" DECIMAL(65,30),
    "supplierDiscountPercent" DECIMAL(65,30),
    "logisticCostEstimate" DECIMAL(65,30),
    "customsCostEstimate" DECIMAL(65,30),
    "totalLandedCost" DECIMAL(65,30),
    "moq" TEXT,
    "warranty" TEXT,
    "quoteReference" TEXT,
    "quoteReceivedAt" TIMESTAMP(3),
    "validityIndicator" TEXT,
    "internalCommercialNotes" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
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
    "validUntil" TIMESTAMP(3),
    "paymentTerms" TEXT,
    "deliveryDays" INTEGER,
    "commercialStage" TEXT,
    "leadNumber" TEXT,
    "salespersonId" TEXT,
    "quoteKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "technicalBasicsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarginTemplateSnapshot" (
    "id" TEXT NOT NULL,
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarginTemplateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "subtotal" DECIMAL(65,30) NOT NULL,
    "discountsTotal" DECIMAL(65,30) NOT NULL,
    "marginTotal" DECIMAL(65,30) NOT NULL,
    "taxesTotal" DECIMAL(65,30) NOT NULL,
    "total" DECIMAL(65,30) NOT NULL,
    "globalDiscountPercent" DECIMAL(65,30),
    "globalMarginPercent" DECIMAL(65,30),
    "vatPercent" DECIMAL(65,30) NOT NULL,
    "createdById" TEXT NOT NULL,
    "fvSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteFvCalculation" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteVersionId" TEXT,
    "consumoMensualKwh" DOUBLE PRECISION NOT NULL,
    "consumoAnualKwh" DOUBLE PRECISION,
    "cuentaMensual" DOUBLE PRECISION NOT NULL,
    "valorKwhConsumo" DOUBLE PRECISION NOT NULL,
    "valorKwhInyeccion" DOUBLE PRECISION NOT NULL,
    "coberturaDeseada" DOUBLE PRECISION NOT NULL,
    "tipoProyecto" TEXT NOT NULL,
    "potenciaObjetivoKwp" DOUBLE PRECISION,
    "potenciaPorPanelWp" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "hspDailyUsed" DOUBLE PRECISION NOT NULL,
    "performanceRatioUsed" DOUBLE PRECISION NOT NULL,
    "calculationMethodVersion" TEXT NOT NULL,
    "plantaKwp" DOUBLE PRECISION NOT NULL,
    "cantidadPaneles" INTEGER NOT NULL,
    "generacionAnualKwh" DOUBLE PRECISION NOT NULL,
    "generacionMensualKwh" DOUBLE PRECISION NOT NULL,
    "ahorroMensual" DOUBLE PRECISION NOT NULL,
    "ahorroAnual" DOUBLE PRECISION NOT NULL,
    "porcentajeAhorro" DOUBLE PRECISION NOT NULL,
    "pagoResidual" DOUBLE PRECISION NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteFvCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
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
    "unitPriceSnapshot" DECIMAL(65,30) NOT NULL,
    "unitCostSnapshot" DECIMAL(65,30),
    "discountPercentSnapshot" DECIMAL(65,30),
    "marginPercentSnapshot" DECIMAL(65,30),
    "quantity" DECIMAL(65,30) NOT NULL,
    "lineTotalSnapshot" DECIMAL(65,30) NOT NULL,
    "configSnapshot" TEXT,
    "sortOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteMainItem" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibleInFinalQuote" BOOLEAN NOT NULL DEFAULT true,
    "totalMode" TEXT NOT NULL,
    "totalOverride" DECIMAL(65,30),
    "sourceFromFvStudyKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteMainItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItemLine" (
    "id" TEXT NOT NULL,
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
    "unitPriceSnapshot" DECIMAL(65,30) NOT NULL,
    "unitCostSnapshot" DECIMAL(65,30),
    "discountPercentSnapshot" DECIMAL(65,30),
    "marginPercentSnapshot" DECIMAL(65,30),
    "quantity" DECIMAL(65,30) NOT NULL,
    "lineTotalSnapshot" DECIMAL(65,30) NOT NULL,
    "configSnapshot" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "visibleInFinalQuote" BOOLEAN NOT NULL DEFAULT false,
    "addOnSuggestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItemLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quoteKind" TEXT NOT NULL DEFAULT 'STANDARD',
    "systemType" TEXT NOT NULL,
    "targetPowerKwp" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateItem" (
    "id" TEXT NOT NULL,
    "quoteTemplateId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "itemType" TEXT NOT NULL,
    "quantityRule" TEXT NOT NULL,
    "quantityFixed" INTEGER,
    "potenciaPorPanelWp" INTEGER,
    "productNameSnapshot" TEXT NOT NULL,
    "productDescriptionSnapshot" TEXT,
    "unitPriceDefault" DECIMAL(65,30) DEFAULT 0,
    "visibleInFinalQuoteDefault" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateLine" (
    "id" TEXT NOT NULL,
    "quoteTemplateItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "productId" TEXT,
    "productNameSnapshot" TEXT,
    "productDescriptionSnapshot" TEXT,
    "quantityRule" TEXT NOT NULL,
    "quantityFixed" INTEGER,
    "potenciaPorPanelWp" INTEGER,
    "unitPriceDefault" DECIMAL(65,30) DEFAULT 0,
    "currency" TEXT,
    "visibleInFinalQuoteDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAddOn" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "conditionType" TEXT NOT NULL,
    "thresholdNumeric" DECIMAL(65,30),
    "inputKey" TEXT NOT NULL,
    "quantityRule" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPriceDefault" DECIMAL(65,30) DEFAULT 0,
    "currency" TEXT,
    "applicationMode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAddOnInput" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "valueNumeric" DECIMAL(65,30),
    "valueText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteAddOnInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteAddOnSuggestion" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "quoteAddOnId" TEXT NOT NULL,
    "suggestedQuantity" DECIMAL(65,30) NOT NULL,
    "suggestedUnitPrice" DECIMAL(65,30) NOT NULL,
    "currency" TEXT,
    "status" TEXT NOT NULL,
    "quoteItemId" TEXT,
    "quoteItemLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteAddOnSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "maxActivations" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL,
    "activationCodeId" TEXT NOT NULL,
    "deviceName" TEXT,
    "machineFingerprint" TEXT,
    "installationToken" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "notes" TEXT,
    "appVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationNode" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "category" TEXT,
    "parentId" TEXT,
    "linkToId" TEXT,
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "OrganizationNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationCustomEdge" (
    "id" TEXT NOT NULL,
    "fromNodeId" TEXT NOT NULL,
    "toNodeId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "strokeWidth" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "dashPattern" TEXT,
    "midOffsetX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "midOffsetY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationCustomEdge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SuiteAgentUsageLog_userId_createdAt_idx" ON "SuiteAgentUsageLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "Project"("code");

-- CreateIndex
CREATE INDEX "ProjectLocation_projectId_idx" ON "ProjectLocation"("projectId");

-- CreateIndex
CREATE INDEX "ProjectLocation_projectId_isPrimary_idx" ON "ProjectLocation"("projectId", "isPrimary");

-- CreateIndex
CREATE INDEX "LogisticsInternationalSnapshot_projectId_idx" ON "LogisticsInternationalSnapshot"("projectId");

-- CreateIndex
CREATE INDEX "LogisticsInternationalSnapshot_orderRef_idx" ON "LogisticsInternationalSnapshot"("orderRef");

-- CreateIndex
CREATE INDEX "InventoryItem_projectId_idx" ON "InventoryItem"("projectId");

-- CreateIndex
CREATE INDEX "InventoryItem_quoteId_idx" ON "InventoryItem"("quoteId");

-- CreateIndex
CREATE INDEX "InventoryItem_productId_idx" ON "InventoryItem"("productId");

-- CreateIndex
CREATE INDEX "InventoryItem_destinationKind_idx" ON "InventoryItem"("destinationKind");

-- CreateIndex
CREATE INDEX "InventoryItem_logisticsInternationalSnapshotId_idx" ON "InventoryItem"("logisticsInternationalSnapshotId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");

-- CreateIndex
CREATE INDEX "Task_dependencyTaskId_idx" ON "Task"("dependencyTaskId");

-- CreateIndex
CREATE INDEX "Task_projectId_sortOrder_idx" ON "Task"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "Task_assigneeUserId_idx" ON "Task"("assigneeUserId");

-- CreateIndex
CREATE INDEX "TaskDependency_projectId_idx" ON "TaskDependency"("projectId");

-- CreateIndex
CREATE INDEX "TaskDependency_successorTaskId_idx" ON "TaskDependency"("successorTaskId");

-- CreateIndex
CREATE INDEX "TaskDependency_predecessorTaskId_idx" ON "TaskDependency"("predecessorTaskId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDependency_predecessorTaskId_successorTaskId_key" ON "TaskDependency"("predecessorTaskId", "successorTaskId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");

-- CreateIndex
CREATE INDEX "Milestone_projectId_plannedDate_idx" ON "Milestone"("projectId", "plannedDate");

-- CreateIndex
CREATE INDEX "ProjectCommercialLink_projectId_idx" ON "ProjectCommercialLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDecision_projectId_idx" ON "ProjectDecision"("projectId");

-- CreateIndex
CREATE INDEX "ProjectDecision_responsibleUserId_idx" ON "ProjectDecision"("responsibleUserId");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectResource_assignedProjectId_idx" ON "ProjectResource"("assignedProjectId");

-- CreateIndex
CREATE INDEX "ProjectResource_type_idx" ON "ProjectResource"("type");

-- CreateIndex
CREATE INDEX "ProjectCommitment_projectId_idx" ON "ProjectCommitment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCommitment_projectId_dueDate_idx" ON "ProjectCommitment"("projectId", "dueDate");

-- CreateIndex
CREATE INDEX "ProjectCommitment_projectId_status_idx" ON "ProjectCommitment"("projectId", "status");

-- CreateIndex
CREATE INDEX "Risk_projectId_idx" ON "Risk"("projectId");

-- CreateIndex
CREATE INDEX "Risk_riskCategory_idx" ON "Risk"("riskCategory");

-- CreateIndex
CREATE INDEX "Risk_matrixKind_idx" ON "Risk"("matrixKind");

-- CreateIndex
CREATE INDEX "Risk_ownerUserId_idx" ON "Risk"("ownerUserId");

-- CreateIndex
CREATE INDEX "ConversationMember_userId_idx" ON "ConversationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationMember_conversationId_userId_key" ON "ConversationMember"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "UserP2pIdentity_peerId_idx" ON "UserP2pIdentity"("peerId");

-- CreateIndex
CREATE INDEX "UserP2pIdentity_userId_idx" ON "UserP2pIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserP2pIdentity_userId_installationId_key" ON "UserP2pIdentity"("userId", "installationId");

-- CreateIndex
CREATE INDEX "P2pMessageDelivery_messageId_idx" ON "P2pMessageDelivery"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "P2pMessageDelivery_messageId_targetUserId_key" ON "P2pMessageDelivery"("messageId", "targetUserId");

-- CreateIndex
CREATE UNIQUE INDEX "P2pFileTransfer_transferId_key" ON "P2pFileTransfer"("transferId");

-- CreateIndex
CREATE INDEX "P2pFileTransfer_conversationId_idx" ON "P2pFileTransfer"("conversationId");

-- CreateIndex
CREATE INDEX "P2pFileTransfer_peerId_idx" ON "P2pFileTransfer"("peerId");

-- CreateIndex
CREATE INDEX "MessageAttachment_messageId_idx" ON "MessageAttachment"("messageId");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE INDEX "MessageReaction_userId_idx" ON "MessageReaction"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "MessageSharedEntity_messageId_key" ON "MessageSharedEntity"("messageId");

-- CreateIndex
CREATE INDEX "SharedEntityImportDecision_receiverUserId_status_idx" ON "SharedEntityImportDecision"("receiverUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SharedEntityImportDecision_messageId_receiverUserId_key" ON "SharedEntityImportDecision"("messageId", "receiverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ImplantationDesign_fvStudyId_key" ON "ImplantationDesign"("fvStudyId");

-- CreateIndex
CREATE UNIQUE INDEX "FvStudyMonth_fvStudyId_monthIndex_key" ON "FvStudyMonth"("fvStudyId", "monthIndex");

-- CreateIndex
CREATE INDEX "TransportContract_supplierId_idx" ON "TransportContract"("supplierId");

-- CreateIndex
CREATE INDEX "TransportContract_projectId_idx" ON "TransportContract"("projectId");

-- CreateIndex
CREATE INDEX "TransportContract_active_idx" ON "TransportContract"("active");

-- CreateIndex
CREATE INDEX "TransportContract_transportVariableProfileId_idx" ON "TransportContract"("transportVariableProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportVariable_key_key" ON "TransportVariable"("key");

-- CreateIndex
CREATE INDEX "TransportVariable_active_idx" ON "TransportVariable"("active");

-- CreateIndex
CREATE INDEX "TransportVariableValue_variableId_validFrom_idx" ON "TransportVariableValue"("variableId", "validFrom");

-- CreateIndex
CREATE INDEX "TransportVariableValue_profileId_idx" ON "TransportVariableValue"("profileId");

-- CreateIndex
CREATE INDEX "TransportContractVersion_contractId_status_idx" ON "TransportContractVersion"("contractId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportContractVersion_contractId_versionNumber_key" ON "TransportContractVersion"("contractId", "versionNumber");

-- CreateIndex
CREATE INDEX "TransportTariffItem_contractVersionId_sortOrder_idx" ON "TransportTariffItem"("contractVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransportTariffOverride_contractVersionId_sortOrder_idx" ON "TransportTariffOverride"("contractVersionId", "sortOrder");

-- CreateIndex
CREATE INDEX "TransportTariffOverride_baseTariffItemId_idx" ON "TransportTariffOverride"("baseTariffItemId");

-- CreateIndex
CREATE INDEX "TransportCommercialTariff_projectId_idx" ON "TransportCommercialTariff"("projectId");

-- CreateIndex
CREATE INDEX "TransportCommercialTariff_supplierId_idx" ON "TransportCommercialTariff"("supplierId");

-- CreateIndex
CREATE INDEX "TransportCommercialTariff_active_idx" ON "TransportCommercialTariff"("active");

-- CreateIndex
CREATE UNIQUE INDEX "TransportGroupCommercial_groupKey_key" ON "TransportGroupCommercial"("groupKey");

-- CreateIndex
CREATE INDEX "TransportGroupCommercial_projectId_idx" ON "TransportGroupCommercial"("projectId");

-- CreateIndex
CREATE INDEX "TransportGroupCommercial_tariffId_idx" ON "TransportGroupCommercial"("tariffId");

-- CreateIndex
CREATE INDEX "TransportGroupCommercial_contractVersionId_idx" ON "TransportGroupCommercial"("contractVersionId");

-- CreateIndex
CREATE INDEX "TransportTripCommercial_projectId_tripDate_idx" ON "TransportTripCommercial"("projectId", "tripDate");

-- CreateIndex
CREATE INDEX "TransportTripCommercial_groupKey_idx" ON "TransportTripCommercial"("groupKey");

-- CreateIndex
CREATE INDEX "TransportTripCommercial_status_idx" ON "TransportTripCommercial"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportTripCommercial_groupKey_tripNumber_key" ON "TransportTripCommercial"("groupKey", "tripNumber");

-- CreateIndex
CREATE INDEX "TransportTripCostLine_tripId_sortOrder_idx" ON "TransportTripCostLine"("tripId", "sortOrder");

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

-- CreateIndex
CREATE INDEX "OrganizationNode_parentId_idx" ON "OrganizationNode"("parentId");

-- CreateIndex
CREATE INDEX "OrganizationNode_linkToId_idx" ON "OrganizationNode"("linkToId");

-- CreateIndex
CREATE INDEX "OrganizationCustomEdge_fromNodeId_idx" ON "OrganizationCustomEdge"("fromNodeId");

-- CreateIndex
CREATE INDEX "OrganizationCustomEdge_toNodeId_idx" ON "OrganizationCustomEdge"("toNodeId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationCustomEdge_fromNodeId_toNodeId_key" ON "OrganizationCustomEdge"("fromNodeId", "toNodeId");

-- AddForeignKey
ALTER TABLE "SuiteAgentUsageLog" ADD CONSTRAINT "SuiteAgentUsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_transportVariableProfileId_fkey" FOREIGN KEY ("transportVariableProfileId") REFERENCES "TransportVariableProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLocation" ADD CONSTRAINT "ProjectLocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogisticsInternationalSnapshot" ADD CONSTRAINT "LogisticsInternationalSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_logisticsInternationalSnapshotId_fkey" FOREIGN KEY ("logisticsInternationalSnapshotId") REFERENCES "LogisticsInternationalSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_predecessorTaskId_fkey" FOREIGN KEY ("predecessorTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_successorTaskId_fkey" FOREIGN KEY ("successorTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommercialLink" ADD CONSTRAINT "ProjectCommercialLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDecision" ADD CONSTRAINT "ProjectDecision_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDecision" ADD CONSTRAINT "ProjectDecision_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDocument" ADD CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_assignedProjectId_fkey" FOREIGN KEY ("assignedProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommitment" ADD CONSTRAINT "ProjectCommitment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommitment" ADD CONSTRAINT "ProjectCommitment_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ProjectDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommitment" ADD CONSTRAINT "ProjectCommitment_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCommitment" ADD CONSTRAINT "ProjectCommitment_riskId_fkey" FOREIGN KEY ("riskId") REFERENCES "Risk"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Risk" ADD CONSTRAINT "Risk_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserP2pIdentity" ADD CONSTRAINT "UserP2pIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "P2pMessageDelivery" ADD CONSTRAINT "P2pMessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageAttachment" ADD CONSTRAINT "MessageAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReaction" ADD CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageSharedEntity" ADD CONSTRAINT "MessageSharedEntity_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedEntityImportDecision" ADD CONSTRAINT "SharedEntityImportDecision_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SharedEntityImportDecision" ADD CONSTRAINT "SharedEntityImportDecision_receiverUserId_fkey" FOREIGN KEY ("receiverUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FvStudy" ADD CONSTRAINT "FvStudy_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FvStudy" ADD CONSTRAINT "FvStudy_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplantationDesign" ADD CONSTRAINT "ImplantationDesign_fvStudyId_fkey" FOREIGN KEY ("fvStudyId") REFERENCES "FvStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplantationDesign" ADD CONSTRAINT "ImplantationDesign_panelProductId_fkey" FOREIGN KEY ("panelProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImplantationPanelPlacement" ADD CONSTRAINT "ImplantationPanelPlacement_implantationDesignId_fkey" FOREIGN KEY ("implantationDesignId") REFERENCES "ImplantationDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FvStudyMonth" ADD CONSTRAINT "FvStudyMonth_fvStudyId_fkey" FOREIGN KEY ("fvStudyId") REFERENCES "FvStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportContract" ADD CONSTRAINT "TransportContract_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportContract" ADD CONSTRAINT "TransportContract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportContract" ADD CONSTRAINT "TransportContract_transportVariableProfileId_fkey" FOREIGN KEY ("transportVariableProfileId") REFERENCES "TransportVariableProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVariableValue" ADD CONSTRAINT "TransportVariableValue_variableId_fkey" FOREIGN KEY ("variableId") REFERENCES "TransportVariable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportVariableValue" ADD CONSTRAINT "TransportVariableValue_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TransportVariableProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportContractVersion" ADD CONSTRAINT "TransportContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "TransportContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTariffItem" ADD CONSTRAINT "TransportTariffItem_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "TransportContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTariffOverride" ADD CONSTRAINT "TransportTariffOverride_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "TransportContractVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTariffOverride" ADD CONSTRAINT "TransportTariffOverride_baseTariffItemId_fkey" FOREIGN KEY ("baseTariffItemId") REFERENCES "TransportTariffItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportCommercialTariff" ADD CONSTRAINT "TransportCommercialTariff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportCommercialTariff" ADD CONSTRAINT "TransportCommercialTariff_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportGroupCommercial" ADD CONSTRAINT "TransportGroupCommercial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportGroupCommercial" ADD CONSTRAINT "TransportGroupCommercial_tariffId_fkey" FOREIGN KEY ("tariffId") REFERENCES "TransportCommercialTariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportGroupCommercial" ADD CONSTRAINT "TransportGroupCommercial_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "TransportContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripCommercial" ADD CONSTRAINT "TransportTripCommercial_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripCommercial" ADD CONSTRAINT "TransportTripCommercial_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripCommercial" ADD CONSTRAINT "TransportTripCommercial_contractVersionId_fkey" FOREIGN KEY ("contractVersionId") REFERENCES "TransportContractVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripCommercial" ADD CONSTRAINT "TransportTripCommercial_variableProfileId_fkey" FOREIGN KEY ("variableProfileId") REFERENCES "TransportVariableProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportTripCostLine" ADD CONSTRAINT "TransportTripCostLine_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TransportTripCommercial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModel" ADD CONSTRAINT "ProductModel_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_primarySupplierId_fkey" FOREIGN KEY ("primarySupplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPanelSpecs" ADD CONSTRAINT "ProductPanelSpecs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductInverterSpecs" ADD CONSTRAINT "ProductInverterSpecs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatterySpecs" ADD CONSTRAINT "ProductBatterySpecs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSupplier" ADD CONSTRAINT "ProductSupplier_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sourceFvStudyId_fkey" FOREIGN KEY ("sourceFvStudyId") REFERENCES "FvStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sourceQuoteTemplateId_fkey" FOREIGN KEY ("sourceQuoteTemplateId") REFERENCES "QuoteTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarginTemplateSnapshot" ADD CONSTRAINT "MarginTemplateSnapshot_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteFvCalculation" ADD CONSTRAINT "QuoteFvCalculation_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteFvCalculation" ADD CONSTRAINT "QuoteFvCalculation_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteFvCalculation" ADD CONSTRAINT "QuoteFvCalculation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteMainItem" ADD CONSTRAINT "QuoteMainItem_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItemLine" ADD CONSTRAINT "QuoteItemLine_quoteMainItemId_fkey" FOREIGN KEY ("quoteMainItemId") REFERENCES "QuoteMainItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItemLine" ADD CONSTRAINT "QuoteItemLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItemLine" ADD CONSTRAINT "QuoteItemLine_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItemLine" ADD CONSTRAINT "QuoteItemLine_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItemLine" ADD CONSTRAINT "QuoteItemLine_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "ProductModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateItem" ADD CONSTRAINT "QuoteTemplateItem_quoteTemplateId_fkey" FOREIGN KEY ("quoteTemplateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateLine" ADD CONSTRAINT "QuoteTemplateLine_quoteTemplateItemId_fkey" FOREIGN KEY ("quoteTemplateItemId") REFERENCES "QuoteTemplateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateLine" ADD CONSTRAINT "QuoteTemplateLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAddOnInput" ADD CONSTRAINT "QuoteAddOnInput_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAddOnSuggestion" ADD CONSTRAINT "QuoteAddOnSuggestion_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAddOnSuggestion" ADD CONSTRAINT "QuoteAddOnSuggestion_quoteAddOnId_fkey" FOREIGN KEY ("quoteAddOnId") REFERENCES "QuoteAddOn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAddOnSuggestion" ADD CONSTRAINT "QuoteAddOnSuggestion_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "QuoteItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteAddOnSuggestion" ADD CONSTRAINT "QuoteAddOnSuggestion_quoteItemLineId_fkey" FOREIGN KEY ("quoteItemLineId") REFERENCES "QuoteItemLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installation" ADD CONSTRAINT "Installation_activationCodeId_fkey" FOREIGN KEY ("activationCodeId") REFERENCES "ActivationCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNode" ADD CONSTRAINT "OrganizationNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationNode" ADD CONSTRAINT "OrganizationNode_linkToId_fkey" FOREIGN KEY ("linkToId") REFERENCES "OrganizationNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCustomEdge" ADD CONSTRAINT "OrganizationCustomEdge_fromNodeId_fkey" FOREIGN KEY ("fromNodeId") REFERENCES "OrganizationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationCustomEdge" ADD CONSTRAINT "OrganizationCustomEdge_toNodeId_fkey" FOREIGN KEY ("toNodeId") REFERENCES "OrganizationNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

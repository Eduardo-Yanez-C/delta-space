"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarginHierarchyService = void 0;
// @ts-nocheck — alineado con dist.
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quote-access.helper");
const quote_versions_service_1 = require("../versions/quote-versions.service");
const margin_hierarchy_clean_blocks_1 = require("./margin-hierarchy.clean-blocks");
const margin_hierarchy_constants_1 = require("./margin-hierarchy.constants");
let MarginHierarchyService = class MarginHierarchyService {
    constructor(prisma, quoteVersionsService) {
        this.prisma = prisma;
        this.quoteVersionsService = quoteVersionsService;
    }
    async applyCleanHierarchy(quoteId, versionId, dto, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                quoteKind: true,
                ownerId: true,
                salespersonId: true,
                status: true,
                currency: true,
            },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quote.quoteKind !== "MARGIN") {
            throw new common_1.BadRequestException("Esta acción solo está disponible para cotizaciones MARGIN");
        }
        if (!currentUser || !(0, quote_access_helper_1.canAccessQuote)(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quote.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se puede aplicar plantilla limpia en cotizaciones en estado BORRADOR");
        }
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
            select: { id: true, status: true },
        });
        if (!version) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        if (version.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se puede aplicar plantilla limpia en versiones BORRADOR");
        }
        if (!(0, margin_hierarchy_constants_1.isValidMarginHierarchySystemType)(dto.systemType)) {
            throw new common_1.BadRequestException(`systemType inválido: ${dto.systemType}`);
        }
        if (!(0, margin_hierarchy_constants_1.isValidMarginHierarchyMountStructureType)(dto.mountStructureType)) {
            throw new common_1.BadRequestException(`mountStructureType inválido: ${dto.mountStructureType}`);
        }
        const systemType = dto.systemType;
        const mountStructureType = dto.mountStructureType;
        const existingCount = await this.prisma.quoteMainItem.count({
            where: { quoteVersionId: versionId },
        });
        if (existingCount > 0 && dto.replaceExisting !== true) {
            throw new common_1.BadRequestException("La versión ya tiene ítems principales. Envíe replaceExisting=true para reemplazar la jerarquía.");
        }
        const blocks = (0, margin_hierarchy_clean_blocks_1.filterBlocksForApplyClean)(systemType, mountStructureType);
        const currency = quote.currency?.trim() || "CLP";
        await this.prisma.$transaction(async (tx) => {
            if (dto.replaceExisting === true && existingCount > 0) {
                await tx.quoteMainItem.deleteMany({
                    where: { quoteVersionId: versionId },
                });
            }
            for (const block of blocks) {
                const mainItem = await tx.quoteMainItem.create({
                    data: {
                        quoteVersionId: versionId,
                        name: block.name,
                        description: block.description ?? null,
                        sortOrder: block.sortOrder,
                        visibleInFinalQuote: true,
                        totalMode: "SUM_LINES",
                        totalOverride: null,
                    },
                });
                for (const lineDef of block.lines) {
                    await tx.quoteItemLine.create({
                        data: {
                            quoteMainItemId: mainItem.id,
                            productId: null,
                            categoryId: null,
                            brandId: null,
                            modelId: null,
                            productNameSnapshot: lineDef.productNameSnapshot,
                            productDescriptionSnapshot: lineDef.productDescriptionSnapshot ?? null,
                            categoryNameSnapshot: null,
                            brandNameSnapshot: null,
                            modelNameSnapshot: null,
                            currencySnapshot: currency,
                            unitPriceSnapshot: new client_1.Prisma.Decimal(0),
                            unitCostSnapshot: null,
                            discountPercentSnapshot: new client_1.Prisma.Decimal(0),
                            marginPercentSnapshot: null,
                            quantity: new client_1.Prisma.Decimal(1),
                            lineTotalSnapshot: new client_1.Prisma.Decimal(0),
                            sortOrder: lineDef.sortOrder,
                            visibleInFinalQuote: true,
                            configSnapshot: null,
                        },
                    });
                }
            }
            await this.quoteVersionsService.recalcVersionTotalsTx(tx, versionId);
        });
        return { applied: true, blocksCreated: blocks.length };
    }
};
exports.MarginHierarchyService = MarginHierarchyService;
exports.MarginHierarchyService = MarginHierarchyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_versions_service_1.QuoteVersionsService])
], MarginHierarchyService);

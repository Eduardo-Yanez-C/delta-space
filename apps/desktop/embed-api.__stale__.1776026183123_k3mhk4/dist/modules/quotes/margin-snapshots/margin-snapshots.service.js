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
exports.MarginSnapshotsService = void 0;
// @ts-nocheck — alineado con dist.
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quote-access.helper");
const quote_response_mapper_1 = require("../quote-response.mapper");
const quote_versions_service_1 = require("../versions/quote-versions.service");
const margin_snapshot_payload_1 = require("./margin-snapshot-payload");
function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d)
        return d.toNumber();
    return Number(d);
}
function toNumOrNull(d) {
    if (d == null)
        return null;
    const n = toNum(d);
    return Number.isFinite(n) ? n : null;
}
function buildPayloadFromVersionData(mainItems) {
    return {
        schemaVersion: margin_snapshot_payload_1.MARGIN_SNAPSHOT_SCHEMA_VERSION,
        blocks: mainItems.map((m) => ({
            name: m.name,
            description: m.description,
            sortOrder: m.sortOrder,
            visibleInFinalQuote: m.visibleInFinalQuote,
            totalMode: m.totalMode,
            totalOverride: toNumOrNull(m.totalOverride),
            sourceFromFvStudyKind: m.sourceFromFvStudyKind,
            lines: m.lines.map((l) => ({
                productId: l.productId,
                categoryId: l.categoryId,
                brandId: l.brandId,
                modelId: l.modelId,
                productNameSnapshot: l.productNameSnapshot,
                productDescriptionSnapshot: l.productDescriptionSnapshot,
                categoryNameSnapshot: l.categoryNameSnapshot,
                brandNameSnapshot: l.brandNameSnapshot,
                modelNameSnapshot: l.modelNameSnapshot,
                currencySnapshot: l.currencySnapshot,
                unitPriceSnapshot: toNum(l.unitPriceSnapshot),
                unitCostSnapshot: toNumOrNull(l.unitCostSnapshot),
                discountPercentSnapshot: toNumOrNull(l.discountPercentSnapshot),
                marginPercentSnapshot: toNumOrNull(l.marginPercentSnapshot),
                quantity: toNum(l.quantity),
                lineTotalSnapshot: toNum(l.lineTotalSnapshot),
                configSnapshot: l.configSnapshot,
                sortOrder: l.sortOrder,
                visibleInFinalQuote: l.visibleInFinalQuote,
            })),
        })),
    };
}
function parsePayloadJson(raw) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        throw new common_1.BadRequestException("El snapshot guardado no es JSON válido.");
    }
    if (!(0, margin_snapshot_payload_1.isMarginSnapshotPayloadV1)(parsed)) {
        throw new common_1.BadRequestException(`Snapshot con schemaVersion no soportada (se esperaba "${margin_snapshot_payload_1.MARGIN_SNAPSHOT_SCHEMA_VERSION}").`);
    }
    return parsed;
}
let MarginSnapshotsService = class MarginSnapshotsService {
    constructor(prisma, quoteVersionsService) {
        this.prisma = prisma;
        this.quoteVersionsService = quoteVersionsService;
    }
    mapSnapshotRow(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            createdAt: row.createdAt.toISOString(),
            systemType: row.systemType,
            mountStructureType: row.mountStructureType,
            schemaVersion: row.schemaVersion,
            sourceQuoteId: row.sourceQuoteId,
            sourceQuoteVersionId: row.sourceQuoteVersionId,
        };
    }
    async createFromVersion(quoteId, versionId, dto, user) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                quoteKind: true,
                ownerId: true,
                salespersonId: true,
                technicalBasicsJson: true,
            },
        });
        if (!quote || !(0, quote_access_helper_1.canAccessQuote)(user, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quote.quoteKind !== "MARGIN") {
            throw new common_1.BadRequestException("Solo se pueden guardar plantillas valorizadas desde cotizaciones con margen.");
        }
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
            select: { id: true, status: true },
        });
        if (!version) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        if (version.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se puede guardar un snapshot desde una versión en borrador.");
        }
        const mainItems = await this.prisma.quoteMainItem.findMany({
            where: { quoteVersionId: versionId },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            include: {
                lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
            },
        });
        if (mainItems.length === 0) {
            throw new common_1.BadRequestException("No hay bloques (ítems principales) para guardar. Arme la jerarquía antes.");
        }
        const totalLines = mainItems.reduce((n, m) => n + (m.lines?.length ?? 0), 0);
        if (totalLines === 0) {
            throw new common_1.BadRequestException("La jerarquía no tiene líneas para guardar. Agregue al menos un subítem.");
        }
        const basics = (0, quote_response_mapper_1.parseTechnicalBasicsJson)(quote.technicalBasicsJson);
        const systemType = basics && typeof basics.systemType === "string"
            ? basics.systemType
            : null;
        const mountStructureType = basics && typeof basics.mountStructureType === "string"
            ? basics.mountStructureType
            : null;
        const payload = buildPayloadFromVersionData(mainItems);
        const payloadJson = JSON.stringify(payload);
        const row = await this.prisma.marginTemplateSnapshot.create({
            data: {
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
                createdById: user.id,
                sourceQuoteId: quoteId,
                sourceQuoteVersionId: versionId,
                systemType,
                mountStructureType,
                schemaVersion: margin_snapshot_payload_1.MARGIN_SNAPSHOT_SCHEMA_VERSION,
                payloadJson,
                active: true,
            },
        });
        return this.mapSnapshotRow(row);
    }
    async findLatestForUser(userId) {
        const row = await this.prisma.marginTemplateSnapshot.findFirst({
            where: { createdById: userId, active: true },
            orderBy: { createdAt: "desc" },
        });
        return row ? this.mapSnapshotRow(row) : null;
    }
    async listForUser(userId) {
        const rows = await this.prisma.marginTemplateSnapshot.findMany({
            where: { createdById: userId, active: true },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                description: true,
                createdAt: true,
                systemType: true,
                mountStructureType: true,
                schemaVersion: true,
                sourceQuoteId: true,
                sourceQuoteVersionId: true,
            },
        });
        return rows.map((r) => this.mapSnapshotRow(r));
    }
    async applyLatestToVersion(quoteId, versionId, dto, user) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                quoteKind: true,
                ownerId: true,
                salespersonId: true,
                currency: true,
            },
        });
        if (!quote || !(0, quote_access_helper_1.canAccessQuote)(user, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quote.quoteKind !== "MARGIN") {
            throw new common_1.BadRequestException("Solo se puede aplicar plantilla valorizada en cotizaciones con margen.");
        }
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
            select: { id: true, status: true },
        });
        if (!version) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        if (version.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se puede aplicar en versiones en borrador.");
        }
        const existingCount = await this.prisma.quoteMainItem.count({
            where: { quoteVersionId: versionId },
        });
        if (existingCount > 0 && dto.replaceExisting !== true) {
            throw new common_1.BadRequestException("La versión ya tiene jerarquía. Envíe replaceExisting=true para reemplazarla por la plantilla guardada.");
        }
        const snap = await this.prisma.marginTemplateSnapshot.findFirst({
            where: { createdById: user.id, active: true },
            orderBy: { createdAt: "desc" },
        });
        if (!snap) {
            throw new common_1.NotFoundException("No tiene plantillas valorizadas guardadas. Guarde una desde otra cotización con margen.");
        }
        const payload = parsePayloadJson(snap.payloadJson);
        if (!payload.blocks.length) {
            throw new common_1.BadRequestException("El snapshot guardado no contiene bloques válidos.");
        }
        const currency = quote.currency?.trim() || "CLP";
        await this.prisma.$transaction(async (tx) => {
            if (existingCount > 0) {
                await tx.quoteMainItem.deleteMany({
                    where: { quoteVersionId: versionId },
                });
            }
            for (const block of payload.blocks) {
                const mainItem = await tx.quoteMainItem.create({
                    data: {
                        quoteVersionId: versionId,
                        name: block.name,
                        description: block.description,
                        sortOrder: block.sortOrder,
                        visibleInFinalQuote: block.visibleInFinalQuote,
                        totalMode: block.totalMode,
                        totalOverride: block.totalOverride != null
                            ? new client_1.Prisma.Decimal(block.totalOverride)
                            : null,
                        sourceFromFvStudyKind: block.sourceFromFvStudyKind,
                    },
                });
                for (const line of block.lines) {
                    await tx.quoteItemLine.create({
                        data: {
                            quoteMainItemId: mainItem.id,
                            productId: line.productId,
                            categoryId: line.categoryId,
                            brandId: line.brandId,
                            modelId: line.modelId,
                            productNameSnapshot: line.productNameSnapshot,
                            productDescriptionSnapshot: line.productDescriptionSnapshot,
                            categoryNameSnapshot: line.categoryNameSnapshot,
                            brandNameSnapshot: line.brandNameSnapshot,
                            modelNameSnapshot: line.modelNameSnapshot,
                            currencySnapshot: line.currencySnapshot?.trim() || currency,
                            unitPriceSnapshot: new client_1.Prisma.Decimal(line.unitPriceSnapshot),
                            unitCostSnapshot: line.unitCostSnapshot != null
                                ? new client_1.Prisma.Decimal(line.unitCostSnapshot)
                                : null,
                            discountPercentSnapshot: line.discountPercentSnapshot != null
                                ? new client_1.Prisma.Decimal(line.discountPercentSnapshot)
                                : new client_1.Prisma.Decimal(0),
                            marginPercentSnapshot: line.marginPercentSnapshot != null
                                ? new client_1.Prisma.Decimal(line.marginPercentSnapshot)
                                : null,
                            quantity: new client_1.Prisma.Decimal(line.quantity),
                            lineTotalSnapshot: new client_1.Prisma.Decimal(line.lineTotalSnapshot),
                            configSnapshot: line.configSnapshot,
                            sortOrder: line.sortOrder,
                            visibleInFinalQuote: line.visibleInFinalQuote,
                        },
                    });
                }
            }
            await this.quoteVersionsService.recalcVersionTotalsTx(tx, versionId);
        });
        return {
            applied: true,
            snapshotId: snap.id,
            blocksApplied: payload.blocks.length,
        };
    }
};
exports.MarginSnapshotsService = MarginSnapshotsService;
exports.MarginSnapshotsService = MarginSnapshotsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_versions_service_1.QuoteVersionsService])
], MarginSnapshotsService);

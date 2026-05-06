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
exports.QuoteMainItemsService = void 0;
// @ts-nocheck — alineado con dist.
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const role_constants_1 = require("../../auth/role-constants");
const prisma_service_1 = require("../../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quote-access.helper");
const quote_versions_service_1 = require("../versions/quote-versions.service");
const product_quote_display_name_1 = require("../../../common/product-quote-display-name");
function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d)
        return d.toNumber();
    return Number(d);
}
function lineTotal(quantity, unitPrice, discountPercent) {
    const sub = quantity * unitPrice;
    return sub * (1 - discountPercent / 100);
}
function canApplyPriceOverride(roles) {
    return (0, role_constants_1.hasSalesLikePrivileges)(roles ?? []);
}
let QuoteMainItemsService = class QuoteMainItemsService {
    constructor(prisma, quoteVersionsService) {
        this.prisma = prisma;
        this.quoteVersionsService = quoteVersionsService;
    }
    async createMainItem(quoteId, versionId, dto, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const name = dto.name?.trim();
        if (!name) {
            throw new common_1.BadRequestException("name es obligatorio");
        }
        const totalMode = dto.totalMode === "MANUAL" ? "MANUAL" : "SUM_LINES";
        const totalOverride = dto.totalOverride != null ? dto.totalOverride : null;
        const visibleInFinalQuote = dto.visibleInFinalQuote ?? true;
        const maxSort = await this.prisma.quoteMainItem.findFirst({
            where: { quoteVersionId: versionId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
        const mainItem = await this.prisma.quoteMainItem.create({
            data: {
                quoteVersionId: versionId,
                name,
                description: dto.description?.trim() ?? null,
                sortOrder,
                visibleInFinalQuote,
                totalMode,
                totalOverride,
            },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return mainItem;
    }
    async updateMainItem(quoteId, versionId, mainItemId, dto, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const current = await this.ensureMainItemBelongsToVersion(mainItemId, versionId);
        const touched = dto.name !== undefined ||
            dto.description !== undefined ||
            dto.visibleInFinalQuote !== undefined ||
            dto.totalMode !== undefined ||
            dto.totalOverride !== undefined;
        if (!touched) {
            throw new common_1.BadRequestException("Debe enviar al menos un campo a actualizar");
        }
        const lineRows = await this.prisma.quoteItemLine.findMany({
            where: { quoteMainItemId: mainItemId },
            select: { lineTotalSnapshot: true },
        });
        const sumLines = lineRows.reduce((s, l) => s + toNum(l.lineTotalSnapshot), 0);
        let nextName = current.name;
        if (dto.name !== undefined) {
            const t = String(dto.name).trim();
            if (!t) {
                throw new common_1.BadRequestException("name no puede estar vacío");
            }
            nextName = t;
        }
        let nextDescription = current.description;
        if (dto.description !== undefined) {
            const t = String(dto.description).trim();
            nextDescription = t === "" ? null : t;
        }
        let nextVisible = current.visibleInFinalQuote;
        if (dto.visibleInFinalQuote !== undefined) {
            nextVisible = Boolean(dto.visibleInFinalQuote);
        }
        let nextMode = current.totalMode;
        if (dto.totalMode !== undefined) {
            if (dto.totalMode !== "MANUAL" && dto.totalMode !== "SUM_LINES") {
                throw new common_1.BadRequestException("totalMode debe ser SUM_LINES o MANUAL");
            }
            nextMode = dto.totalMode === "MANUAL" ? "MANUAL" : "SUM_LINES";
        }
        if (dto.totalOverride !== undefined &&
            dto.totalMode === undefined &&
            current.totalMode === "SUM_LINES") {
            nextMode = "MANUAL";
        }
        let nextOverride;
        if (nextMode === "SUM_LINES") {
            nextOverride = null;
        }
        else {
            if (dto.totalOverride !== undefined) {
                if (dto.totalOverride === null) {
                    nextOverride = null;
                }
                else {
                    const v = Number(dto.totalOverride);
                    if (!Number.isFinite(v) || v < 0) {
                        throw new common_1.BadRequestException("totalOverride debe ser un número >= 0 o null");
                    }
                    nextOverride = new client_1.Prisma.Decimal(v);
                }
            }
            else if (current.totalMode === "SUM_LINES" && nextMode === "MANUAL") {
                nextOverride = new client_1.Prisma.Decimal(Math.round(sumLines * 100) / 100);
            }
            else {
                nextOverride = current.totalOverride;
            }
        }
        const updated = await this.prisma.quoteMainItem.update({
            where: { id: mainItemId },
            data: {
                name: nextName,
                description: nextDescription,
                visibleInFinalQuote: nextVisible,
                totalMode: nextMode,
                totalOverride: nextOverride,
            },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return updated;
    }
    async createLine(quoteId, versionId, mainItemId, dto, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        await this.ensureMainItemBelongsToVersion(mainItemId, versionId);
        const source = dto.source;
        if (source !== "MANUAL" && source !== "FROM_CATALOG") {
            throw new common_1.BadRequestException("source debe ser MANUAL o FROM_CATALOG");
        }
        if (source === "MANUAL") {
            return this.createLineManual(quoteId, versionId, mainItemId, dto);
        }
        return this.createLineFromCatalog(quoteId, versionId, mainItemId, dto, currentUser);
    }
    async createLineManual(quoteId, versionId, mainItemId, dto) {
        if (dto.productId != null && dto.productId !== "") {
            throw new common_1.BadRequestException("Para línea manual no debe enviar productId");
        }
        const name = dto.productNameSnapshot?.trim();
        const quantity = Number(dto.quantity);
        const unitPrice = dto.unitPriceSnapshot != null ? Number(dto.unitPriceSnapshot) : null;
        const currencySnapshot = dto.currencySnapshot?.trim() || "CLP";
        if (!name) {
            throw new common_1.BadRequestException("productNameSnapshot es obligatorio para línea manual");
        }
        if (quantity <= 0 || !Number.isFinite(quantity)) {
            throw new common_1.BadRequestException("quantity debe ser un número positivo");
        }
        if (unitPrice == null || unitPrice < 0 || !Number.isFinite(unitPrice)) {
            throw new common_1.BadRequestException("unitPriceSnapshot es obligatorio para línea manual y debe ser >= 0");
        }
        const discountPercent = dto.discountPercentSnapshot != null
            ? Number(dto.discountPercentSnapshot)
            : 0;
        const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
        const quoteRow = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true },
        });
        const isMargin = quoteRow?.quoteKind === "MARGIN";
        let unitCostSnapshot = null;
        if (isMargin && dto.unitCostSnapshot !== undefined) {
            if (dto.unitCostSnapshot === null) {
                unitCostSnapshot = null;
            }
            else {
                const c = Number(dto.unitCostSnapshot);
                if (!Number.isFinite(c) || c < 0) {
                    throw new common_1.BadRequestException("unitCostSnapshot debe ser un número >= 0 o null");
                }
                unitCostSnapshot = new client_1.Prisma.Decimal(c);
            }
        }
        const maxSort = await this.prisma.quoteItemLine.findFirst({
            where: { quoteMainItemId: mainItemId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
        const line = await this.prisma.quoteItemLine.create({
            data: {
                quoteMainItemId: mainItemId,
                productId: null,
                categoryId: null,
                brandId: null,
                modelId: null,
                productNameSnapshot: name,
                productDescriptionSnapshot: dto.productDescriptionSnapshot?.trim() ?? null,
                categoryNameSnapshot: null,
                brandNameSnapshot: null,
                modelNameSnapshot: null,
                currencySnapshot: currencySnapshot,
                unitPriceSnapshot: unitPrice,
                unitCostSnapshot,
                discountPercentSnapshot: discountPercent,
                marginPercentSnapshot: null,
                quantity,
                lineTotalSnapshot,
                sortOrder,
                visibleInFinalQuote: false,
            },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return line;
    }
    async createLineFromCatalog(_quoteId, versionId, mainItemId, dto, currentUser) {
        if (dto.productNameSnapshot != null && dto.productNameSnapshot !== "") {
            throw new common_1.BadRequestException("Para línea desde catálogo no debe enviar productNameSnapshot");
        }
        const productId = dto.productId?.trim();
        const quantity = Number(dto.quantity);
        if (!productId) {
            throw new common_1.BadRequestException("productId es obligatorio para línea desde catálogo");
        }
        if (quantity <= 0 || !Number.isFinite(quantity)) {
            throw new common_1.BadRequestException("quantity debe ser un número positivo");
        }
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
            include: { category: true, brand: true, model: true },
        });
        if (!product) {
            throw new common_1.NotFoundException("Producto no encontrado");
        }
        let unitPrice = 0;
        let currency = product.defaultCurrency ?? "CLP";
        let unitCost = null;
        const isPrivileged = (0, role_constants_1.hasGlobalAdminPrivileges)(currentUser?.roles ?? []);
        if (dto.priceId) {
            const price = await this.prisma.productPrice.findFirst({
                where: { id: dto.priceId, productId },
            });
            if (!price) {
                throw new common_1.BadRequestException("Precio no encontrado o no corresponde al producto");
            }
            unitPrice = toNum(price.price);
            currency = price.currency ?? currency;
            if (isPrivileged && price.cost != null)
                unitCost = toNum(price.cost);
        }
        else {
            const now = new Date();
            const vigent = await this.prisma.productPrice.findFirst({
                where: {
                    productId,
                    validFrom: { lte: now },
                    OR: [{ validTo: null }, { validTo: { gte: now } }],
                },
                orderBy: { validFrom: "desc" },
            });
            if (vigent) {
                unitPrice = toNum(vigent.price);
                currency = vigent.currency ?? currency;
                if (isPrivileged && vigent.cost != null)
                    unitCost = toNum(vigent.cost);
            }
        }
        if (dto.unitPriceOverride !== undefined &&
            canApplyPriceOverride(currentUser?.roles)) {
            unitPrice = dto.unitPriceOverride;
        }
        if (unitPrice <= 0) {
            throw new common_1.BadRequestException("No hay precio vigente para el producto o debe indicar unitPriceOverride");
        }
        const discountPercent = 0;
        const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
        const maxSort = await this.prisma.quoteItemLine.findFirst({
            where: { quoteMainItemId: mainItemId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
        const line = await this.prisma.quoteItemLine.create({
            data: {
                quoteMainItemId: mainItemId,
                productId,
                categoryId: product.categoryId,
                brandId: product.brandId,
                modelId: product.modelId,
                productNameSnapshot: (0, product_quote_display_name_1.commercialNameForQuoteLine)(product),
                productDescriptionSnapshot: product.description ?? null,
                categoryNameSnapshot: product.category?.name ?? null,
                brandNameSnapshot: product.brandNameFree ?? product.brand?.name ?? null,
                modelNameSnapshot: product.modelNameFree ?? product.model?.name ?? null,
                currencySnapshot: currency,
                unitPriceSnapshot: unitPrice,
                unitCostSnapshot: unitCost,
                discountPercentSnapshot: discountPercent,
                marginPercentSnapshot: null,
                quantity,
                lineTotalSnapshot,
                sortOrder,
                visibleInFinalQuote: false,
            },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return line;
    }
    async updateLine(quoteId, versionId, lineId, dto, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const line = await this.ensureLineBelongsToVersion(lineId, versionId);
        const quoteRow = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true },
        });
        const isMargin = quoteRow?.quoteKind === "MARGIN";
        let quantity = toNum(line.quantity);
        let unitPrice = toNum(line.unitPriceSnapshot);
        let discountPercent = line.discountPercentSnapshot != null
            ? toNum(line.discountPercentSnapshot)
            : 0;
        let unitCost = line.unitCostSnapshot != null ? toNum(line.unitCostSnapshot) : null;
        if (dto.quantity !== undefined) {
            const v = Number(dto.quantity);
            if (v <= 0 || !Number.isFinite(v))
                throw new common_1.BadRequestException("quantity debe ser un número positivo");
            quantity = v;
        }
        if (dto.unitPriceSnapshot !== undefined) {
            const v = Number(dto.unitPriceSnapshot);
            if (v < 0 || !Number.isFinite(v))
                throw new common_1.BadRequestException("unitPriceSnapshot debe ser >= 0");
            unitPrice = v;
        }
        if (dto.discountPercentSnapshot !== undefined) {
            const v = Number(dto.discountPercentSnapshot);
            if (v < 0 || v > 100 || !Number.isFinite(v))
                throw new common_1.BadRequestException("discountPercentSnapshot debe estar entre 0 y 100");
            discountPercent = v;
        }
        if (dto.unitCostSnapshot !== undefined) {
            if (!isMargin) {
            }
            else if (dto.unitCostSnapshot === null) {
                unitCost = null;
            }
            else {
                const v = Number(dto.unitCostSnapshot);
                if (v < 0 || !Number.isFinite(v)) {
                    throw new common_1.BadRequestException("unitCostSnapshot debe ser >= 0 o null");
                }
                unitCost = v;
            }
        }
        const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
        const data = {
            quantity,
            unitPriceSnapshot: unitPrice,
            discountPercentSnapshot: discountPercent,
            lineTotalSnapshot,
        };
        if (isMargin && dto.unitCostSnapshot !== undefined) {
            data.unitCostSnapshot =
                unitCost === null ? null : new client_1.Prisma.Decimal(unitCost);
        }
        if (dto.productNameSnapshot !== undefined) {
            const v = dto.productNameSnapshot.trim();
            data.productNameSnapshot = v || line.productNameSnapshot;
        }
        if (dto.productDescriptionSnapshot !== undefined) {
            data.productDescriptionSnapshot =
                dto.productDescriptionSnapshot.trim() || null;
        }
        if (dto.currencySnapshot !== undefined) {
            const v = dto.currencySnapshot.trim();
            data.currencySnapshot = v || line.currencySnapshot;
        }
        if (dto.visibleInFinalQuote !== undefined) {
            data.visibleInFinalQuote = dto.visibleInFinalQuote;
        }
        const updated = await this.prisma.quoteItemLine.update({
            where: { id: lineId },
            data,
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return updated;
    }
    async deleteLine(quoteId, versionId, lineId, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        await this.ensureLineBelongsToVersion(lineId, versionId);
        await this.prisma.quoteItemLine.delete({
            where: { id: lineId },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return { deleted: true };
    }
    async duplicateLine(quoteId, versionId, lineId, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const line = await this.prisma.quoteItemLine.findFirst({
            where: { id: lineId },
            include: { quoteMainItem: true },
        });
        if (!line || line.quoteMainItem.quoteVersionId !== versionId) {
            throw new common_1.NotFoundException("Línea no encontrada o no pertenece a esta versión");
        }
        const mainItemId = line.quoteMainItemId;
        const maxSort = await this.prisma.quoteItemLine.findFirst({
            where: { quoteMainItemId: mainItemId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
        const quantity = toNum(line.quantity);
        const unitPrice = toNum(line.unitPriceSnapshot);
        const discountPercent = line.discountPercentSnapshot != null
            ? toNum(line.discountPercentSnapshot)
            : 0;
        const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
        const created = await this.prisma.quoteItemLine.create({
            data: {
                quoteMainItemId: mainItemId,
                productId: line.productId,
                categoryId: line.categoryId,
                brandId: line.brandId,
                modelId: line.modelId,
                productNameSnapshot: line.productNameSnapshot,
                productDescriptionSnapshot: line.productDescriptionSnapshot,
                categoryNameSnapshot: line.categoryNameSnapshot,
                brandNameSnapshot: line.brandNameSnapshot,
                modelNameSnapshot: line.modelNameSnapshot,
                currencySnapshot: line.currencySnapshot,
                unitPriceSnapshot: unitPrice,
                unitCostSnapshot: line.unitCostSnapshot,
                discountPercentSnapshot: discountPercent,
                marginPercentSnapshot: null,
                quantity,
                lineTotalSnapshot,
                configSnapshot: line.configSnapshot,
                sortOrder,
                visibleInFinalQuote: line.visibleInFinalQuote,
            },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return { id: created.id };
    }
    async duplicateMainItem(quoteId, versionId, mainItemId, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const source = await this.ensureMainItemBelongsToVersion(mainItemId, versionId);
        const lines = await this.prisma.quoteItemLine.findMany({
            where: { quoteMainItemId: mainItemId },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        });
        const maxMain = await this.prisma.quoteMainItem.findFirst({
            where: { quoteVersionId: versionId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const mainSortOrder = (maxMain?.sortOrder ?? -1) + 1;
        const createdMain = await this.prisma.quoteMainItem.create({
            data: {
                quoteVersionId: versionId,
                name: source.name,
                description: source.description,
                visibleInFinalQuote: source.visibleInFinalQuote,
                totalMode: source.totalMode,
                totalOverride: source.totalOverride,
                sortOrder: mainSortOrder,
                sourceFromFvStudyKind: null,
            },
        });
        for (let i = 0; i < lines.length; i++) {
            const ln = lines[i];
            const quantity = toNum(ln.quantity);
            const unitPrice = toNum(ln.unitPriceSnapshot);
            const discountPercent = ln.discountPercentSnapshot != null
                ? toNum(ln.discountPercentSnapshot)
                : 0;
            const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
            await this.prisma.quoteItemLine.create({
                data: {
                    quoteMainItemId: createdMain.id,
                    productId: ln.productId,
                    categoryId: ln.categoryId,
                    brandId: ln.brandId,
                    modelId: ln.modelId,
                    productNameSnapshot: ln.productNameSnapshot,
                    productDescriptionSnapshot: ln.productDescriptionSnapshot,
                    categoryNameSnapshot: ln.categoryNameSnapshot,
                    brandNameSnapshot: ln.brandNameSnapshot,
                    modelNameSnapshot: ln.modelNameSnapshot,
                    currencySnapshot: ln.currencySnapshot,
                    unitPriceSnapshot: unitPrice,
                    unitCostSnapshot: ln.unitCostSnapshot,
                    discountPercentSnapshot: discountPercent,
                    marginPercentSnapshot: null,
                    quantity,
                    lineTotalSnapshot,
                    configSnapshot: ln.configSnapshot,
                    sortOrder: i,
                    visibleInFinalQuote: ln.visibleInFinalQuote,
                },
            });
        }
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return { id: createdMain.id };
    }
    async ensureQuoteEditable(quoteId, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                quoteKind: true,
                ownerId: true,
                salespersonId: true,
                status: true,
            },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (!currentUser || !(0, quote_access_helper_1.canAccessQuote)(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quote.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se pueden modificar ítems en cotizaciones en estado BORRADOR");
        }
    }
    async ensureVersionBelongsToQuote(quoteId, versionId) {
        const v = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
        });
        if (!v) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
    }
    async ensureMainItemBelongsToVersion(mainItemId, versionId) {
        const mainItem = await this.prisma.quoteMainItem.findFirst({
            where: { id: mainItemId, quoteVersionId: versionId },
        });
        if (!mainItem) {
            throw new common_1.NotFoundException("Ítem principal no encontrado o no pertenece a esta versión");
        }
        return mainItem;
    }
    async ensureLineBelongsToVersion(lineId, versionId) {
        const line = await this.prisma.quoteItemLine.findFirst({
            where: { id: lineId },
            include: { quoteMainItem: true },
        });
        if (!line || line.quoteMainItem.quoteVersionId !== versionId) {
            throw new common_1.NotFoundException("Línea no encontrada o no pertenece a esta versión");
        }
        return line;
    }
};
exports.QuoteMainItemsService = QuoteMainItemsService;
exports.QuoteMainItemsService = QuoteMainItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_versions_service_1.QuoteVersionsService])
], QuoteMainItemsService);

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
exports.QuoteItemsService = void 0;
// @ts-nocheck — alineado con dist.
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const role_constants_1 = require("../../auth/role-constants");
const prisma_service_1 = require("../../../infra/prisma/prisma.service");
const quote_margin_economics_helper_1 = require("../quote-margin-economics.helper");
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
function canApplyPriceOverride(roles) {
    return (0, role_constants_1.hasSalesLikePrivileges)(roles ?? []);
}
function lineTotal(quantity, unitPrice, discountPercent) {
    const sub = quantity * unitPrice;
    return sub * (1 - discountPercent / 100);
}
let QuoteItemsService = class QuoteItemsService {
    constructor(prisma, quoteVersionsService) {
        this.prisma = prisma;
        this.quoteVersionsService = quoteVersionsService;
    }
    async findAll(quoteId, versionId, currentUser) {
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const version = await this.quoteVersionsService.findOne(quoteId, versionId, currentUser);
        return version.items;
    }
    async addItem(quoteId, versionId, dto, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        if (dto.unitPriceOverride !== undefined &&
            !canApplyPriceOverride(currentUser?.roles)) {
            throw new common_1.ForbiddenException("No tiene permiso para aplicar ajuste de precio en el ítem");
        }
        const roles = currentUser?.roles ?? [];
        const isPrivileged = (0, role_constants_1.hasGlobalAdminPrivileges)(roles);
        if (dto.productId) {
            const product = await this.prisma.product.findUnique({
                where: { id: dto.productId },
                include: { category: true, brand: true, model: true },
            });
            if (!product) {
                throw new common_1.NotFoundException("Producto no encontrado");
            }
            let unitPrice = 0;
            let currency = product.defaultCurrency ?? "CLP";
            let unitCost = null;
            if (dto.priceId) {
                const price = await this.prisma.productPrice.findFirst({
                    where: { id: dto.priceId, productId: dto.productId },
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
                        productId: dto.productId,
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
            const discountPercent = dto.discountPercent ?? 0;
            const quantity = dto.quantity;
            const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
            const maxSort = await this.prisma.quoteItem.findFirst({
                where: { quoteVersionId: versionId },
                orderBy: { sortOrder: "desc" },
                select: { sortOrder: true },
            });
            const sortOrder = (maxSort?.sortOrder ?? 0) + 1;
            const item = await this.prisma.quoteItem.create({
                data: {
                    quoteVersionId: versionId,
                    productId: dto.productId,
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
                },
            });
            await this.quoteVersionsService.recalcVersionTotals(versionId);
            const qk = await this.prisma.quote.findUnique({
                where: { id: quoteId },
                select: { quoteKind: true },
            });
            return this.mapItem(item, currentUser, qk?.quoteKind);
        }
        const name = dto.productNameSnapshot?.trim();
        const qty = dto.quantity;
        const price = dto.unitPriceSnapshot ?? dto.unitPriceOverride;
        const currencySnapshot = dto.currencySnapshot?.trim() ?? "CLP";
        if (!name || name.length === 0) {
            throw new common_1.BadRequestException("productNameSnapshot es obligatorio para ítem manual");
        }
        if (price == null || Number(price) < 0) {
            throw new common_1.BadRequestException("unitPriceSnapshot es obligatorio para ítem manual y debe ser >= 0");
        }
        const discountPercent = dto.discountPercent ?? 0;
        const lineTotalSnapshot = lineTotal(qty, price, discountPercent);
        const maxSort = await this.prisma.quoteItem.findFirst({
            where: { quoteVersionId: versionId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const sortOrder = (maxSort?.sortOrder ?? 0) + 1;
        const item = await this.prisma.quoteItem.create({
            data: {
                quoteVersionId: versionId,
                productId: null,
                categoryId: null,
                brandId: null,
                modelId: null,
                productNameSnapshot: name,
                productDescriptionSnapshot: dto.productDescriptionSnapshot?.trim() ?? null,
                categoryNameSnapshot: dto.categoryNameSnapshot?.trim() ?? null,
                brandNameSnapshot: dto.brandNameSnapshot?.trim() ?? null,
                modelNameSnapshot: dto.modelNameSnapshot?.trim() ?? null,
                currencySnapshot: currencySnapshot,
                unitPriceSnapshot: price,
                unitCostSnapshot: null,
                discountPercentSnapshot: discountPercent,
                marginPercentSnapshot: null,
                quantity: qty,
                lineTotalSnapshot,
                sortOrder,
            },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        const qkManual = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true },
        });
        return this.mapItem(item, currentUser, qkManual?.quoteKind);
    }
    async updateItem(quoteId, versionId, itemId, dto, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        const item = await this.prisma.quoteItem.findFirst({
            where: { id: itemId, quoteVersionId: versionId },
        });
        if (!item) {
            throw new common_1.NotFoundException("Ítem no encontrado");
        }
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        if (dto.unitPriceOverride !== undefined &&
            !canApplyPriceOverride(currentUser?.roles)) {
            throw new common_1.ForbiddenException("No tiene permiso para aplicar ajuste de precio en el ítem");
        }
        const quoteMeta = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true },
        });
        const isMargin = quoteMeta?.quoteKind === "MARGIN";
        let quantity = toNum(item.quantity);
        let unitPrice = toNum(item.unitPriceSnapshot);
        let discountPercent = item.discountPercentSnapshot != null
            ? toNum(item.discountPercentSnapshot)
            : 0;
        let unitCost = item.unitCostSnapshot != null ? toNum(item.unitCostSnapshot) : null;
        if (dto.quantity !== undefined)
            quantity = dto.quantity;
        if (dto.unitPriceOverride !== undefined &&
            canApplyPriceOverride(currentUser?.roles)) {
            unitPrice = dto.unitPriceOverride;
        }
        if (dto.discountPercent !== undefined)
            discountPercent = dto.discountPercent;
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
        const updated = await this.prisma.quoteItem.update({
            where: { id: itemId },
            data,
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return this.mapItem(updated, currentUser, quoteMeta?.quoteKind);
    }
    async removeItem(quoteId, versionId, itemId, currentUser) {
        await this.ensureQuoteEditable(quoteId, currentUser);
        const item = await this.prisma.quoteItem.findFirst({
            where: { id: itemId, quoteVersionId: versionId },
        });
        if (!item) {
            throw new common_1.NotFoundException("Ítem no encontrado");
        }
        await this.prisma.quoteItem.delete({
            where: { id: itemId },
        });
        await this.quoteVersionsService.recalcVersionTotals(versionId);
        return { deleted: true };
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
    mapItem(i, currentUser, quoteKind) {
        const isMargin = quoteKind === "MARGIN";
        const showCostFields = (0, role_constants_1.hasGlobalAdminPrivileges)(currentUser?.roles ?? []) || isMargin;
        const lineTotalSale = toNum(i.lineTotalSnapshot);
        const qty = toNum(i.quantity);
        const uc = i.unitCostSnapshot != null ? toNum(i.unitCostSnapshot) : null;
        const out = {
            id: i.id,
            productId: i.productId ?? null,
            productNameSnapshot: i.productNameSnapshot,
            productDescriptionSnapshot: i.productDescriptionSnapshot,
            categoryNameSnapshot: i.categoryNameSnapshot,
            brandNameSnapshot: i.brandNameSnapshot,
            modelNameSnapshot: i.modelNameSnapshot,
            currencySnapshot: i.currencySnapshot,
            unitPriceSnapshot: toNum(i.unitPriceSnapshot),
            discountPercentSnapshot: i.discountPercentSnapshot != null
                ? toNum(i.discountPercentSnapshot)
                : null,
            quantity: qty,
            lineTotalSnapshot: lineTotalSale,
            sortOrder: i.sortOrder,
        };
        if (showCostFields) {
            out.unitCostSnapshot = uc;
            out.marginPercentSnapshot =
                i.marginPercentSnapshot != null ? toNum(i.marginPercentSnapshot) : null;
        }
        if (isMargin) {
            const econ = (0, quote_margin_economics_helper_1.lineUtilityAndMarginPercent)(lineTotalSale, qty, uc);
            out.lineCostTotal = econ.lineCostTotal;
            out.lineUtility = econ.lineUtility;
            out.lineMarginPercent = econ.lineMarginPercent;
        }
        return out;
    }
};
exports.QuoteItemsService = QuoteItemsService;
exports.QuoteItemsService = QuoteItemsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_versions_service_1.QuoteVersionsService])
], QuoteItemsService);

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
exports.PricesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const strip_sensitive_1 = require("./strip-sensitive");
function dayBefore(date) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() - 1);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}
function parseDate(s) {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) {
        throw new common_1.BadRequestException(`Fecha inválida: ${s}`);
    }
    return d;
}
function endOfUtcDay(d) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}
let PricesService = class PricesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByProductId(productId, currentUser) {
        const product = await this.prisma.product.findUnique({
            where: { id: productId },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Producto con id ${productId} no encontrado`);
        }
        const list = await this.prisma.productPrice.findMany({
            where: { productId },
            orderBy: { validFrom: "desc" },
            include: { supplier: true, updatedBy: true },
        });
        if (!(0, strip_sensitive_1.isAdmin)(currentUser?.roles)) {
            return (0, strip_sensitive_1.stripSensitiveFromPrices)(list);
        }
        return list;
    }
    async findAll(filters, currentUser) {
        const where = {};
        if (filters.productId) {
            where.productId = filters.productId;
        }
        if (filters.supplierId) {
            where.supplierId = filters.supplierId;
        }
        if (filters.supplyOrigin) {
            where.supplier = { supplyOrigin: filters.supplyOrigin };
        }
        if (filters.validAt) {
            const validAt = parseDate(filters.validAt);
            where.validFrom = { lte: validAt };
            where.OR = [{ validTo: null }, { validTo: { gte: validAt } }];
        }
        const list = await this.prisma.productPrice.findMany({
            where: where,
            orderBy: { validFrom: "desc" },
            include: { product: true, supplier: true },
        });
        if (!(0, strip_sensitive_1.isAdmin)(currentUser?.roles)) {
            return (0, strip_sensitive_1.stripSensitiveFromPrices)(list);
        }
        return list;
    }
    async findOne(id, currentUser) {
        const price = await this.prisma.productPrice.findUnique({
            where: { id },
            include: { product: true, supplier: true, updatedBy: true },
        });
        if (!price) {
            throw new common_1.NotFoundException(`Precio con id ${id} no encontrado`);
        }
        if (!(0, strip_sensitive_1.isAdmin)(currentUser?.roles)) {
            return (0, strip_sensitive_1.stripSensitiveFromPrice)(price);
        }
        return price;
    }
    async create(dto) {
        if (!dto.productId) {
            throw new common_1.BadRequestException("productId es obligatorio");
        }
        if (dto.price == null || Number(dto.price) <= 0) {
            throw new common_1.BadRequestException("price es obligatorio y debe ser mayor a 0");
        }
        const validFrom = parseDate(dto.validFrom);
        const validToDto = dto.validTo ? parseDate(dto.validTo) : null;
        const product = await this.prisma.product.findUnique({
            where: { id: dto.productId },
        });
        if (!product) {
            throw new common_1.NotFoundException("Producto no encontrado");
        }
        if (dto.supplierId) {
            const supplier = await this.prisma.supplier.findUnique({
                where: { id: dto.supplierId },
            });
            if (!supplier) {
                throw new common_1.NotFoundException("Proveedor no encontrado");
            }
        }
        if (dto.updatedById) {
            const user = await this.prisma.user.findUnique({
                where: { id: dto.updatedById },
            });
            if (!user) {
                throw new common_1.NotFoundException("Usuario no encontrado");
            }
        }
        await this.prisma.$transaction(async (tx) => {
            const closeDate = dayBefore(validFrom);
            const supplierIdFilter = dto.supplierId ?? null;
            const overlapping = await tx.productPrice.findMany({
                where: {
                    productId: dto.productId,
                    supplierId: supplierIdFilter,
                    OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
                    validFrom: { lte: validToDto ?? new Date("9999-12-31") },
                },
            });
            for (const row of overlapping) {
                await tx.productPrice.update({
                    where: { id: row.id },
                    data: { validTo: closeDate },
                });
            }
            await tx.productPrice.create({
                data: {
                    productId: dto.productId,
                    supplierId: dto.supplierId ?? null,
                    price: dto.price,
                    cost: dto.cost ?? null,
                    purchasePrice: dto.purchasePrice ?? null,
                    currency: dto.currency?.trim() ?? "CLP",
                    priceListType: dto.priceListType?.trim() ?? "BASE",
                    validFrom,
                    validTo: validToDto ?? null,
                    lastQuoteReceivedAt: dto.lastQuoteReceivedAt
                        ? parseDate(dto.lastQuoteReceivedAt)
                        : null,
                    lastUpdatedAt: dto.lastUpdatedAt
                        ? parseDate(dto.lastUpdatedAt)
                        : null,
                    suggestedMarginPercent: dto.suggestedMarginPercent ?? null,
                    supplierDiscountPercent: dto.supplierDiscountPercent ?? null,
                    logisticCostEstimate: dto.logisticCostEstimate ?? null,
                    customsCostEstimate: dto.customsCostEstimate ?? null,
                    totalLandedCost: dto.totalLandedCost ?? null,
                    moq: dto.moq?.trim() ?? null,
                    warranty: dto.warranty?.trim() ?? null,
                    quoteReference: dto.quoteReference?.trim() ?? null,
                    quoteReceivedAt: dto.quoteReceivedAt
                        ? parseDate(dto.quoteReceivedAt)
                        : null,
                    validityIndicator: dto.validityIndicator?.trim() ?? null,
                    internalCommercialNotes: dto.internalCommercialNotes?.trim() ?? null,
                    updatedById: dto.updatedById ?? null,
                },
            });
        });
        const created = await this.prisma.productPrice.findFirst({
            where: {
                productId: dto.productId,
                supplierId: dto.supplierId ?? null,
                validFrom,
            },
            orderBy: { createdAt: "desc" },
            include: { product: true, supplier: true, updatedBy: true },
        });
        return created;
    }
    /**
     * Cierra una fila de precio cuya vigencia sigue abierta (`validTo` null).
     * No borra el registro: mantiene histórico para cotizaciones y auditoría.
     */
    async closeOpenValidity(id, body, currentUser) {
        const price = await this.prisma.productPrice.findUnique({
            where: { id },
        });
        if (!price) {
            throw new common_1.NotFoundException(`Precio con id ${id} no encontrado`);
        }
        if (price.validTo != null) {
            throw new common_1.ConflictException("Este precio ya tiene fin de vigencia; no se puede cerrar de nuevo.");
        }
        const validTo = body?.validTo?.trim()
            ? parseDate(body.validTo.trim())
            : endOfUtcDay(new Date());
        const validFrom = price.validFrom instanceof Date
            ? price.validFrom
            : new Date(price.validFrom);
        if (validTo.getTime() < validFrom.getTime()) {
            throw new common_1.BadRequestException("La fecha de fin de vigencia no puede ser anterior al inicio del precio.");
        }
        await this.prisma.productPrice.update({
            where: { id },
            data: { validTo },
        });
        return this.findOne(id, currentUser);
    }
};
exports.PricesService = PricesService;
exports.PricesService = PricesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PricesService);

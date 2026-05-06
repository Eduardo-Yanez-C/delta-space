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
exports.ProductSuppliersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const products_service_1 = require("./products.service");
let ProductSuppliersService = class ProductSuppliersService {
    constructor(prisma, productsService) {
        this.prisma = prisma;
        this.productsService = productsService;
    }
    async findByProduct(productId) {
        await this.productsService.findOne(productId);
        return this.prisma.productSupplier.findMany({
            where: { productId },
            include: { supplier: true },
            orderBy: [{ isPrimary: "desc" }, { supplier: { name: "asc" } }],
        });
    }
    async add(productId, dto) {
        await this.productsService.findOne(productId);
        const supplier = await this.prisma.supplier.findUnique({
            where: { id: dto.supplierId },
        });
        if (!supplier) {
            throw new common_1.NotFoundException("Proveedor no encontrado");
        }
        if (!supplier.active) {
            throw new common_1.ConflictException("El proveedor está inactivo");
        }
        const existing = await this.prisma.productSupplier.findUnique({
            where: {
                productId_supplierId: { productId, supplierId: dto.supplierId },
            },
        });
        if (existing) {
            throw new common_1.ConflictException("Este proveedor ya está asociado al producto");
        }
        const rel = await this.prisma.productSupplier.create({
            data: {
                productId,
                supplierId: dto.supplierId,
                isPrimary: dto.isPrimary ?? false,
                isAlternative: dto.isAlternative ?? false,
                leadTimeDays: dto.leadTimeDays ?? null,
                moq: dto.moq?.trim() ?? null,
                warranty: dto.warranty?.trim() ?? null,
                notes: dto.notes?.trim() ?? null,
            },
            include: { supplier: true },
        });
        if (dto.isPrimary) {
            await this.productsService.setPrimarySupplier(productId, dto.supplierId, {
                leadTimeDays: dto.leadTimeDays,
                moq: dto.moq,
                warranty: dto.warranty,
                notes: dto.notes,
            });
            return this.prisma.productSupplier.findUnique({
                where: { id: rel.id },
                include: { supplier: true },
            });
        }
        return rel;
    }
    async update(productId, supplierId, dto) {
        const rel = await this.prisma.productSupplier.findUnique({
            where: {
                productId_supplierId: { productId, supplierId },
            },
            include: { supplier: true },
        });
        if (!rel) {
            throw new common_1.NotFoundException("Asociación producto–proveedor no encontrada");
        }
        if (dto.isPrimary === true) {
            await this.productsService.setPrimarySupplier(productId, supplierId, {
                leadTimeDays: dto.leadTimeDays,
                moq: dto.moq,
                warranty: dto.warranty,
                notes: dto.notes,
            });
        }
        else if (dto.isPrimary === false && rel.isPrimary) {
            await this.productsService.setPrimarySupplier(productId, null);
        }
        return this.prisma.productSupplier.update({
            where: { id: rel.id },
            data: {
                ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
                ...(dto.isAlternative !== undefined && {
                    isAlternative: dto.isAlternative,
                }),
                ...(dto.leadTimeDays !== undefined && {
                    leadTimeDays: dto.leadTimeDays ?? null,
                }),
                ...(dto.moq !== undefined && { moq: dto.moq?.trim() ?? null }),
                ...(dto.warranty !== undefined && {
                    warranty: dto.warranty?.trim() ?? null,
                }),
                ...(dto.notes !== undefined && { notes: dto.notes?.trim() ?? null }),
            },
            include: { supplier: true },
        });
    }
    async remove(productId, supplierId) {
        const rel = await this.prisma.productSupplier.findUnique({
            where: {
                productId_supplierId: { productId, supplierId },
            },
        });
        if (!rel) {
            throw new common_1.NotFoundException("Asociación producto–proveedor no encontrada");
        }
        const priceCount = await this.prisma.productPrice.count({
            where: { productId, supplierId },
        });
        if (priceCount > 0) {
            throw new common_1.ConflictException("No se puede eliminar la asociación porque existe historial de precios vinculado a este producto y proveedor. La trazabilidad comercial debe conservarse.");
        }
        const wasPrimary = rel.isPrimary;
        await this.prisma.productSupplier.delete({
            where: { id: rel.id },
        });
        if (wasPrimary) {
            await this.productsService.setPrimarySupplier(productId, null);
        }
        return { deleted: true };
    }
};
exports.ProductSuppliersService = ProductSuppliersService;
exports.ProductSuppliersService = ProductSuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        products_service_1.ProductsService])
], ProductSuppliersService);

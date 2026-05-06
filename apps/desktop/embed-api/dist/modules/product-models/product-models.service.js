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
exports.ProductModelsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let ProductModelsService = class ProductModelsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(brandId) {
        return this.prisma.productModel.findMany({
            where: brandId != null ? { brandId } : undefined,
            orderBy: [{ brandId: "asc" }, { name: "asc" }],
            include: { brand: true },
        });
    }
    async findOne(id) {
        const model = await this.prisma.productModel.findUnique({
            where: { id },
            include: { brand: true },
        });
        if (!model) {
            throw new common_1.NotFoundException(`Modelo con id ${id} no encontrado`);
        }
        return model;
    }
    async create(dto) {
        const brand = await this.prisma.brand.findUnique({
            where: { id: dto.brandId },
        });
        if (!brand) {
            throw new common_1.NotFoundException("Marca no encontrada");
        }
        const name = dto.name.trim();
        const clash = await this.prisma.productModel.findUnique({
            where: { brandId_name: { brandId: dto.brandId, name } },
        });
        if (clash) {
            throw new common_1.ConflictException(`Ya existe el modelo «${name}» para esta marca`);
        }
        return this.prisma.productModel.create({
            data: { brandId: dto.brandId, name },
            include: { brand: true },
        });
    }
    async update(id, dto) {
        const existing = await this.findOne(id);
        const brandId = dto.brandId ?? existing.brandId;
        if (dto.brandId != null) {
            const brand = await this.prisma.brand.findUnique({
                where: { id: dto.brandId },
            });
            if (!brand) {
                throw new common_1.NotFoundException("Marca no encontrada");
            }
        }
        const name = dto.name !== undefined ? dto.name.trim() : existing.name;
        if (dto.name !== undefined || dto.brandId !== undefined) {
            const clash = await this.prisma.productModel.findFirst({
                where: {
                    brandId,
                    name,
                    NOT: { id },
                },
            });
            if (clash) {
                throw new common_1.ConflictException(`Ya existe el modelo «${name}» para la marca indicada`);
            }
        }
        return this.prisma.productModel.update({
            where: { id },
            data: {
                ...(dto.brandId !== undefined && { brandId: dto.brandId }),
                ...(dto.name !== undefined && { name: dto.name.trim() }),
            },
            include: { brand: true },
        });
    }
    async remove(id) {
        await this.findOne(id);
        const counts = await this.prisma.productModel.findUnique({
            where: { id },
            select: {
                _count: {
                    select: {
                        products: true,
                        quoteItems: true,
                        quoteItemLines: true,
                    },
                },
            },
        });
        const c = counts?._count;
        if (!c) {
            throw new common_1.NotFoundException(`Modelo con id ${id} no encontrado`);
        }
        if (c.products > 0 || c.quoteItems > 0 || c.quoteItemLines > 0) {
            throw new common_1.ConflictException(`No se puede eliminar: hay ${c.products} producto(s), ` +
                `${c.quoteItems} ítem(es) y ${c.quoteItemLines} línea(s) de cotización vinculadas.`);
        }
        return this.prisma.productModel.delete({ where: { id } });
    }
};
exports.ProductModelsService = ProductModelsService;
exports.ProductModelsService = ProductModelsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductModelsService);

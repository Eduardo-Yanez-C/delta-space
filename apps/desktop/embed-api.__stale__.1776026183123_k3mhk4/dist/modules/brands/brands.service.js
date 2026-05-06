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
exports.BrandsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
let BrandsService = class BrandsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll() {
        return this.prisma.brand.findMany({
            orderBy: { name: "asc" },
        });
    }
    async findOne(id) {
        const brand = await this.prisma.brand.findUnique({
            where: { id },
            include: { models: true },
        });
        if (!brand) {
            throw new common_1.NotFoundException(`Marca con id ${id} no encontrada`);
        }
        return brand;
    }
    async create(dto) {
        const name = dto.name.trim();
        const clash = await this.prisma.brand.findUnique({ where: { name } });
        if (clash) {
            throw new common_1.ConflictException(`Ya existe la marca «${name}»`);
        }
        return this.prisma.brand.create({ data: { name } });
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.name !== undefined) {
            const name = dto.name.trim();
            const clash = await this.prisma.brand.findFirst({
                where: { name, NOT: { id } },
            });
            if (clash) {
                throw new common_1.ConflictException(`Ya existe la marca «${name}»`);
            }
        }
        return this.prisma.brand.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name.trim() }),
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        const counts = await this.prisma.brand.findUnique({
            where: { id },
            select: {
                _count: {
                    select: {
                        products: true,
                        models: true,
                        quoteItems: true,
                        quoteItemLines: true,
                    },
                },
            },
        });
        const c = counts?._count;
        if (!c) {
            throw new common_1.NotFoundException(`Marca con id ${id} no encontrada`);
        }
        if (c.models > 0) {
            throw new common_1.ConflictException(`No se puede eliminar: la marca tiene ${c.models} modelo(s). Elimine o reasigne modelos primero.`);
        }
        if (c.products > 0 || c.quoteItems > 0 || c.quoteItemLines > 0) {
            throw new common_1.ConflictException(`No se puede eliminar: hay ${c.products} producto(s), ` +
                `${c.quoteItems} ítem(es) y ${c.quoteItemLines} línea(s) de cotización vinculadas.`);
        }
        return this.prisma.brand.delete({ where: { id } });
    }
};
exports.BrandsService = BrandsService;
exports.BrandsService = BrandsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BrandsService);

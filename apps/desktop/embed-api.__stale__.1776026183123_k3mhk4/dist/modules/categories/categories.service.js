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
exports.CategoriesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
function normalizeSlug(raw) {
    return raw
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
}
let CategoriesService = class CategoriesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(includeChildren = true) {
        return this.prisma.productCategory.findMany({
            orderBy: { name: "asc" },
            include: includeChildren ? { children: true } : undefined,
        });
    }
    async findOne(id) {
        const category = await this.prisma.productCategory.findUnique({
            where: { id },
            include: { parent: true, children: true },
        });
        if (!category) {
            throw new common_1.NotFoundException(`Categoría con id ${id} no encontrada`);
        }
        return category;
    }
    async create(dto) {
        const slug = normalizeSlug(dto.slug);
        if (!slug) {
            throw new common_1.BadRequestException("slug inválido tras normalizar");
        }
        const clash = await this.prisma.productCategory.findUnique({
            where: { slug },
        });
        if (clash) {
            throw new common_1.ConflictException(`Ya existe categoría con slug «${slug}»`);
        }
        if (dto.parentId != null) {
            const parent = await this.prisma.productCategory.findUnique({
                where: { id: dto.parentId },
            });
            if (!parent) {
                throw new common_1.NotFoundException("Categoría padre no encontrada");
            }
        }
        return this.prisma.productCategory.create({
            data: {
                name: dto.name.trim(),
                slug,
                parentId: dto.parentId ?? null,
            },
        });
    }
    async assertNoParentCycle(categoryId, newParentId) {
        if (newParentId == null)
            return;
        let cur = newParentId;
        const seen = new Set();
        while (cur != null) {
            if (cur === categoryId) {
                throw new common_1.BadRequestException("La categoría padre genera un ciclo en la jerarquía");
            }
            if (seen.has(cur))
                break;
            seen.add(cur);
            const row = await this.prisma.productCategory.findUnique({
                where: { id: cur },
                select: { parentId: true },
            });
            cur = row?.parentId ?? null;
        }
    }
    async update(id, dto) {
        await this.findOne(id);
        let slug;
        if (dto.slug !== undefined) {
            slug = normalizeSlug(dto.slug);
            if (!slug) {
                throw new common_1.BadRequestException("slug inválido tras normalizar");
            }
            const clash = await this.prisma.productCategory.findFirst({
                where: { slug, NOT: { id } },
            });
            if (clash) {
                throw new common_1.ConflictException(`Ya existe categoría con slug «${slug}»`);
            }
        }
        if (dto.parentId !== undefined) {
            if (dto.parentId != null) {
                const parent = await this.prisma.productCategory.findUnique({
                    where: { id: dto.parentId },
                });
                if (!parent) {
                    throw new common_1.NotFoundException("Categoría padre no encontrada");
                }
                await this.assertNoParentCycle(id, dto.parentId);
            }
        }
        return this.prisma.productCategory.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name.trim() }),
                ...(slug !== undefined && { slug }),
                ...(dto.parentId !== undefined && { parentId: dto.parentId }),
            },
        });
    }
    async remove(id) {
        await this.findOne(id);
        const counts = await this.prisma.productCategory.findUnique({
            where: { id },
            select: {
                _count: {
                    select: {
                        products: true,
                        children: true,
                        quoteItems: true,
                        quoteItemLines: true,
                    },
                },
            },
        });
        const c = counts?._count;
        if (!c) {
            throw new common_1.NotFoundException(`Categoría con id ${id} no encontrada`);
        }
        if (c.children > 0) {
            throw new common_1.ConflictException(`No se puede eliminar: la categoría tiene ${c.children} subcategoría(s).`);
        }
        if (c.products > 0 || c.quoteItems > 0 || c.quoteItemLines > 0) {
            throw new common_1.ConflictException(`No se puede eliminar: hay ${c.products} producto(s), ` +
                `${c.quoteItems} ítem(es) de cotización y ${c.quoteItemLines} línea(s) vinculadas.`);
        }
        return this.prisma.productCategory.delete({ where: { id } });
    }
};
exports.CategoriesService = CategoriesService;
exports.CategoriesService = CategoriesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CategoriesService);

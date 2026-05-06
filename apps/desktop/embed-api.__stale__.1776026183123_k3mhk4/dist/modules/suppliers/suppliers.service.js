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
exports.SuppliersService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const SUPPLY_ORIGINS = ["NACIONAL", "INTERNACIONAL"];
const ACTOR_TYPES = [
    "FABRICANTE",
    "DISTRIBUIDOR",
    "REPRESENTANTE",
    "IMPORTADOR",
    "INTEGRADOR",
];
function validateSupplyOrigin(value) {
    if (!SUPPLY_ORIGINS.includes(value)) {
        throw new common_1.BadRequestException(`supplyOrigin debe ser uno de: ${SUPPLY_ORIGINS.join(", ")}`);
    }
}
function validateActorType(value) {
    if (!ACTOR_TYPES.includes(value)) {
        throw new common_1.BadRequestException(`actorType debe ser uno de: ${ACTOR_TYPES.join(", ")}`);
    }
}
let SuppliersService = class SuppliersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(filters) {
        const where = {};
        if (filters.supplyOrigin != null) {
            validateSupplyOrigin(filters.supplyOrigin);
            where.supplyOrigin = filters.supplyOrigin;
        }
        if (filters.actorType != null) {
            validateActorType(filters.actorType);
            where.actorType = filters.actorType;
        }
        if (filters.active !== undefined) {
            where.active = filters.active;
        }
        return this.prisma.supplier.findMany({
            where: where,
            orderBy: { name: "asc" },
        });
    }
    async findOne(id) {
        const supplier = await this.prisma.supplier.findUnique({
            where: { id },
        });
        if (!supplier) {
            throw new common_1.NotFoundException(`Proveedor con id ${id} no encontrado`);
        }
        return supplier;
    }
    async create(dto) {
        if (!dto.name?.trim()) {
            throw new common_1.BadRequestException("name es obligatorio");
        }
        validateSupplyOrigin(dto.supplyOrigin);
        validateActorType(dto.actorType);
        return this.prisma.supplier.create({
            data: {
                name: dto.name.trim(),
                legalName: dto.legalName?.trim() ?? null,
                taxId: dto.taxId?.trim() ?? null,
                contactName: dto.contactName?.trim() ?? null,
                email: dto.email?.trim() ?? null,
                phone: dto.phone?.trim() ?? null,
                country: dto.country?.trim() ?? null,
                city: dto.city?.trim() ?? null,
                defaultCurrency: dto.defaultCurrency?.trim() ?? null,
                supplyOrigin: dto.supplyOrigin,
                actorType: dto.actorType,
                paymentTerms: dto.paymentTerms?.trim() ?? null,
                leadTimeDays: dto.leadTimeDays ?? null,
                notes: dto.notes?.trim() ?? null,
                active: dto.active ?? true,
            },
        });
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.supplyOrigin != null) {
            validateSupplyOrigin(dto.supplyOrigin);
        }
        if (dto.actorType != null) {
            validateActorType(dto.actorType);
        }
        if (dto.name !== undefined && !dto.name?.trim()) {
            throw new common_1.BadRequestException("name no puede estar vacío");
        }
        return this.prisma.supplier.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name.trim() }),
                ...(dto.legalName !== undefined && {
                    legalName: dto.legalName?.trim() ?? null,
                }),
                ...(dto.taxId !== undefined && { taxId: dto.taxId?.trim() ?? null }),
                ...(dto.contactName !== undefined && {
                    contactName: dto.contactName?.trim() ?? null,
                }),
                ...(dto.email !== undefined && {
                    email: dto.email?.trim() ?? null,
                }),
                ...(dto.phone !== undefined && {
                    phone: dto.phone?.trim() ?? null,
                }),
                ...(dto.country !== undefined && {
                    country: dto.country?.trim() ?? null,
                }),
                ...(dto.city !== undefined && { city: dto.city?.trim() ?? null }),
                ...(dto.defaultCurrency !== undefined && {
                    defaultCurrency: dto.defaultCurrency?.trim() ?? null,
                }),
                ...(dto.supplyOrigin !== undefined && {
                    supplyOrigin: dto.supplyOrigin,
                }),
                ...(dto.actorType !== undefined && { actorType: dto.actorType }),
                ...(dto.paymentTerms !== undefined && {
                    paymentTerms: dto.paymentTerms?.trim() ?? null,
                }),
                ...(dto.leadTimeDays !== undefined && {
                    leadTimeDays: dto.leadTimeDays ?? null,
                }),
                ...(dto.notes !== undefined && {
                    notes: dto.notes?.trim() ?? null,
                }),
                ...(dto.active !== undefined && { active: dto.active }),
            },
        });
    }
    async deactivate(id) {
        await this.findOne(id);
        return this.prisma.supplier.update({
            where: { id },
            data: { active: false },
        });
    }
    async activate(id) {
        await this.findOne(id);
        return this.prisma.supplier.update({
            where: { id },
            data: { active: true },
        });
    }
    async remove(id) {
        await this.findOne(id);
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.product.updateMany({
                    where: { primarySupplierId: id },
                    data: { primarySupplierId: null },
                });
                await tx.productSupplier.deleteMany({ where: { supplierId: id } });
                await tx.productPrice.deleteMany({ where: { supplierId: id } });
                await tx.supplier.delete({ where: { id } });
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
                throw new common_1.BadRequestException("No se puede eliminar: el proveedor sigue referenciado en datos vinculados.");
            }
            throw e;
        }
        return { deleted: true };
    }
};
exports.SuppliersService = SuppliersService;
exports.SuppliersService = SuppliersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SuppliersService);

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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const strip_sensitive_1 = require("../prices/strip-sensitive");
const COMMERCIAL_STATUSES = [
    "ACTIVO",
    "DESCONTINUADO",
    "BAJO_REVISION",
];
function validateCommercialStatus(value) {
    if (!COMMERCIAL_STATUSES.includes(value)) {
        throw new common_1.BadRequestException(`commercialStatus debe ser uno de: ${COMMERCIAL_STATUSES.join(", ")}`);
    }
}
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async setPrimarySupplier(productId, supplierId, relationData) {
        await this.prisma.$transaction(async (tx) => {
            if (supplierId === null) {
                await tx.productSupplier.updateMany({
                    where: { productId },
                    data: { isPrimary: false },
                });
                await tx.product.update({
                    where: { id: productId },
                    data: { primarySupplierId: null },
                });
                return;
            }
            let rel = await tx.productSupplier.findUnique({
                where: {
                    productId_supplierId: { productId, supplierId },
                },
            });
            if (!rel) {
                await tx.productSupplier.create({
                    data: {
                        productId,
                        supplierId,
                        isPrimary: true,
                        isAlternative: false,
                        leadTimeDays: relationData?.leadTimeDays ?? null,
                        moq: relationData?.moq ?? null,
                        warranty: relationData?.warranty ?? null,
                        notes: relationData?.notes ?? null,
                    },
                });
            }
            else {
                await tx.productSupplier.update({
                    where: { id: rel.id },
                    data: {
                        isPrimary: true,
                        ...(relationData && {
                            leadTimeDays: relationData.leadTimeDays ?? undefined,
                            moq: relationData.moq ?? undefined,
                            warranty: relationData.warranty ?? undefined,
                            notes: relationData.notes ?? undefined,
                        }),
                    },
                });
            }
            await tx.productSupplier.updateMany({
                where: { productId, isPrimary: true, NOT: { supplierId } },
                data: { isPrimary: false },
            });
            await tx.product.update({
                where: { id: productId },
                data: { primarySupplierId: supplierId },
            });
        });
    }
    async findAll(filters) {
        const where = {};
        if (filters.categoryId != null) {
            where.categoryId = filters.categoryId;
        }
        if (filters.brandId != null) {
            where.brandId = filters.brandId;
        }
        if (filters.modelId != null) {
            where.modelId = filters.modelId;
        }
        if (filters.commercialStatus != null) {
            validateCommercialStatus(filters.commercialStatus);
            where.commercialStatus = filters.commercialStatus;
        }
        if (filters.supplierId != null || filters.supplyOrigin != null) {
            where.productSuppliers = {
                some: {
                    ...(filters.supplierId != null && { supplierId: filters.supplierId }),
                    ...(filters.supplyOrigin != null && {
                        supplier: { supplyOrigin: filters.supplyOrigin },
                    }),
                },
            };
        }
        if (filters.search?.trim()) {
            const term = filters.search.trim();
            where.OR = [
                { name: { contains: term } },
                { internalCode: { contains: term } },
                { sku: { contains: term } },
            ];
        }
        return this.prisma.product.findMany({
            where: where,
            orderBy: { name: "asc" },
            include: {
                category: true,
                brand: true,
                model: true,
                primarySupplier: true,
                panelSpecs: true,
            },
        });
    }
    async findOne(id, includeLatestPrice = false, currentUser) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                brand: true,
                model: true,
                primarySupplier: true,
                panelSpecs: true,
                inverterSpecs: true,
                batterySpecs: true,
                productSuppliers: { include: { supplier: true } },
                ...(includeLatestPrice && {
                    prices: {
                        take: 1,
                        orderBy: { validFrom: "desc" },
                        include: { supplier: true },
                    },
                }),
            },
        });
        if (!product) {
            throw new common_1.NotFoundException(`Producto con id ${id} no encontrado`);
        }
        if (includeLatestPrice &&
            "prices" in product &&
            Array.isArray(product.prices) &&
            product.prices.length > 0 &&
            !(0, strip_sensitive_1.isAdmin)(currentUser?.roles)) {
            product.prices = (0, strip_sensitive_1.stripSensitiveFromPrices)(product.prices);
        }
        return product;
    }
    async create(dto) {
        if (!dto.name?.trim()) {
            throw new common_1.BadRequestException("name es obligatorio");
        }
        if (!dto.unit?.trim()) {
            throw new common_1.BadRequestException("unit es obligatorio");
        }
        if (dto.categoryId == null) {
            throw new common_1.BadRequestException("categoryId es obligatorio");
        }
        const category = await this.prisma.productCategory.findUnique({
            where: { id: dto.categoryId },
        });
        if (!category) {
            throw new common_1.NotFoundException("Categoría no encontrada");
        }
        if (dto.brandId != null) {
            const brand = await this.prisma.brand.findUnique({
                where: { id: dto.brandId },
            });
            if (!brand) {
                throw new common_1.NotFoundException("Marca no encontrada");
            }
        }
        if (dto.modelId != null) {
            const model = await this.prisma.productModel.findUnique({
                where: { id: dto.modelId },
                include: { brand: true },
            });
            if (!model) {
                throw new common_1.NotFoundException("Modelo no encontrado");
            }
            if (dto.brandId != null && model.brandId !== dto.brandId) {
                throw new common_1.BadRequestException("modelId no corresponde a la marca indicada");
            }
        }
        if (dto.primarySupplierId != null) {
            const supplier = await this.prisma.supplier.findUnique({
                where: { id: dto.primarySupplierId },
            });
            if (!supplier) {
                throw new common_1.NotFoundException("Proveedor no encontrado");
            }
            if (!supplier.active) {
                throw new common_1.BadRequestException("El proveedor está inactivo");
            }
        }
        if (dto.commercialStatus != null) {
            validateCommercialStatus(dto.commercialStatus);
        }
        const product = await this.prisma.product.create({
            data: {
                name: dto.name.trim(),
                description: dto.description?.trim() ?? null,
                internalCode: dto.internalCode?.trim() ?? null,
                sku: dto.sku?.trim() ?? null,
                technicalSheetUrl: dto.technicalSheetUrl?.trim() ?? null,
                realManufacturer: dto.realManufacturer?.trim() ?? null,
                commercialStatus: dto.commercialStatus ?? "ACTIVO",
                defaultCurrency: dto.defaultCurrency?.trim() ?? null,
                unit: dto.unit.trim(),
                purchaseUnit: dto.purchaseUnit?.trim() ?? null,
                warranty: dto.warranty?.trim() ?? null,
                leadTimeDays: dto.leadTimeDays ?? null,
                stockReference: dto.stockReference?.trim() ?? null,
                origin: dto.origin?.trim() ?? null,
                internalNotes: dto.internalNotes?.trim() ?? null,
                categoryId: dto.categoryId,
                brandId: dto.brandId ?? null,
                brandNameFree: dto.brandNameFree?.trim() ?? null,
                modelId: dto.modelId ?? null,
                modelNameFree: dto.modelNameFree?.trim() ?? null,
                primarySupplierId: null,
                technicalType: dto.technicalType?.trim() ?? null,
                powerW: dto.powerW ?? null,
                maxCurrentA: dto.maxCurrentA ?? null,
                efficiencyPercent: dto.efficiencyPercent ?? null,
            },
        });
        if (dto.panelSpecs != null && typeof dto.panelSpecs === "object") {
            const ps = dto.panelSpecs;
            const hasAny = ps.powerW != null ||
                ps.efficiencyPercent != null ||
                ps.vmpV != null ||
                ps.impA != null ||
                ps.vocV != null ||
                ps.iscA != null ||
                ps.bifacialityPercent != null ||
                (ps.cellType != null && ps.cellType.trim() !== "") ||
                ps.lengthMm != null ||
                ps.widthMm != null ||
                ps.heightMm != null ||
                ps.weightKg != null;
            if (hasAny) {
                await this.prisma.productPanelSpecs.create({
                    data: {
                        productId: product.id,
                        ...(ps.powerW != null && { powerW: ps.powerW }),
                        ...(ps.efficiencyPercent != null && {
                            efficiencyPercent: ps.efficiencyPercent,
                        }),
                        ...(ps.vmpV != null && { vmpV: ps.vmpV }),
                        ...(ps.impA != null && { impA: ps.impA }),
                        ...(ps.vocV != null && { vocV: ps.vocV }),
                        ...(ps.iscA != null && { iscA: ps.iscA }),
                        ...(ps.bifacialityPercent != null && {
                            bifacialityPercent: ps.bifacialityPercent,
                        }),
                        ...(ps.cellType != null &&
                            ps.cellType.trim() !== "" && { cellType: ps.cellType.trim() }),
                        ...(ps.lengthMm != null && { lengthMm: ps.lengthMm }),
                        ...(ps.widthMm != null && { widthMm: ps.widthMm }),
                        ...(ps.heightMm != null && { heightMm: ps.heightMm }),
                        ...(ps.weightKg != null && { weightKg: ps.weightKg }),
                    },
                });
            }
        }
        if (dto.inverterSpecs != null && typeof dto.inverterSpecs === "object") {
            const inv = dto.inverterSpecs;
            const hasAny = inv.inverterType != null ||
                inv.powerAcW != null ||
                inv.maxPvVoltageV != null ||
                inv.startupVoltageV != null ||
                inv.mpptVoltageMinV != null ||
                inv.mpptVoltageMaxV != null ||
                inv.maxDcCurrentA != null ||
                inv.efficiencyPercent != null ||
                (inv.connectionType != null && inv.connectionType.trim() !== "") ||
                (inv.ipRating != null && inv.ipRating.trim() !== "") ||
                (inv.communication != null && inv.communication.trim() !== "");
            if (hasAny) {
                await this.prisma.productInverterSpecs.create({
                    data: {
                        productId: product.id,
                        ...(inv.inverterType != null &&
                            inv.inverterType.trim() !== "" && {
                            inverterType: inv.inverterType.trim(),
                        }),
                        ...(inv.powerAcW != null && { powerAcW: inv.powerAcW }),
                        ...(inv.maxPvVoltageV != null && {
                            maxPvVoltageV: inv.maxPvVoltageV,
                        }),
                        ...(inv.startupVoltageV != null && {
                            startupVoltageV: inv.startupVoltageV,
                        }),
                        ...(inv.mpptVoltageMinV != null && {
                            mpptVoltageMinV: inv.mpptVoltageMinV,
                        }),
                        ...(inv.mpptVoltageMaxV != null && {
                            mpptVoltageMaxV: inv.mpptVoltageMaxV,
                        }),
                        ...(inv.maxDcCurrentA != null && {
                            maxDcCurrentA: inv.maxDcCurrentA,
                        }),
                        ...(inv.efficiencyPercent != null && {
                            efficiencyPercent: inv.efficiencyPercent,
                        }),
                        ...(inv.connectionType != null &&
                            inv.connectionType.trim() !== "" && {
                            connectionType: inv.connectionType.trim(),
                        }),
                        ...(inv.ipRating != null &&
                            inv.ipRating.trim() !== "" && { ipRating: inv.ipRating.trim() }),
                        ...(inv.communication != null &&
                            inv.communication.trim() !== "" && {
                            communication: inv.communication.trim(),
                        }),
                    },
                });
            }
        }
        if (dto.batterySpecs != null && typeof dto.batterySpecs === "object") {
            const bat = dto.batterySpecs;
            const hasAny = bat.capacityKwh != null ||
                bat.nominalVoltageV != null ||
                bat.maxChargeDischargePowerW != null ||
                (bat.chemistry != null && bat.chemistry.trim() !== "") ||
                bat.cycles != null ||
                bat.weightKg != null ||
                (bat.dimensionsMm != null && bat.dimensionsMm.trim() !== "");
            if (hasAny) {
                await this.prisma.productBatterySpecs.create({
                    data: {
                        productId: product.id,
                        ...(bat.capacityKwh != null && { capacityKwh: bat.capacityKwh }),
                        ...(bat.nominalVoltageV != null && {
                            nominalVoltageV: bat.nominalVoltageV,
                        }),
                        ...(bat.maxChargeDischargePowerW != null && {
                            maxChargeDischargePowerW: bat.maxChargeDischargePowerW,
                        }),
                        ...(bat.chemistry != null &&
                            bat.chemistry.trim() !== "" && {
                            chemistry: bat.chemistry.trim(),
                        }),
                        ...(bat.cycles != null && { cycles: bat.cycles }),
                        ...(bat.weightKg != null && { weightKg: bat.weightKg }),
                        ...(bat.dimensionsMm != null &&
                            bat.dimensionsMm.trim() !== "" && {
                            dimensionsMm: bat.dimensionsMm.trim(),
                        }),
                    },
                });
            }
        }
        if (dto.primarySupplierId) {
            await this.setPrimarySupplier(product.id, dto.primarySupplierId);
        }
        return this.findOne(product.id);
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.categoryId != null) {
            const category = await this.prisma.productCategory.findUnique({
                where: { id: dto.categoryId },
            });
            if (!category) {
                throw new common_1.NotFoundException("Categoría no encontrada");
            }
        }
        if (dto.brandId != null) {
            const brand = await this.prisma.brand.findUnique({
                where: { id: dto.brandId },
            });
            if (!brand) {
                throw new common_1.NotFoundException("Marca no encontrada");
            }
        }
        if (dto.modelId != null) {
            const model = await this.prisma.productModel.findUnique({
                where: { id: dto.modelId },
            });
            if (!model) {
                throw new common_1.NotFoundException("Modelo no encontrado");
            }
            if (dto.brandId != null && model.brandId !== dto.brandId) {
                throw new common_1.BadRequestException("modelId no corresponde a la marca indicada");
            }
        }
        if (dto.primarySupplierId !== undefined) {
            if (dto.primarySupplierId === null) {
                await this.setPrimarySupplier(id, null);
            }
            else {
                const supplier = await this.prisma.supplier.findUnique({
                    where: { id: dto.primarySupplierId },
                });
                if (!supplier) {
                    throw new common_1.NotFoundException("Proveedor no encontrado");
                }
                if (!supplier.active) {
                    throw new common_1.BadRequestException("El proveedor está inactivo");
                }
                await this.setPrimarySupplier(id, dto.primarySupplierId);
            }
        }
        if (dto.commercialStatus != null) {
            validateCommercialStatus(dto.commercialStatus);
        }
        if (dto.name !== undefined && !dto.name?.trim()) {
            throw new common_1.BadRequestException("name no puede estar vacío");
        }
        if (dto.unit !== undefined && !dto.unit?.trim()) {
            throw new common_1.BadRequestException("unit no puede estar vacío");
        }
        await this.prisma.product.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name.trim() }),
                ...(dto.description !== undefined && {
                    description: dto.description?.trim() ?? null,
                }),
                ...(dto.internalCode !== undefined && {
                    internalCode: dto.internalCode?.trim() ?? null,
                }),
                ...(dto.sku !== undefined && { sku: dto.sku?.trim() ?? null }),
                ...(dto.technicalSheetUrl !== undefined && {
                    technicalSheetUrl: dto.technicalSheetUrl?.trim() ?? null,
                }),
                ...(dto.realManufacturer !== undefined && {
                    realManufacturer: dto.realManufacturer?.trim() ?? null,
                }),
                ...(dto.commercialStatus !== undefined && {
                    commercialStatus: dto.commercialStatus,
                }),
                ...(dto.defaultCurrency !== undefined && {
                    defaultCurrency: dto.defaultCurrency?.trim() ?? null,
                }),
                ...(dto.unit !== undefined && { unit: dto.unit.trim() }),
                ...(dto.purchaseUnit !== undefined && {
                    purchaseUnit: dto.purchaseUnit?.trim() ?? null,
                }),
                ...(dto.warranty !== undefined && {
                    warranty: dto.warranty?.trim() ?? null,
                }),
                ...(dto.leadTimeDays !== undefined && {
                    leadTimeDays: dto.leadTimeDays ?? null,
                }),
                ...(dto.stockReference !== undefined && {
                    stockReference: dto.stockReference?.trim() ?? null,
                }),
                ...(dto.origin !== undefined && {
                    origin: dto.origin?.trim() ?? null,
                }),
                ...(dto.internalNotes !== undefined && {
                    internalNotes: dto.internalNotes?.trim() ?? null,
                }),
                ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
                ...(dto.brandId !== undefined && { brandId: dto.brandId ?? null }),
                ...(dto.brandNameFree !== undefined && {
                    brandNameFree: dto.brandNameFree?.trim() ?? null,
                }),
                ...(dto.modelId !== undefined && { modelId: dto.modelId ?? null }),
                ...(dto.modelNameFree !== undefined && {
                    modelNameFree: dto.modelNameFree?.trim() ?? null,
                }),
                ...(dto.technicalType !== undefined && {
                    technicalType: dto.technicalType?.trim() ?? null,
                }),
                ...(dto.powerW !== undefined && { powerW: dto.powerW ?? null }),
                ...(dto.maxCurrentA !== undefined && {
                    maxCurrentA: dto.maxCurrentA ?? null,
                }),
                ...(dto.efficiencyPercent !== undefined && {
                    efficiencyPercent: dto.efficiencyPercent ?? null,
                }),
            },
        });
        if (dto.panelSpecs !== undefined) {
            if (dto.panelSpecs === null) {
                await this.prisma.productPanelSpecs.deleteMany({ where: { productId: id } });
            }
            else {
                const ps = dto.panelSpecs;
                const data = {
                    ...(ps.powerW !== undefined && { powerW: ps.powerW }),
                    ...(ps.efficiencyPercent !== undefined && {
                        efficiencyPercent: ps.efficiencyPercent,
                    }),
                    ...(ps.vmpV !== undefined && { vmpV: ps.vmpV }),
                    ...(ps.impA !== undefined && { impA: ps.impA }),
                    ...(ps.vocV !== undefined && { vocV: ps.vocV }),
                    ...(ps.iscA !== undefined && { iscA: ps.iscA }),
                    ...(ps.bifacialityPercent !== undefined && {
                        bifacialityPercent: ps.bifacialityPercent,
                    }),
                    ...(ps.cellType !== undefined && {
                        cellType: ps.cellType?.trim() ?? null,
                    }),
                    ...(ps.lengthMm !== undefined && { lengthMm: ps.lengthMm }),
                    ...(ps.widthMm !== undefined && { widthMm: ps.widthMm }),
                    ...(ps.heightMm !== undefined && { heightMm: ps.heightMm }),
                    ...(ps.weightKg !== undefined && { weightKg: ps.weightKg }),
                };
                await this.prisma.productPanelSpecs.upsert({
                    where: { productId: id },
                    create: { productId: id, ...data },
                    update: data,
                });
            }
        }
        if (dto.inverterSpecs !== undefined) {
            if (dto.inverterSpecs === null) {
                await this.prisma.productInverterSpecs.deleteMany({
                    where: { productId: id },
                });
            }
            else {
                const inv = dto.inverterSpecs;
                const data = {
                    ...(inv.inverterType !== undefined && {
                        inverterType: inv.inverterType?.trim() ?? null,
                    }),
                    ...(inv.powerAcW !== undefined && { powerAcW: inv.powerAcW }),
                    ...(inv.maxPvVoltageV !== undefined && {
                        maxPvVoltageV: inv.maxPvVoltageV,
                    }),
                    ...(inv.startupVoltageV !== undefined && {
                        startupVoltageV: inv.startupVoltageV,
                    }),
                    ...(inv.mpptVoltageMinV !== undefined && {
                        mpptVoltageMinV: inv.mpptVoltageMinV,
                    }),
                    ...(inv.mpptVoltageMaxV !== undefined && {
                        mpptVoltageMaxV: inv.mpptVoltageMaxV,
                    }),
                    ...(inv.maxDcCurrentA !== undefined && {
                        maxDcCurrentA: inv.maxDcCurrentA,
                    }),
                    ...(inv.efficiencyPercent !== undefined && {
                        efficiencyPercent: inv.efficiencyPercent,
                    }),
                    ...(inv.connectionType !== undefined && {
                        connectionType: inv.connectionType?.trim() ?? null,
                    }),
                    ...(inv.ipRating !== undefined && {
                        ipRating: inv.ipRating?.trim() ?? null,
                    }),
                    ...(inv.communication !== undefined && {
                        communication: inv.communication?.trim() ?? null,
                    }),
                };
                await this.prisma.productInverterSpecs.upsert({
                    where: { productId: id },
                    create: { productId: id, ...data },
                    update: data,
                });
            }
        }
        if (dto.batterySpecs !== undefined) {
            if (dto.batterySpecs === null) {
                await this.prisma.productBatterySpecs.deleteMany({
                    where: { productId: id },
                });
            }
            else {
                const bat = dto.batterySpecs;
                const data = {
                    ...(bat.capacityKwh !== undefined && {
                        capacityKwh: bat.capacityKwh,
                    }),
                    ...(bat.nominalVoltageV !== undefined && {
                        nominalVoltageV: bat.nominalVoltageV,
                    }),
                    ...(bat.maxChargeDischargePowerW !== undefined && {
                        maxChargeDischargePowerW: bat.maxChargeDischargePowerW,
                    }),
                    ...(bat.chemistry !== undefined && {
                        chemistry: bat.chemistry?.trim() ?? null,
                    }),
                    ...(bat.cycles !== undefined && { cycles: bat.cycles }),
                    ...(bat.weightKg !== undefined && { weightKg: bat.weightKg }),
                    ...(bat.dimensionsMm !== undefined && {
                        dimensionsMm: bat.dimensionsMm?.trim() ?? null,
                    }),
                };
                await this.prisma.productBatterySpecs.upsert({
                    where: { productId: id },
                    create: { productId: id, ...data },
                    update: data,
                });
            }
        }
        return this.findOne(id);
    }
    async deactivate(id) {
        await this.findOne(id);
        await this.prisma.product.update({
            where: { id },
            data: { commercialStatus: "DESCONTINUADO" },
        });
        return this.findOne(id);
    }
    async activate(id) {
        await this.findOne(id);
        await this.prisma.product.update({
            where: { id },
            data: { commercialStatus: "ACTIVO" },
        });
        return this.findOne(id);
    }
    /**
     * Elimina el producto. Desvincula referencias en cotizaciones (snapshots de nombre se conservan).
     */
    async remove(id) {
        await this.findOne(id);
        try {
            await this.prisma.$transaction(async (tx) => {
                await tx.quoteItemLine.updateMany({
                    where: { productId: id },
                    data: { productId: null },
                });
                await tx.quoteItem.updateMany({
                    where: { productId: id },
                    data: { productId: null },
                });
                await tx.quoteTemplateLine.updateMany({
                    where: { productId: id },
                    data: { productId: null },
                });
                await tx.productSupplier.deleteMany({ where: { productId: id } });
                await tx.productPrice.deleteMany({ where: { productId: id } });
                await tx.product.delete({ where: { id } });
            });
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
                throw new common_1.BadRequestException("No se puede eliminar: el producto sigue referenciado en datos que deben ajustarse manualmente.");
            }
            throw e;
        }
        return { deleted: true };
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);

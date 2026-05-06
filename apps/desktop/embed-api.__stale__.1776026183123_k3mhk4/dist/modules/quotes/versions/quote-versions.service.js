"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuoteVersionsService = exports.ADICIONALES_MAIN_ITEM_NAME = void 0;
// @ts-nocheck
// Lógica generada desde dist (emit-quote-versions-service.js); tipado gradual en etapas posteriores.
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const roleConstants = __importStar(require("../../auth/role-constants"));
const quoteAccess = __importStar(require("../quote-access.helper"));
const quoteMarginEconomics = __importStar(require("../quote-margin-economics.helper"));
const prisma_service_1 = require("../../../infra/prisma/prisma.service");
const DEFAULT_VAT_PERCENT = 19;
exports.ADICIONALES_MAIN_ITEM_NAME = "Adicionales";
function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d)
        return d.toNumber();
    return Number(d);
}
function mainItemEffectiveTotal(totalMode, totalOverride, lines) {
    if (totalMode === "SUM_LINES") {
        return lines.reduce((sum, l) => sum + toNum(l.lineTotalSnapshot), 0);
    }
    return toNum(totalOverride);
}
let QuoteVersionsService = class QuoteVersionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(quoteId, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { id: true, quoteKind: true, ownerId: true, salespersonId: true },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (!quoteAccess.canAccessQuote(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        const versions = await this.prisma.quoteVersion.findMany({
            where: { quoteId },
            orderBy: { versionNumber: "asc" },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
            },
        });
        return versions.map((v) => ({
            id: v.id,
            versionNumber: v.versionNumber,
            status: v.status,
            subtotal: toNum(v.subtotal),
            discountsTotal: toNum(v.discountsTotal),
            marginTotal: toNum(v.marginTotal),
            taxesTotal: toNum(v.taxesTotal),
            total: toNum(v.total),
            globalDiscountPercent: v.globalDiscountPercent != null ? toNum(v.globalDiscountPercent) : null,
            globalMarginPercent: v.globalMarginPercent != null ? toNum(v.globalMarginPercent) : null,
            vatPercent: toNum(v.vatPercent),
            createdAt: v.createdAt,
            createdBy: v.createdBy,
        }));
    }
    async findOne(quoteId, versionId, currentUser) {
        const qAccess = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true, ownerId: true, salespersonId: true },
        });
        if (!qAccess) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        if (!currentUser || !quoteAccess.canAccessQuote(currentUser, qAccess)) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
                items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
                mainItems: {
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                    include: {
                        lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
                    },
                },
            },
        });
        if (!version) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        const isMarginQuote = qAccess.quoteKind === "MARGIN";
        const showCosts = roleConstants.hasGlobalAdminPrivileges(currentUser?.roles ?? []) || isMarginQuote;
        const mapLineOutput = (l) => {
            const lineTotalSale = toNum(l.lineTotalSnapshot);
            const qty = toNum(l.quantity);
            const uc = l.unitCostSnapshot != null ? toNum(l.unitCostSnapshot) : null;
            const line = {
                id: l.id,
                productId: l.productId,
                productNameSnapshot: l.productNameSnapshot,
                productDescriptionSnapshot: l.productDescriptionSnapshot,
                categoryNameSnapshot: l.categoryNameSnapshot,
                brandNameSnapshot: l.brandNameSnapshot,
                modelNameSnapshot: l.modelNameSnapshot,
                currencySnapshot: l.currencySnapshot,
                unitPriceSnapshot: toNum(l.unitPriceSnapshot),
                discountPercentSnapshot: l.discountPercentSnapshot != null ? toNum(l.discountPercentSnapshot) : null,
                quantity: qty,
                lineTotalSnapshot: lineTotalSale,
                sortOrder: l.sortOrder,
                visibleInFinalQuote: l.visibleInFinalQuote,
            };
            if (showCosts) {
                line.unitCostSnapshot = uc;
                line.marginPercentSnapshot = l.marginPercentSnapshot != null ? toNum(l.marginPercentSnapshot) : null;
            }
            if (isMarginQuote) {
                const econ = quoteMarginEconomics.lineUtilityAndMarginPercent(lineTotalSale, qty, uc);
                line.lineCostTotal = econ.lineCostTotal;
                line.lineUtility = econ.lineUtility;
                line.lineMarginPercent = econ.lineMarginPercent;
            }
            return line;
        };
        const mainItems = (version.mainItems ?? []).map((m) => {
            const total = mainItemEffectiveTotal(m.totalMode, m.totalOverride, m.lines);
            const marginBlockEconomics = isMarginQuote
                ? quoteMarginEconomics.mainItemMarginBlockEconomics(m.totalMode, m.totalOverride, m.lines)
                : undefined;
            return {
                id: m.id,
                name: m.name,
                description: m.description,
                sortOrder: m.sortOrder,
                visibleInFinalQuote: m.visibleInFinalQuote,
                totalMode: m.totalMode,
                totalOverride: m.totalOverride != null ? toNum(m.totalOverride) : null,
                total,
                ...(marginBlockEconomics != null ? { marginBlockEconomics } : {}),
                lines: m.lines.map((l) => mapLineOutput(l)),
            };
        });
        const costTotalVersion = isMarginQuote
            ? quoteMarginEconomics.versionCostTotalFromRows(version.items, version.mainItems)
            : 0;
        const subNum = toNum(version.subtotal);
        const discNum = toNum(version.discountsTotal);
        const saleNetBeforeTax = Math.round((subNum - discNum) * 100) / 100;
        const marginEconomicsSummary = isMarginQuote
            ? {
                costTotal: costTotalVersion,
                saleSubtotal: subNum,
                saleNetBeforeTax,
                utilityTotal: Math.round((saleNetBeforeTax - costTotalVersion) * 100) / 100,
                marginPercentOnSaleNet: saleNetBeforeTax > 0
                    ? Math.round(((saleNetBeforeTax - costTotalVersion) / saleNetBeforeTax) * 10000) / 100
                    : null,
            }
            : undefined;
        return {
            ...version,
            subtotal: subNum,
            discountsTotal: discNum,
            marginTotal: toNum(version.marginTotal),
            taxesTotal: toNum(version.taxesTotal),
            total: toNum(version.total),
            globalDiscountPercent: version.globalDiscountPercent != null ? toNum(version.globalDiscountPercent) : null,
            globalMarginPercent: version.globalMarginPercent != null ? toNum(version.globalMarginPercent) : null,
            vatPercent: toNum(version.vatPercent),
            marginEconomicsSummary,
            items: version.items.map((i) => {
                const lineTotalSale = toNum(i.lineTotalSnapshot);
                const qty = toNum(i.quantity);
                const uc = i.unitCostSnapshot != null ? toNum(i.unitCostSnapshot) : null;
                const item = {
                    id: i.id,
                    productId: i.productId,
                    productNameSnapshot: i.productNameSnapshot,
                    productDescriptionSnapshot: i.productDescriptionSnapshot,
                    categoryNameSnapshot: i.categoryNameSnapshot,
                    brandNameSnapshot: i.brandNameSnapshot,
                    modelNameSnapshot: i.modelNameSnapshot,
                    currencySnapshot: i.currencySnapshot,
                    unitPriceSnapshot: toNum(i.unitPriceSnapshot),
                    discountPercentSnapshot: i.discountPercentSnapshot != null ? toNum(i.discountPercentSnapshot) : null,
                    quantity: qty,
                    lineTotalSnapshot: lineTotalSale,
                    sortOrder: i.sortOrder,
                };
                if (showCosts) {
                    item.unitCostSnapshot = uc;
                    item.marginPercentSnapshot = i.marginPercentSnapshot != null ? toNum(i.marginPercentSnapshot) : null;
                }
                if (isMarginQuote) {
                    const econ = quoteMarginEconomics.lineUtilityAndMarginPercent(lineTotalSale, qty, uc);
                    item.lineCostTotal = econ.lineCostTotal;
                    item.lineUtility = econ.lineUtility;
                    item.lineMarginPercent = econ.lineMarginPercent;
                }
                return item;
            }),
            mainItems,
        };
    }
    async create(quoteId, dto, createdById, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (!currentUser || !quoteAccess.canAccessQuote(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        const nextNumber = quote.versions.length > 0 ? quote.versions[0].versionNumber + 1 : 1;
        if (dto.sourceVersionId) {
            const source = await this.prisma.quoteVersion.findFirst({
                where: { id: dto.sourceVersionId, quoteId },
                include: { items: true },
            });
            if (!source) {
                throw new common_1.BadRequestException("Versión origen no encontrada");
            }
            return this.prisma.$transaction(async (tx) => {
                const newVersion = await tx.quoteVersion.create({
                    data: {
                        quoteId,
                        versionNumber: nextNumber,
                        status: "BORRADOR",
                        subtotal: 0,
                        discountsTotal: 0,
                        marginTotal: 0,
                        taxesTotal: 0,
                        total: 0,
                        globalDiscountPercent: source.globalDiscountPercent,
                        globalMarginPercent: source.globalMarginPercent,
                        vatPercent: source.vatPercent,
                        createdById,
                    },
                });
                for (const item of source.items) {
                    await tx.quoteItem.create({
                        data: {
                            quoteVersionId: newVersion.id,
                            productId: item.productId,
                            categoryId: item.categoryId,
                            brandId: item.brandId,
                            modelId: item.modelId,
                            productNameSnapshot: item.productNameSnapshot,
                            productDescriptionSnapshot: item.productDescriptionSnapshot,
                            categoryNameSnapshot: item.categoryNameSnapshot,
                            brandNameSnapshot: item.brandNameSnapshot,
                            modelNameSnapshot: item.modelNameSnapshot,
                            currencySnapshot: item.currencySnapshot,
                            unitPriceSnapshot: item.unitPriceSnapshot,
                            unitCostSnapshot: item.unitCostSnapshot,
                            discountPercentSnapshot: item.discountPercentSnapshot,
                            marginPercentSnapshot: item.marginPercentSnapshot,
                            quantity: item.quantity,
                            lineTotalSnapshot: item.lineTotalSnapshot,
                            configSnapshot: item.configSnapshot,
                            sortOrder: item.sortOrder,
                        },
                    });
                }
                await this.recalcVersionTotalsTx(tx, newVersion.id);
                const created = await tx.quoteVersion.findUnique({
                    where: { id: newVersion.id },
                    include: {
                        createdBy: { select: { id: true, name: true, email: true } },
                        items: true,
                    },
                });
                return this.mapVersionWithTotals(created);
            });
        }
        const created = await this.prisma.quoteVersion.create({
            data: {
                quoteId,
                versionNumber: nextNumber,
                status: "BORRADOR",
                subtotal: 0,
                discountsTotal: 0,
                marginTotal: 0,
                taxesTotal: 0,
                total: 0,
                globalDiscountPercent: null,
                globalMarginPercent: null,
                vatPercent: DEFAULT_VAT_PERCENT,
                createdById,
            },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
                items: true,
            },
        });
        return this.mapVersionWithTotals(created);
    }
    async update(quoteId, versionId, dto, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { id: true, ownerId: true, quoteKind: true, salespersonId: true, sourceFvStudyId: true },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (!currentUser || !quoteAccess.canAccessQuote(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
            select: { id: true, status: true },
        });
        if (!version) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        const sourceFvStudyId = quote.sourceFvStudyId;
        const isTransitioningToFrozen = dto.status !== undefined &&
            dto.status !== "BORRADOR" &&
            version.status === "BORRADOR" &&
            sourceFvStudyId != null;
        let fvSnapshotJson = null;
        if (isTransitioningToFrozen && sourceFvStudyId) {
            fvSnapshotJson = await this.buildFvSnapshotJson(sourceFvStudyId);
        }
        await this.prisma.quoteVersion.update({
            where: { id: versionId },
            data: {
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.globalDiscountPercent !== undefined && { globalDiscountPercent: dto.globalDiscountPercent }),
                ...(dto.globalMarginPercent !== undefined && { globalMarginPercent: dto.globalMarginPercent }),
                ...(dto.vatPercent !== undefined && { vatPercent: dto.vatPercent }),
                ...(fvSnapshotJson != null && { fvSnapshot: fvSnapshotJson }),
            },
        });
        await this.recalcVersionTotals(versionId);
        return this.findOne(quoteId, versionId, currentUser);
    }
    async buildFvSnapshotJson(studyId) {
        const study = await this.prisma.fvStudy.findUnique({
            where: { id: studyId },
            include: {
                months: { orderBy: { monthIndex: "asc" } },
                client: { select: { id: true, name: true, address: true } },
            },
        });
        if (!study)
            return null;
        const design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId: studyId },
            include: { placements: { orderBy: { positionIndex: "asc" } } },
        });
        const summary = {
            plantaKwp: toNum(study.potenciaSistemaKwp),
            cantidadPaneles: study.cantidadPaneles ?? 0,
            generacionAnualKwh: toNum(study.generacionAnualKwh),
            ahorroAnual: toNum(study.ahorroAnual),
            porcentajeAhorro: toNum(study.porcentajeAhorro),
            pagoResidualAnual: toNum(study.pagoResidualAnual),
            currency: study.currency ?? "CLP",
            sourceTitle: study.title ?? undefined,
        };
        const months = (study.months ?? []).map((m) => ({
            id: m.id,
            monthIndex: m.monthIndex,
            consumptionKwh: toNum(m.consumptionKwh),
            generationKwh: toNum(m.generationKwh),
            consumptionValue: m.consumptionValue != null ? toNum(m.consumptionValue) : null,
            generationValue: m.generationValue != null ? toNum(m.generationValue) : null,
            savingsPercent: m.savingsPercent != null ? toNum(m.savingsPercent) : null,
            estimatedPayment: m.estimatedPayment != null ? toNum(m.estimatedPayment) : null,
        }));
        const studyForReport = {
            id: study.id,
            clientId: study.clientId,
            ownerId: study.ownerId,
            status: study.status,
            title: study.title,
            referenceMonth: study.referenceMonth,
            referenceBillAmount: study.referenceBillAmount,
            referenceConsumptionKwh: study.referenceConsumptionKwh,
            valorKwhConsumo: toNum(study.valorKwhConsumo),
            valorKwhInyeccion: toNum(study.valorKwhInyeccion),
            currency: study.currency ?? "CLP",
            connectionType: study.connectionType,
            tipoProyecto: study.tipoProyecto,
            potenciaSistemaKwp: toNum(study.potenciaSistemaKwp),
            potenciaPorPanelWp: toNum(study.potenciaPorPanelWp),
            coberturaDeseada: toNum(study.coberturaDeseada),
            hspDailyUsed: toNum(study.hspDailyUsed),
            performanceRatioUsed: toNum(study.performanceRatioUsed),
            calculationMethodVersion: study.calculationMethodVersion,
            cantidadPaneles: study.cantidadPaneles ?? 0,
            generacionAnualKwh: toNum(study.generacionAnualKwh),
            ahorroAnual: toNum(study.ahorroAnual),
            porcentajeAhorro: toNum(study.porcentajeAhorro),
            pagoResidualAnual: toNum(study.pagoResidualAnual),
            client: study.client ? { id: study.client.id, name: study.client.name, address: study.client.address ?? undefined } : undefined,
            latitude: study.latitude ?? null,
            longitude: study.longitude ?? null,
            mountingType: study.mountingType ?? null,
            tiltDegrees: study.tiltDegrees ?? null,
            azimuthDegrees: study.azimuthDegrees ?? null,
            months,
            createdAt: study.createdAt.toISOString(),
            updatedAt: study.updatedAt.toISOString(),
        };
        const byString = new Map();
        const angles = new Set();
        if (design?.placements?.length) {
            for (const p of design.placements) {
                const sid = p.stringId?.trim() || "—";
                byString.set(sid, (byString.get(sid) ?? 0) + 1);
                const orient = p.orientationDeg;
                if (orient != null)
                    angles.add(Math.round(orient));
            }
        }
        const implantationSummary = {
            placementCount: design?.placements?.length ?? 0,
            stringsSummary: Array.from(byString.entries()).map(([stringId, count]) => ({ stringId, count })),
            angles: Array.from(angles).sort((a, b) => a - b),
            panelNameSnapshot: design?.panelNameSnapshot ?? null,
            tiltDegrees: study.tiltDegrees ?? null,
            mountingType: study.mountingType ?? null,
        };
        return JSON.stringify({ summary, months, studyForReport, implantationSummary });
    }
    async refreshVersionFromStudy(quoteId, versionId, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: {
                id: true,
                ownerId: true,
                quoteKind: true,
                salespersonId: true,
                status: true,
                sourceFvStudyId: true,
                suggestedItemsFromStudy: true,
            },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (!currentUser || !quoteAccess.canAccessQuote(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quote.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se pueden actualizar ítems en cotizaciones en estado BORRADOR");
        }
        if (!quote.sourceFvStudyId) {
            throw new common_1.BadRequestException("La cotización no está vinculada a un estudio FV");
        }
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
            include: {
                mainItems: {
                    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                    include: { lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
                },
            },
        });
        if (!version) {
            throw new common_1.NotFoundException("Versión no encontrada");
        }
        if (version.status !== "BORRADOR") {
            throw new common_1.BadRequestException("Solo se puede actualizar desde estudio cuando la versión está en BORRADOR");
        }
        const study = await this.prisma.fvStudy.findUnique({
            where: { id: quote.sourceFvStudyId },
            select: {
                cantidadPaneles: true,
                potenciaPorPanelWp: true,
                potenciaSistemaKwp: true,
                connectionType: true,
                mountingType: true,
            },
        });
        if (!study) {
            throw new common_1.NotFoundException("Estudio FV no encontrado");
        }
        const CONNECTION_LABELS = {
            MONOFASICO: "monofásico",
            TRIFASICO: "trifásico",
        };
        const MOUNTING_LABELS = {
            TECHO: "techo",
            SUELO: "suelo",
            INCLINADO_FIJO: "inclinado fijo",
            SEGUIMIENTO: "seguimiento",
            OTRO: "otro",
        };
        const connLabel = CONNECTION_LABELS[study.connectionType ?? ""] ?? study.connectionType ?? "";
        const mountLabel = study.mountingType
            ? MOUNTING_LABELS[study.mountingType] ?? study.mountingType
            : "";
        const FV_KINDS = ["PANELS", "INVERTER", "STRUCTURE"];
        for (const mainItem of version.mainItems) {
            const kind = mainItem.sourceFromFvStudyKind ??
                (quote.suggestedItemsFromStudy && mainItem.sortOrder >= 0 && mainItem.sortOrder <= 2
                    ? FV_KINDS[mainItem.sortOrder] ?? null
                    : null);
            if (!kind || !mainItem.lines?.length)
                continue;
            const line = mainItem.lines[0];
            const unitPrice = toNum(line.unitPriceSnapshot);
            const discount = line.discountPercentSnapshot != null ? toNum(line.discountPercentSnapshot) : 0;
            if (kind === "PANELS") {
                const quantity = study.cantidadPaneles ?? 0;
                const lineTotal = Math.round(quantity * unitPrice * (1 - discount / 100) * 100) / 100;
                const desc = study.potenciaPorPanelWp != null && study.potenciaSistemaKwp != null
                    ? `${quantity} unidades de ${study.potenciaPorPanelWp} Wp (sistema ${study.potenciaSistemaKwp} kWp)`
                    : `${quantity} unidades`;
                await this.prisma.quoteItemLine.update({
                    where: { id: line.id },
                    data: {
                        quantity,
                        productDescriptionSnapshot: desc,
                        lineTotalSnapshot: lineTotal,
                    },
                });
            }
            else if (kind === "INVERTER") {
                const desc = study.potenciaSistemaKwp != null
                    ? `Inversor ${connLabel} para sistema de ${study.potenciaSistemaKwp} kW`
                    : `Inversor ${connLabel}`;
                await this.prisma.quoteItemLine.update({
                    where: { id: line.id },
                    data: { productDescriptionSnapshot: desc },
                });
            }
            else if (kind === "STRUCTURE") {
                const n = study.cantidadPaneles ?? 0;
                const desc = mountLabel
                    ? `Estructura ${mountLabel} para ${n} paneles`
                    : `Estructura para ${n} paneles`;
                await this.prisma.quoteItemLine.update({
                    where: { id: line.id },
                    data: { productDescriptionSnapshot: desc },
                });
            }
        }
        await this.recalcVersionTotals(versionId);
        return this.findOne(quoteId, versionId, currentUser);
    }
    async recalcVersionTotals(versionId) {
        await this.prisma.$transaction((tx) => this.recalcVersionTotalsTx(tx, versionId));
    }
    async recalcVersionTotalsTx(tx, versionId) {
        const version = await tx.quoteVersion.findUnique({
            where: { id: versionId },
            include: {
                quote: { select: { quoteKind: true } },
                items: true,
                mainItems: { include: { lines: true } },
            },
        });
        if (!version)
            return;
        const mainItems = version.mainItems ?? [];
        const subtotal = mainItems.length > 0
            ? mainItems.reduce((sum, m) => sum +
                mainItemEffectiveTotal(m.totalMode, m.totalOverride, m.lines), 0)
            : version.items.reduce((sum, i) => sum + toNum(i.lineTotalSnapshot), 0);
        const globalDiscountPercent = version.globalDiscountPercent != null ? toNum(version.globalDiscountPercent) : 0;
        const vatPercent = toNum(version.vatPercent);
        const discountsTotal = subtotal * (globalDiscountPercent / 100);
        const baseTax = subtotal - discountsTotal;
        const taxesTotal = baseTax * (vatPercent / 100);
        const total = subtotal - discountsTotal + taxesTotal;
        const isMargin = version.quote?.quoteKind === "MARGIN";
        let marginTotalForVersion = 0;
        if (isMargin) {
            const costTotal = quoteMarginEconomics.versionCostTotalFromRows(version.items, mainItems);
            const saleNetBeforeTax = Math.round((subtotal - discountsTotal) * 100) / 100;
            marginTotalForVersion = Math.round((saleNetBeforeTax - costTotal) * 100) / 100;
        }
        await tx.quoteVersion.update({
            where: { id: versionId },
            data: {
                subtotal,
                discountsTotal,
                marginTotal: isMargin ? marginTotalForVersion : 0,
                taxesTotal,
                total,
            },
        });
        if (isMargin) {
            for (const m of mainItems) {
                for (const l of m.lines ?? []) {
                    const lineTotal = toNum(l.lineTotalSnapshot);
                    const qty = toNum(l.quantity);
                    const uc = l.unitCostSnapshot != null ? toNum(l.unitCostSnapshot) : null;
                    const { lineMarginPercent } = quoteMarginEconomics.lineUtilityAndMarginPercent(lineTotal, qty, uc);
                    await tx.quoteItemLine.update({
                        where: { id: l.id },
                        data: {
                            marginPercentSnapshot: lineMarginPercent != null ? new client_1.Prisma.Decimal(lineMarginPercent) : null,
                        },
                    });
                }
            }
            for (const i of version.items) {
                const lineTotal = toNum(i.lineTotalSnapshot);
                const qty = toNum(i.quantity);
                const uc = i.unitCostSnapshot != null ? toNum(i.unitCostSnapshot) : null;
                const { lineMarginPercent } = quoteMarginEconomics.lineUtilityAndMarginPercent(lineTotal, qty, uc);
                await tx.quoteItem.update({
                    where: { id: i.id },
                    data: {
                        marginPercentSnapshot: lineMarginPercent != null ? new client_1.Prisma.Decimal(lineMarginPercent) : null,
                    },
                });
            }
        }
    }
    mapVersionWithTotals(v) {
        return {
            ...v,
            subtotal: toNum(v.subtotal),
            discountsTotal: toNum(v.discountsTotal),
            marginTotal: toNum(v.marginTotal),
            taxesTotal: toNum(v.taxesTotal),
            total: toNum(v.total),
            globalDiscountPercent: v.globalDiscountPercent != null ? toNum(v.globalDiscountPercent) : null,
            globalMarginPercent: v.globalMarginPercent != null ? toNum(v.globalMarginPercent) : null,
            vatPercent: toNum(v.vatPercent),
            items: v.items.map((i) => ({
                ...i,
                unitPriceSnapshot: toNum(i.unitPriceSnapshot),
                unitCostSnapshot: i.unitCostSnapshot != null ? toNum(i.unitCostSnapshot) : null,
                quantity: toNum(i.quantity),
                lineTotalSnapshot: toNum(i.lineTotalSnapshot),
            })),
        };
    }
    async acceptAddonSuggestion(quoteId, versionId, suggestionId, currentUser) {
        if (!currentUser)
            throw new common_1.NotFoundException("Cotización no encontrada");
        const qRow = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true, ownerId: true, salespersonId: true },
        });
        if (!qRow || !quoteAccess.canAccessQuote(currentUser, qRow)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const suggestion = await this.prisma.quoteAddOnSuggestion.findUnique({
            where: { id: suggestionId },
            include: { quoteAddOn: true, quoteVersion: { include: { quote: true } } },
        });
        if (!suggestion || suggestion.quoteVersionId !== versionId) {
            throw new common_1.NotFoundException("Sugerencia no encontrada");
        }
        if (suggestion.status !== "PENDING") {
            throw new common_1.BadRequestException("La sugerencia ya fue aceptada o rechazada");
        }
        const mainItemsCount = await this.prisma.quoteMainItem.count({
            where: { quoteVersionId: versionId },
        });
        const isHierarchical = mainItemsCount > 0;
        if (isHierarchical) {
            return this.acceptAddonSuggestionHierarchical(versionId, suggestionId, suggestion);
        }
        return this.acceptAddonSuggestionFlat(versionId, suggestionId, suggestion);
    }
    async acceptAddonSuggestionHierarchical(versionId, suggestionId, suggestion) {
        const qty = toNum(suggestion.suggestedQuantity);
        const unitPrice = toNum(suggestion.suggestedUnitPrice);
        const currency = suggestion.currency ?? "CLP";
        const lineTotalSnapshot = qty * unitPrice;
        const line = await this.prisma.$transaction(async (tx) => {
            let mainItem = await tx.quoteMainItem.findFirst({
                where: { quoteVersionId: versionId, name: exports.ADICIONALES_MAIN_ITEM_NAME },
            });
            if (!mainItem) {
                const maxSort = await tx.quoteMainItem.findFirst({
                    where: { quoteVersionId: versionId },
                    orderBy: { sortOrder: "desc" },
                    select: { sortOrder: true },
                });
                mainItem = await tx.quoteMainItem.create({
                    data: {
                        quoteVersionId: versionId,
                        name: exports.ADICIONALES_MAIN_ITEM_NAME,
                        description: null,
                        sortOrder: (maxSort?.sortOrder ?? -1) + 1,
                        visibleInFinalQuote: true,
                        totalMode: "SUM_LINES",
                        totalOverride: null,
                    },
                });
            }
            const maxLineSort = await tx.quoteItemLine.findFirst({
                where: { quoteMainItemId: mainItem.id },
                orderBy: { sortOrder: "desc" },
                select: { sortOrder: true },
            });
            const lineSortOrder = (maxLineSort?.sortOrder ?? -1) + 1;
            const newLine = await tx.quoteItemLine.create({
                data: {
                    quoteMainItemId: mainItem.id,
                    productId: null,
                    categoryId: null,
                    brandId: null,
                    modelId: null,
                    productNameSnapshot: suggestion.quoteAddOn.name,
                    productDescriptionSnapshot: suggestion.quoteAddOn.description ?? null,
                    categoryNameSnapshot: null,
                    brandNameSnapshot: null,
                    modelNameSnapshot: null,
                    currencySnapshot: currency,
                    unitPriceSnapshot: unitPrice,
                    unitCostSnapshot: null,
                    discountPercentSnapshot: 0,
                    marginPercentSnapshot: null,
                    quantity: qty,
                    lineTotalSnapshot: lineTotalSnapshot,
                    sortOrder: lineSortOrder,
                    visibleInFinalQuote: false,
                    addOnSuggestionId: suggestionId,
                },
            });
            await tx.quoteAddOnSuggestion.update({
                where: { id: suggestionId },
                data: { quoteItemLineId: newLine.id, status: "ACCEPTED" },
            });
            return newLine;
        });
        await this.recalcVersionTotals(versionId);
        return {
            suggestionId,
            status: "ACCEPTED",
            quoteItemId: null,
            quoteItemLineId: line.id,
            mode: "HIERARCHICAL",
        };
    }
    async acceptAddonSuggestionFlat(versionId, suggestionId, suggestion) {
        const qty = toNum(suggestion.suggestedQuantity);
        const unitPrice = toNum(suggestion.suggestedUnitPrice);
        const currency = suggestion.currency ?? suggestion.quoteVersion?.quote?.currency ?? "CLP";
        const lineTotal = qty * unitPrice;
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
                productNameSnapshot: suggestion.quoteAddOn.name,
                productDescriptionSnapshot: suggestion.quoteAddOn.description ?? null,
                categoryNameSnapshot: null,
                brandNameSnapshot: null,
                modelNameSnapshot: null,
                currencySnapshot: currency,
                unitPriceSnapshot: unitPrice,
                unitCostSnapshot: null,
                discountPercentSnapshot: 0,
                marginPercentSnapshot: null,
                quantity: qty,
                lineTotalSnapshot: lineTotal,
                sortOrder,
            },
        });
        await this.prisma.quoteAddOnSuggestion.update({
            where: { id: suggestionId },
            data: { quoteItemId: item.id, status: "ACCEPTED" },
        });
        await this.recalcVersionTotals(versionId);
        return {
            suggestionId,
            status: "ACCEPTED",
            quoteItemId: item.id,
            quoteItemLineId: null,
            mode: "FLAT",
        };
    }
    async rejectAddonSuggestion(quoteId, versionId, suggestionId, currentUser) {
        if (!currentUser)
            throw new common_1.NotFoundException("Cotización no encontrada");
        const qRow = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true, ownerId: true, salespersonId: true },
        });
        if (!qRow || !quoteAccess.canAccessQuote(currentUser, qRow)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const suggestion = await this.prisma.quoteAddOnSuggestion.findFirst({
            where: { id: suggestionId, quoteVersionId: versionId },
        });
        if (!suggestion)
            throw new common_1.NotFoundException("Sugerencia no encontrada");
        if (suggestion.status !== "PENDING") {
            throw new common_1.BadRequestException("La sugerencia ya fue aceptada o rechazada");
        }
        await this.prisma.quoteAddOnSuggestion.update({
            where: { id: suggestionId },
            data: { status: "REJECTED" },
        });
        return { suggestionId, status: "REJECTED" };
    }
    async ensureVersionBelongsToQuote(quoteId, versionId) {
        const v = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
        });
        if (!v)
            throw new common_1.NotFoundException("Versión no encontrada");
        return v;
    }
};
exports.QuoteVersionsService = QuoteVersionsService;
exports.QuoteVersionsService = QuoteVersionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuoteVersionsService);

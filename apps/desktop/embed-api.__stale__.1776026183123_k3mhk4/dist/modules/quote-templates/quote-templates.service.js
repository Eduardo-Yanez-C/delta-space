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
exports.QuoteTemplatesService = void 0;
// @ts-nocheck — emitido desde dist; tipos Prisma/dinámicos en transacciones.
const common_1 = require("@nestjs/common");
const role_constants_1 = require("../auth/role-constants");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const cnCommercial = __importStar(require("../quotes/commercial-number"));
const quote_response_mapper_1 = require("../quotes/quote-response.mapper");
const quote_versions_service_1 = require("../quotes/versions/quote-versions.service");
const product_quote_display_name_1 = require("../../common/product-quote-display-name");
const BASE_ITEMS = {
    ON_GRID: [
        {
            sortOrder: 1,
            itemType: "PANELES",
            quantityRule: "DERIVED_FROM_POWER",
            quantityFixed: null,
            potenciaPorPanelWp: 400,
            productNameSnapshot: "Suministro de paneles fotovoltaicos",
            productDescriptionSnapshot: "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
        },
        {
            sortOrder: 2,
            itemType: "INVERSOR",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Suministro de inversor",
            productDescriptionSnapshot: "Inversor on-grid para sistema de {{targetPowerKwp}} kW. Conexión a red.",
        },
        {
            sortOrder: 3,
            itemType: "ESTRUCTURA",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Estructura de montaje",
            productDescriptionSnapshot: "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
        },
        {
            sortOrder: 4,
            itemType: "INSTALACION",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Instalación y puesta en marcha",
            productDescriptionSnapshot: "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
        },
        {
            sortOrder: 5,
            itemType: "CANALIZACION",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Canalización",
            productDescriptionSnapshot: "Canalización y materiales eléctricos según especificación del proyecto.",
        },
        {
            sortOrder: 6,
            itemType: "INGENIERIA",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Ingeniería y documentación técnica",
            productDescriptionSnapshot: "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
        },
    ],
    OFF_GRID: [
        {
            sortOrder: 1,
            itemType: "PANELES",
            quantityRule: "DERIVED_FROM_POWER",
            quantityFixed: null,
            potenciaPorPanelWp: 400,
            productNameSnapshot: "Suministro de paneles fotovoltaicos",
            productDescriptionSnapshot: "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
        },
        {
            sortOrder: 2,
            itemType: "INVERSOR",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Suministro de inversor",
            productDescriptionSnapshot: "Inversor off-grid para sistema de {{targetPowerKwp}} kW. Sistema aislado con almacenamiento en baterías.",
        },
        {
            sortOrder: 3,
            itemType: "ESTRUCTURA",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Estructura de montaje",
            productDescriptionSnapshot: "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
        },
        {
            sortOrder: 4,
            itemType: "INSTALACION",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Instalación y puesta en marcha",
            productDescriptionSnapshot: "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
        },
        {
            sortOrder: 5,
            itemType: "CANALIZACION",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Canalización",
            productDescriptionSnapshot: "Canalización y materiales eléctricos según especificación del proyecto.",
        },
        {
            sortOrder: 6,
            itemType: "INGENIERIA",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Ingeniería y documentación técnica",
            productDescriptionSnapshot: "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
        },
        {
            sortOrder: 7,
            itemType: "BATERIAS",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Baterías y almacenamiento",
            productDescriptionSnapshot: "Sistema de baterías para instalación off-grid. Incluye banco de baterías y gestión (BMS) según dimensionamiento.",
        },
        {
            sortOrder: 8,
            itemType: "PROTECCIONES_TABLERO",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Protecciones y tablero",
            productDescriptionSnapshot: "Protecciones eléctricas AC/DC y tablero de control para sistema off-grid. Incluye protecciones de batería e inversor.",
        },
    ],
    HYBRID: [
        {
            sortOrder: 1,
            itemType: "PANELES",
            quantityRule: "DERIVED_FROM_POWER",
            quantityFixed: null,
            potenciaPorPanelWp: 400,
            productNameSnapshot: "Suministro de paneles fotovoltaicos",
            productDescriptionSnapshot: "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
        },
        {
            sortOrder: 2,
            itemType: "INVERSOR",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Suministro de inversor",
            productDescriptionSnapshot: "Inversor híbrido para sistema de {{targetPowerKwp}} kW. Conexión a red con respaldo en baterías.",
        },
        {
            sortOrder: 3,
            itemType: "ESTRUCTURA",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Estructura de montaje",
            productDescriptionSnapshot: "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
        },
        {
            sortOrder: 4,
            itemType: "INSTALACION",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Instalación y puesta en marcha",
            productDescriptionSnapshot: "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
        },
        {
            sortOrder: 5,
            itemType: "CANALIZACION",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Canalización",
            productDescriptionSnapshot: "Canalización y materiales eléctricos según especificación del proyecto.",
        },
        {
            sortOrder: 6,
            itemType: "INGENIERIA",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Ingeniería y documentación técnica",
            productDescriptionSnapshot: "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
        },
        {
            sortOrder: 7,
            itemType: "BATERIAS",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Baterías y almacenamiento",
            productDescriptionSnapshot: "Sistema de baterías para instalación híbrida. Respaldo y autoconsumo. Incluye banco y gestión (BMS) según dimensionamiento.",
        },
        {
            sortOrder: 8,
            itemType: "PROTECCIONES_TABLERO",
            quantityRule: "FIXED",
            quantityFixed: 1,
            potenciaPorPanelWp: null,
            productNameSnapshot: "Protecciones y tablero",
            productDescriptionSnapshot: "Protecciones eléctricas AC/DC y tablero de control para sistema híbrido. Incluye protecciones de batería, inversor y conexión a red.",
        },
    ],
};
function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d)
        return d.toNumber();
    return Number(d);
}
function normalizeTemplateQuoteKindInput(raw) {
    const v = (raw ?? "STANDARD").trim().toUpperCase();
    if (v === "STANDARD" || v === "")
        return "STANDARD";
    if (v === "MARGIN")
        return "MARGIN";
    throw new common_1.BadRequestException("quoteKind debe ser STANDARD o MARGIN");
}
function parseQuoteKindQueryParam(raw) {
    if (raw == null || raw.trim() === "")
        return undefined;
    const v = raw.trim().toUpperCase();
    if (v === "STANDARD")
        return "STANDARD";
    if (v === "MARGIN")
        return "MARGIN";
    throw new common_1.BadRequestException("quoteKind debe ser STANDARD o MARGIN");
}
function mapTemplateItem(i) {
    return {
        id: i.id,
        sortOrder: i.sortOrder,
        itemType: i.itemType,
        quantityRule: i.quantityRule,
        quantityFixed: i.quantityFixed,
        potenciaPorPanelWp: i.potenciaPorPanelWp,
        productNameSnapshot: i.productNameSnapshot,
        productDescriptionSnapshot: i.productDescriptionSnapshot,
        unitPriceDefault: toNum(i.unitPriceDefault),
        visibleInFinalQuoteDefault: i.visibleInFinalQuoteDefault,
        lines: (i.lines ?? []).map((l) => ({
            id: l.id,
            sortOrder: l.sortOrder,
            source: l.source,
            productId: l.productId,
            productNameSnapshot: l.productNameSnapshot,
            productDescriptionSnapshot: l.productDescriptionSnapshot,
            quantityRule: l.quantityRule,
            quantityFixed: l.quantityFixed,
            potenciaPorPanelWp: l.potenciaPorPanelWp,
            unitPriceDefault: toNum(l.unitPriceDefault),
            currency: l.currency,
            visibleInFinalQuoteDefault: l.visibleInFinalQuoteDefault,
            product: l.product,
        })),
    };
}
let QuoteTemplatesService = class QuoteTemplatesService {
    constructor(prisma, quoteVersionsService) {
        this.prisma = prisma;
        this.quoteVersionsService = quoteVersionsService;
    }
    async findAll(quoteKindQuery) {
        const quoteKindFilter = parseQuoteKindQueryParam(quoteKindQuery);
        const list = await this.prisma.quoteTemplate.findMany({
            where: {
                active: true,
                ...(quoteKindFilter != null ? { quoteKind: quoteKindFilter } : {}),
            },
            orderBy: { sortOrder: "asc" },
            include: {
                items: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                        lines: {
                            orderBy: { sortOrder: "asc" },
                            include: {
                                product: { select: { id: true, name: true, description: true } },
                            },
                        },
                    },
                },
            },
        });
        return list.map((t) => ({
            id: t.id,
            name: t.name,
            quoteKind: t.quoteKind,
            systemType: t.systemType,
            targetPowerKwp: toNum(t.targetPowerKwp),
            description: t.description,
            sortOrder: t.sortOrder,
            items: t.items.map((i) => mapTemplateItem(i)),
        }));
    }
    async findOne(id) {
        const t = await this.prisma.quoteTemplate.findUnique({
            where: { id },
            include: {
                items: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                        lines: {
                            orderBy: { sortOrder: "asc" },
                            include: {
                                product: { select: { id: true, name: true, description: true } },
                            },
                        },
                    },
                },
            },
        });
        if (!t)
            throw new common_1.NotFoundException("Plantilla no encontrada");
        return {
            id: t.id,
            name: t.name,
            quoteKind: t.quoteKind,
            systemType: t.systemType,
            targetPowerKwp: toNum(t.targetPowerKwp),
            description: t.description,
            sortOrder: t.sortOrder,
            active: t.active,
            items: t.items.map((i) => mapTemplateItem(i)),
        };
    }
    async createTemplate(dto) {
        const name = (dto.name ?? "").trim();
        if (!name)
            throw new common_1.BadRequestException("name es obligatorio");
        const systemType = dto.systemType;
        if (!systemType || !["ON_GRID", "OFF_GRID", "HYBRID"].includes(systemType))
            throw new common_1.BadRequestException("systemType debe ser ON_GRID, OFF_GRID o HYBRID");
        const targetPowerKwp = dto.targetPowerKwp ??
            (systemType === "ON_GRID" ? 4 : systemType === "OFF_GRID" ? 6 : 5);
        const itemsConfig = BASE_ITEMS[systemType];
        if (!itemsConfig?.length)
            throw new common_1.BadRequestException("No hay ítems base para este tipo de sistema");
        const quoteKind = normalizeTemplateQuoteKindInput(dto.quoteKind);
        const maxSort = await this.prisma.quoteTemplate.aggregate({
            _max: { sortOrder: true },
        });
        const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
        const template = await this.prisma.$transaction(async (tx) => {
            const t = await tx.quoteTemplate.create({
                data: {
                    name,
                    quoteKind,
                    systemType,
                    targetPowerKwp,
                    description: dto.description?.trim() ?? null,
                    sortOrder,
                    active: true,
                },
            });
            for (const it of itemsConfig) {
                const item = await tx.quoteTemplateItem.create({
                    data: {
                        quoteTemplateId: t.id,
                        sortOrder: it.sortOrder,
                        itemType: it.itemType,
                        quantityRule: it.quantityRule,
                        quantityFixed: it.quantityFixed,
                        potenciaPorPanelWp: it.potenciaPorPanelWp,
                        productNameSnapshot: it.productNameSnapshot,
                        productDescriptionSnapshot: it.productDescriptionSnapshot,
                    },
                });
                await tx.quoteTemplateLine.create({
                    data: {
                        quoteTemplateItemId: item.id,
                        sortOrder: 0,
                        source: "MANUAL",
                        productNameSnapshot: it.productNameSnapshot,
                        productDescriptionSnapshot: it.productDescriptionSnapshot,
                        quantityRule: it.quantityRule,
                        quantityFixed: it.quantityFixed,
                        potenciaPorPanelWp: it.potenciaPorPanelWp,
                        unitPriceDefault: 0,
                        visibleInFinalQuoteDefault: false,
                    },
                });
            }
            return t;
        });
        return this.findOne(template.id);
    }
    async createQuoteFromTemplate(templateId, dto, currentUser) {
        const roles = currentUser.roles ?? [];
        if (!(0, role_constants_1.hasSalesLikePrivileges)(roles)) {
            throw new common_1.ForbiddenException("Sin permiso para crear cotización desde plantilla");
        }
        const template = await this.prisma.quoteTemplate.findFirst({
            where: { id: templateId, active: true },
            include: {
                items: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                        lines: { orderBy: { sortOrder: "asc" }, include: { product: true } },
                    },
                },
            },
        });
        if (!template)
            throw new common_1.NotFoundException("Plantilla no encontrada o inactiva");
        if (template.quoteKind === "MARGIN") {
            throw new common_1.BadRequestException("Aún no es posible crear una cotización desde una plantilla con margen. Use una plantilla estándar o cree la cotización con margen por el flujo correspondiente.");
        }
        const client = await this.prisma.client.findUnique({
            where: { id: dto.clientId },
        });
        if (!client)
            throw new common_1.NotFoundException("Cliente no encontrado");
        let sourceFvStudyId = null;
        const rawStudyId = dto.fvStudyId?.trim();
        if (rawStudyId) {
            const study = await this.prisma.fvStudy.findUnique({
                where: { id: rawStudyId },
            });
            if (!study)
                throw new common_1.NotFoundException("Estudio FV no encontrado");
            if (study.clientId !== client.id) {
                throw new common_1.BadRequestException("El estudio FV no pertenece al cliente de la cotización");
            }
            sourceFvStudyId = study.id;
        }
        const targetPowerKwp = toNum(template.targetPowerKwp);
        const currency = dto.currency?.trim() || "CLP";
        const title = dto.title?.trim() || `Cotización ${template.name} - ${client.name}`;
        const result = await this.prisma.$transaction(async (tx) => {
            const sellerInitials = cnCommercial.sellerInitialsForCommercialNumber({
                fullName: currentUser.fullName,
                name: currentUser.name,
                email: currentUser.email,
            });
            const { commercialSequence, commercialNumber } = await cnCommercial.getNextCommercialNumber(tx, "RESIDENCIAL", {
                sellerInitials,
            });
            const quote = await tx.quote.create({
                data: {
                    clientId: client.id,
                    ownerId: currentUser.id,
                    sourceQuoteTemplateId: template.id,
                    sourceFvStudyId: sourceFvStudyId ?? undefined,
                    status: "BORRADOR",
                    title,
                    projectType: "RESIDENCIAL",
                    currency,
                    commercialSequence,
                    commercialNumber,
                },
            });
            const version = await tx.quoteVersion.create({
                data: {
                    quoteId: quote.id,
                    versionNumber: 1,
                    status: "BORRADOR",
                    subtotal: 0,
                    discountsTotal: 0,
                    marginTotal: 0,
                    taxesTotal: 0,
                    total: 0,
                    vatPercent: 19,
                    createdById: currentUser.id,
                },
            });
            const cantidadPaneles = (() => {
                const panelesItem = template.items.find((i) => i.itemType === "PANELES");
                if (!panelesItem)
                    return 0;
                const wp = panelesItem.potenciaPorPanelWp ?? 400;
                return Math.ceil((targetPowerKwp * 1000) / wp);
            })();
            const replacePlaceholders = (text) => {
                if (!text)
                    return "";
                return text
                    .replace(/\{\{cantidadPaneles\}\}/g, String(cantidadPaneles))
                    .replace(/\{\{targetPowerKwp\}\}/g, String(targetPowerKwp));
            };
            const now = new Date();
            for (const item of template.items) {
                const mainDescRaw = replacePlaceholders(item.productDescriptionSnapshot ?? "");
                const mainDesc = mainDescRaw.trim() ? mainDescRaw : null;
                const mainItem = await tx.quoteMainItem.create({
                    data: {
                        quoteVersionId: version.id,
                        name: item.productNameSnapshot,
                        description: mainDesc,
                        sortOrder: item.sortOrder,
                        visibleInFinalQuote: item.visibleInFinalQuoteDefault,
                        totalMode: "SUM_LINES",
                        totalOverride: null,
                    },
                });
                const lines = item.lines ?? [];
                if (lines.length > 0) {
                    for (let idx = 0; idx < lines.length; idx++) {
                        const line = lines[idx];
                        const qty = line.quantityRule === "DERIVED_FROM_POWER"
                            ? Math.ceil((targetPowerKwp * 1000) / (line.potenciaPorPanelWp ?? 400))
                            : (line.quantityFixed ?? 1);
                        let name = line.productNameSnapshot ?? "";
                        let desc = line.productDescriptionSnapshot ?? null;
                        if (line.source === "FROM_CATALOG" && line.product) {
                            if (!name)
                                name = (0, product_quote_display_name_1.commercialNameForQuoteLine)(line.product);
                            if (desc == null && line.product.description)
                                desc = line.product.description;
                        }
                        name = replacePlaceholders(name);
                        desc = desc ? replacePlaceholders(desc) : null;
                        let unitPrice = toNum(line.unitPriceDefault) || 0;
                        let lineCurrency = line.currency?.trim() || currency;
                        if (line.source === "FROM_CATALOG" && line.productId) {
                            const vigentPrice = await tx.productPrice.findFirst({
                                where: {
                                    productId: line.productId,
                                    validFrom: { lte: now },
                                    OR: [{ validTo: null }, { validTo: { gte: now } }],
                                },
                                orderBy: { validFrom: "desc" },
                            });
                            if (vigentPrice) {
                                unitPrice = toNum(vigentPrice.price);
                                lineCurrency = vigentPrice.currency ?? lineCurrency;
                            }
                        }
                        const lineTotal = qty * unitPrice;
                        const prod = line.product;
                        await tx.quoteItemLine.create({
                            data: {
                                quoteMainItemId: mainItem.id,
                                productId: line.productId,
                                categoryId: prod?.categoryId ?? null,
                                brandId: prod?.brandId ?? null,
                                modelId: prod?.modelId ?? null,
                                productNameSnapshot: name || "—",
                                productDescriptionSnapshot: desc,
                                categoryNameSnapshot: null,
                                brandNameSnapshot: prod?.brandNameFree ?? prod?.brand?.name ?? null,
                                modelNameSnapshot: prod?.modelNameFree ?? prod?.model?.name ?? null,
                                currencySnapshot: lineCurrency,
                                unitPriceSnapshot: unitPrice,
                                unitCostSnapshot: null,
                                discountPercentSnapshot: 0,
                                marginPercentSnapshot: null,
                                quantity: qty,
                                lineTotalSnapshot: lineTotal,
                                sortOrder: idx,
                                visibleInFinalQuote: line.visibleInFinalQuoteDefault ?? false,
                                configSnapshot: null,
                            },
                        });
                    }
                }
                else {
                    const qty = item.quantityRule === "DERIVED_FROM_POWER"
                        ? Math.ceil((targetPowerKwp * 1000) / (item.potenciaPorPanelWp ?? 400))
                        : (item.quantityFixed ?? 1);
                    let desc = replacePlaceholders(item.productDescriptionSnapshot ?? "");
                    const unitPrice = toNum(item.unitPriceDefault) || 0;
                    const lineTotal = qty * unitPrice;
                    await tx.quoteItemLine.create({
                        data: {
                            quoteMainItemId: mainItem.id,
                            productId: null,
                            categoryId: null,
                            brandId: null,
                            modelId: null,
                            productNameSnapshot: item.productNameSnapshot,
                            productDescriptionSnapshot: desc || null,
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
                            sortOrder: 0,
                            visibleInFinalQuote: false,
                            configSnapshot: null,
                        },
                    });
                }
            }
            await this.quoteVersionsService.recalcVersionTotalsTx(tx, version.id);
            if (sourceFvStudyId) {
                await tx.fvStudy.update({
                    where: { id: sourceFvStudyId },
                    data: { status: "COTIZADO" },
                });
            }
            return { quote, version };
        });
        return {
            quote: (0, quote_response_mapper_1.mapQuoteResponse)(result.quote),
            version: {
                id: result.version.id,
                versionNumber: result.version.versionNumber,
                status: result.version.status,
            },
        };
    }
    async updateTemplate(id, dto) {
        const template = await this.prisma.quoteTemplate.findUnique({
            where: { id },
        });
        if (!template)
            throw new common_1.NotFoundException("Plantilla no encontrada");
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name.trim();
        if (dto.systemType !== undefined)
            data.systemType = dto.systemType;
        if (dto.targetPowerKwp !== undefined)
            data.targetPowerKwp = dto.targetPowerKwp;
        if (dto.description !== undefined)
            data.description = dto.description?.trim() ?? null;
        if (dto.active !== undefined)
            data.active = dto.active;
        if (Object.keys(data).length === 0)
            return this.findOne(id);
        const updated = await this.prisma.quoteTemplate.update({
            where: { id },
            data,
        });
        return this.findOne(updated.id);
    }
    async updateTemplateItem(templateId, itemId, dto) {
        const item = await this.prisma.quoteTemplateItem.findUnique({
            where: { id: itemId },
            include: { quoteTemplate: true },
        });
        if (!item || item.quoteTemplate.id !== templateId) {
            throw new common_1.NotFoundException("Ítem de plantilla no encontrado");
        }
        const data = {};
        if (dto.productNameSnapshot !== undefined) {
            const n = dto.productNameSnapshot.trim();
            if (!n)
                throw new common_1.BadRequestException("El nombre del bloque no puede estar vacío");
            data.productNameSnapshot = n;
        }
        if (dto.productDescriptionSnapshot !== undefined) {
            const raw = dto.productDescriptionSnapshot;
            data.productDescriptionSnapshot =
                raw === null || String(raw).trim() === "" ? null : String(raw).trim();
        }
        if (dto.visibleInFinalQuoteDefault !== undefined) {
            data.visibleInFinalQuoteDefault = dto.visibleInFinalQuoteDefault;
        }
        if (Object.keys(data).length === 0)
            return this.findOne(templateId);
        await this.prisma.quoteTemplateItem.update({
            where: { id: itemId },
            data,
        });
        return this.findOne(templateId);
    }
    async createLine(templateId, itemId, dto) {
        const template = await this.prisma.quoteTemplate.findFirst({
            where: { id: templateId, active: true },
            include: { items: true },
        });
        if (!template)
            throw new common_1.NotFoundException("Plantilla no encontrada");
        const item = template.items.find((i) => i.id === itemId);
        if (!item)
            throw new common_1.NotFoundException("Ítem de plantilla no encontrado");
        if (dto.source === "MANUAL" &&
            (!dto.productNameSnapshot || !dto.productNameSnapshot.trim()))
            throw new common_1.BadRequestException("productNameSnapshot es obligatorio para línea manual");
        const maxSort = await this.prisma.quoteTemplateLine.findFirst({
            where: { quoteTemplateItemId: itemId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
        });
        const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
        const line = await this.prisma.quoteTemplateLine.create({
            data: {
                quoteTemplateItemId: itemId,
                sortOrder,
                source: dto.source,
                productId: dto.productId?.trim() || null,
                productNameSnapshot: dto.productNameSnapshot?.trim() ?? null,
                productDescriptionSnapshot: dto.productDescriptionSnapshot?.trim() ?? null,
                quantityRule: dto.quantityRule,
                quantityFixed: dto.quantityFixed ?? null,
                potenciaPorPanelWp: dto.potenciaPorPanelWp ?? null,
                unitPriceDefault: dto.unitPriceDefault ?? 0,
                currency: dto.currency?.trim() ?? null,
                visibleInFinalQuoteDefault: dto.visibleInFinalQuoteDefault ?? false,
            },
        });
        return line;
    }
    async updateLine(templateId, lineId, dto) {
        const line = await this.prisma.quoteTemplateLine.findUnique({
            where: { id: lineId },
            include: { quoteTemplateItem: { include: { quoteTemplate: true } } },
        });
        if (!line || line.quoteTemplateItem.quoteTemplate.id !== templateId)
            throw new common_1.NotFoundException("Línea de plantilla no encontrada");
        const data = {};
        if (dto.productNameSnapshot !== undefined)
            data.productNameSnapshot = dto.productNameSnapshot?.trim() ?? null;
        if (dto.productDescriptionSnapshot !== undefined)
            data.productDescriptionSnapshot =
                dto.productDescriptionSnapshot?.trim() ?? null;
        if (dto.quantityRule !== undefined)
            data.quantityRule = dto.quantityRule;
        if (dto.quantityFixed !== undefined)
            data.quantityFixed = dto.quantityFixed;
        if (dto.potenciaPorPanelWp !== undefined)
            data.potenciaPorPanelWp = dto.potenciaPorPanelWp;
        if (dto.unitPriceDefault !== undefined)
            data.unitPriceDefault = dto.unitPriceDefault;
        if (dto.currency !== undefined)
            data.currency = dto.currency?.trim() ?? null;
        if (dto.visibleInFinalQuoteDefault !== undefined)
            data.visibleInFinalQuoteDefault = dto.visibleInFinalQuoteDefault;
        if (Object.keys(data).length === 0)
            return line;
        return this.prisma.quoteTemplateLine.update({
            where: { id: lineId },
            data,
        });
    }
    async deleteLine(templateId, lineId) {
        const line = await this.prisma.quoteTemplateLine.findUnique({
            where: { id: lineId },
            include: { quoteTemplateItem: { include: { quoteTemplate: true } } },
        });
        if (!line || line.quoteTemplateItem.quoteTemplate.id !== templateId)
            throw new common_1.NotFoundException("Línea de plantilla no encontrada");
        await this.prisma.quoteTemplateLine.delete({ where: { id: lineId } });
        return { deleted: true };
    }
};
exports.QuoteTemplatesService = QuoteTemplatesService;
exports.QuoteTemplatesService = QuoteTemplatesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        quote_versions_service_1.QuoteVersionsService])
], QuoteTemplatesService);

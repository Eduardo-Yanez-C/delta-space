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
exports.QuotesService = void 0;
// @ts-nocheck — alineado con dist (Decimal / includes).
const common_1 = require("@nestjs/common");
const role_constants_1 = require("../auth/role-constants");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("./quote-access.helper");
const cnCommercial = __importStar(require("./commercial-number"));
const commercial_status_1 = require("./commercial-status");
const quote_response_mapper_1 = require("./quote-response.mapper");
function formatCurrentVersion(v) {
    if (!v)
        return null;
    return {
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        total: typeof v.total === "object" && v.total !== null && "toNumber" in v.total
            ? v.total.toNumber()
            : Number(v.total),
        createdAt: v.createdAt,
        createdBy: v.createdBy
            ? { id: v.createdBy.id, name: v.createdBy.name, email: v.createdBy.email }
            : undefined,
    };
}
let QuotesService = class QuotesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resolveSellerForIndustrialInitials(dto, currentUser) {
        const sid = dto.salespersonId?.trim();
        if (sid) {
            const u = await this.prisma.user.findUnique({
                where: { id: sid },
                select: { fullName: true, name: true, email: true },
            });
            if (u) {
                return { fullName: u.fullName, name: u.name, email: u.email };
            }
        }
        return {
            fullName: currentUser.fullName,
            name: currentUser.name,
            email: currentUser.email,
        };
    }
    async findAll(filters, currentUser) {
        let where = {};
        const includeInactive = filters.includeInactive === true || filters.includeInactive === "true";
        if (filters.status) {
            where.status = filters.status;
        }
        else if (!includeInactive) {
            where.status = { notIn: [...commercial_status_1.QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST] };
        }
        if (filters.clientId)
            where.clientId = filters.clientId;
        if (filters.ownerId)
            where.ownerId = filters.ownerId;
        if (filters.sourceFvStudyId?.trim()) {
            where.sourceFvStudyId = filters.sourceFvStudyId.trim();
        }
        if (filters.search?.trim()) {
            where.title = { contains: filters.search.trim() };
        }
        if (filters.updatedAfter) {
            const d = new Date(filters.updatedAfter);
            if (!Number.isNaN(d.getTime()))
                where.updatedAt = { gte: d };
        }
        const roles = currentUser?.roles ?? [];
        if (roles.length > 0 && !(0, role_constants_1.hasGlobalAdminPrivileges)(roles)) {
            const visibility = (0, quote_access_helper_1.quoteVisibilityWhereForUser)(currentUser.id);
            where =
                Object.keys(where).length > 0 ? { AND: [where, visibility] } : visibility;
        }
        const quotes = await this.prisma.quote.findMany({
            where,
            orderBy: { updatedAt: "desc" },
            include: {
                client: { select: { id: true, name: true, email: true } },
                owner: { select: { id: true, name: true, fullName: true, email: true } },
                salesperson: { select: { id: true, name: true, fullName: true, email: true } },
                sourceQuoteTemplate: { select: { id: true, name: true } },
                versions: {
                    orderBy: { versionNumber: "desc" },
                    take: 1,
                    include: {
                        createdBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        return quotes.map((q) => {
            const latest = q.versions[0] ?? null;
            const { versions: _v, ...rest } = q;
            return {
                ...(0, quote_response_mapper_1.mapQuoteResponse)(rest),
                currentVersion: formatCurrentVersion(latest),
            };
        });
    }
    async findOne(id, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id },
            include: {
                client: {
                    select: {
                        id: true,
                        type: true,
                        name: true,
                        taxId: true,
                        email: true,
                        phone: true,
                        address: true,
                        notes: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
                owner: { select: { id: true, name: true, fullName: true, email: true } },
                salesperson: { select: { id: true, name: true, fullName: true, email: true } },
                sourceFvStudy: { select: { id: true, title: true } },
                sourceQuoteTemplate: { select: { id: true, name: true } },
                versions: {
                    orderBy: { versionNumber: "asc" },
                    include: {
                        createdBy: { select: { id: true, name: true, email: true } },
                    },
                },
            },
        });
        if (!quote) {
            throw new common_1.NotFoundException(`Cotización con id ${id} no encontrada`);
        }
        if (!(0, quote_access_helper_1.canAccessQuote)(currentUser, quote)) {
            throw new common_1.NotFoundException(`Cotización con id ${id} no encontrada`);
        }
        const latest = quote.versions.length > 0
            ? quote.versions[quote.versions.length - 1]
            : null;
        const { versions: versionRows, ...quoteRest } = quote;
        return {
            ...(0, quote_response_mapper_1.mapQuoteResponse)(quoteRest),
            currentVersion: formatCurrentVersion(latest),
            versions: versionRows.map((v) => ({
                id: v.id,
                versionNumber: v.versionNumber,
                status: v.status,
                subtotal: typeof v.subtotal === "object" &&
                    v.subtotal !== null &&
                    "toNumber" in v.subtotal
                    ? v.subtotal.toNumber()
                    : Number(v.subtotal),
                discountsTotal: typeof v.discountsTotal === "object" &&
                    v.discountsTotal !== null &&
                    "toNumber" in v.discountsTotal
                    ? v.discountsTotal.toNumber()
                    : Number(v.discountsTotal),
                taxesTotal: typeof v.taxesTotal === "object" &&
                    v.taxesTotal !== null &&
                    "toNumber" in v.taxesTotal
                    ? v.taxesTotal.toNumber()
                    : Number(v.taxesTotal),
                total: typeof v.total === "object" && v.total !== null && "toNumber" in v.total
                    ? v.total.toNumber()
                    : Number(v.total),
                createdAt: v.createdAt,
                createdBy: v.createdBy,
            })),
        };
    }
    async create(dto, currentUser) {
        const client = await this.prisma.client.findUnique({
            where: { id: dto.clientId },
        });
        if (!client) {
            throw new common_1.NotFoundException("Cliente no encontrado");
        }
        const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
        if (dto.validUntil && Number.isNaN(validUntil.getTime())) {
            throw new common_1.BadRequestException("validUntil inválido");
        }
        const quoteKind = dto.quoteKind === "MARGIN" ? "MARGIN" : "STANDARD";
        if (dto.quoteKind != null &&
            dto.quoteKind !== "STANDARD" &&
            dto.quoteKind !== "MARGIN") {
            throw new common_1.BadRequestException("quoteKind debe ser STANDARD o MARGIN");
        }
        let technicalStored = null;
        if (dto.technicalBasicsJson != null) {
            technicalStored = (0, quote_response_mapper_1.serializeTechnicalBasicsJson)(dto.technicalBasicsJson);
        }
        const sellerPayload = await this.resolveSellerForIndustrialInitials(dto, currentUser);
        const sellerInitials = cnCommercial.sellerInitialsForCommercialNumber(sellerPayload);
        const maxRetries = 3;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            const { commercialSequence: nextSequence, commercialNumber } = await cnCommercial.getNextCommercialNumber(this.prisma, dto.projectType, { sellerInitials });
            try {
                const created = await this.prisma.quote.create({
                    data: {
                        clientId: dto.clientId,
                        ownerId: currentUser.id,
                        quoteKind,
                        technicalBasicsJson: technicalStored,
                        status: "BORRADOR",
                        title: dto.title.trim(),
                        projectType: dto.projectType.trim(),
                        commercialSequence: nextSequence,
                        commercialNumber,
                        internalNotes: dto.internalNotes?.trim() ?? null,
                        clientNotes: dto.clientNotes?.trim() ?? null,
                        currency: dto.currency?.trim() ?? null,
                        validUntil,
                        paymentTerms: dto.paymentTerms?.trim() ?? null,
                        deliveryDays: dto.deliveryDays ?? null,
                        commercialStage: dto.commercialStage?.trim() ?? null,
                        leadNumber: dto.leadNumber?.trim() ?? null,
                        salespersonId: dto.salespersonId?.trim() || null,
                    },
                    include: {
                        client: { select: { id: true, name: true } },
                        owner: { select: { id: true, name: true, fullName: true, email: true } },
                        salesperson: { select: { id: true, name: true, fullName: true, email: true } },
                    },
                });
                return (0, quote_response_mapper_1.mapQuoteResponse)(created);
            }
            catch (err) {
                const isUniqueViolation = err &&
                    typeof err === "object" &&
                    "code" in err &&
                    err.code === "P2002";
                if (isUniqueViolation && attempt < maxRetries - 1)
                    continue;
                throw err;
            }
        }
        throw new common_1.BadRequestException("No se pudo asignar número correlativo; reintente.");
    }
    async update(id, dto, currentUser) {
        const quote = await this.prisma.quote.findUnique({ where: { id } });
        if (!quote) {
            throw new common_1.NotFoundException(`Cotización con id ${id} no encontrada`);
        }
        if (!currentUser || !(0, quote_access_helper_1.canAccessQuote)(currentUser, quote)) {
            throw new common_1.NotFoundException(`Cotización con id ${id} no encontrada`);
        }
        const patchKeys = Object.keys(dto).filter((k) => dto[k] !== undefined);
        if ((0, commercial_status_1.isQuoteTerminalArchivedOrCancelled)(quote.status) &&
            patchKeys.length > 0) {
            const onlyStatus = patchKeys.length === 1 && patchKeys[0] === "status";
            let nextStatus;
            if (dto.status !== undefined) {
                try {
                    nextStatus = (0, commercial_status_1.normalizeQuoteCommercialStatus)(dto.status);
                }
                catch {
                    throw new common_1.BadRequestException("Estado comercial inválido");
                }
            }
            const reopening = onlyStatus &&
                nextStatus != null &&
                !(0, commercial_status_1.isQuoteTerminalArchivedOrCancelled)(nextStatus);
            if (!reopening) {
                throw new common_1.BadRequestException("La cotización está anulada o archivada. Solo puede reactivarse cambiando " +
                    "`status` a un estado operativo (p. ej. BORRADOR). No se permiten otros cambios.");
            }
        }
        const validUntil = dto.validUntil !== undefined
            ? dto.validUntil
                ? new Date(dto.validUntil)
                : null
            : undefined;
        if (dto.validUntil && validUntil && Number.isNaN(validUntil.getTime())) {
            throw new common_1.BadRequestException("validUntil inválido");
        }
        let normalizedStatus = undefined;
        if (dto.status !== undefined) {
            try {
                normalizedStatus = (0, commercial_status_1.normalizeQuoteCommercialStatus)(dto.status);
            }
            catch {
                throw new common_1.BadRequestException("Estado comercial inválido. Valores: " +
                    "BORRADOR, LISTA_PARA_ENVIAR, ENVIADA, ACEPTADA, RECHAZADA, ANULADA (o CANCELADA), " +
                    "CERRADA_SIN_VENTA, EXPIRADA, ARCHIVADA.");
            }
        }
        let sourceFvStudyId = undefined;
        if (dto.sourceFvStudyId !== undefined) {
            const raw = dto.sourceFvStudyId;
            if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
                sourceFvStudyId = null;
            }
            else {
                const study = await this.prisma.fvStudy.findUnique({
                    where: { id: raw.trim() },
                    select: { id: true, clientId: true, ownerId: true },
                });
                if (!study) {
                    throw new common_1.NotFoundException("Estudio FV no encontrado");
                }
                if (study.clientId !== quote.clientId) {
                    throw new common_1.BadRequestException("El estudio FV debe pertenecer al mismo cliente que la cotización");
                }
                const roles = currentUser?.roles ?? [];
                const isPrivileged = (0, role_constants_1.hasGlobalAdminPrivileges)(roles);
                const ownsStudy = study.ownerId === null || study.ownerId === currentUser?.id;
                if (!isPrivileged && !ownsStudy) {
                    throw new common_1.BadRequestException("No tiene permiso para vincular este estudio a la cotización");
                }
                sourceFvStudyId = study.id;
            }
        }
        const updated = await this.prisma.quote.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title.trim() }),
                ...(dto.projectType !== undefined && {
                    projectType: dto.projectType.trim(),
                }),
                ...(dto.internalNotes !== undefined && {
                    internalNotes: dto.internalNotes?.trim() ?? null,
                }),
                ...(dto.clientNotes !== undefined && {
                    clientNotes: dto.clientNotes?.trim() ?? null,
                }),
                ...(dto.currency !== undefined && {
                    currency: dto.currency?.trim() ?? null,
                }),
                ...(dto.validUntil !== undefined && { validUntil }),
                ...(dto.paymentTerms !== undefined && {
                    paymentTerms: dto.paymentTerms?.trim() ?? null,
                }),
                ...(dto.deliveryDays !== undefined && {
                    deliveryDays: dto.deliveryDays ?? null,
                }),
                ...(dto.commercialStage !== undefined && {
                    commercialStage: dto.commercialStage?.trim() ?? null,
                }),
                ...(normalizedStatus !== undefined && { status: normalizedStatus }),
                ...(dto.leadNumber !== undefined && {
                    leadNumber: dto.leadNumber?.trim() ?? null,
                }),
                ...(dto.salespersonId !== undefined && {
                    salespersonId: dto.salespersonId?.trim() || null,
                }),
                ...(sourceFvStudyId !== undefined && { sourceFvStudyId }),
                ...(dto.technicalBasicsJson !== undefined && {
                    technicalBasicsJson: dto.technicalBasicsJson === null
                        ? null
                        : (0, quote_response_mapper_1.serializeTechnicalBasicsJson)(dto.technicalBasicsJson),
                }),
            },
            include: {
                client: { select: { id: true, name: true } },
                owner: { select: { id: true, name: true, fullName: true, email: true } },
                salesperson: { select: { id: true, name: true, fullName: true, email: true } },
            },
        });
        return (0, quote_response_mapper_1.mapQuoteResponse)(updated);
    }
};
exports.QuotesService = QuotesService;
exports.QuotesService = QuotesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuotesService);

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
exports.QuoteAddOnsService = void 0;
// @ts-nocheck — alineado con dist (Decimal / transacciones).
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quotes/quote-access.helper");
function toNum(d) {
    if (d == null)
        return null;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d)
        return d.toNumber();
    return Number(d);
}
const APPLICATION_MODE_SUGERIDO = "SUGERIDO";
let QuoteAddOnsService = class QuoteAddOnsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureVersionBelongsToQuote(quoteId, versionId) {
        const version = await this.prisma.quoteVersion.findFirst({
            where: { id: versionId, quoteId },
        });
        if (!version)
            throw new common_1.NotFoundException("Versión no encontrada");
        return version;
    }
    async findAll() {
        const list = await this.prisma.quoteAddOn.findMany({
            where: { active: true },
            orderBy: { sortOrder: "asc" },
        });
        return list.map((r) => ({
            id: r.id,
            code: r.code,
            name: r.name,
            description: r.description,
            sortOrder: r.sortOrder,
            conditionType: r.conditionType,
            thresholdNumeric: toNum(r.thresholdNumeric),
            inputKey: r.inputKey,
            quantityRule: r.quantityRule,
            unit: r.unit,
            unitPriceDefault: toNum(r.unitPriceDefault),
            currency: r.currency,
            applicationMode: r.applicationMode,
        }));
    }
    async findOne(id) {
        const r = await this.prisma.quoteAddOn.findFirst({
            where: { id, active: true },
        });
        if (!r)
            throw new common_1.NotFoundException("Regla de adicional no encontrada");
        return {
            id: r.id,
            code: r.code,
            name: r.name,
            description: r.description,
            sortOrder: r.sortOrder,
            conditionType: r.conditionType,
            thresholdNumeric: toNum(r.thresholdNumeric),
            inputKey: r.inputKey,
            quantityRule: r.quantityRule,
            unit: r.unit,
            unitPriceDefault: toNum(r.unitPriceDefault),
            currency: r.currency,
            applicationMode: r.applicationMode,
        };
    }
    async getAddOnInputs(quoteId, versionId, user) {
        await (0, quote_access_helper_1.assertUserCanAccessQuote)(this.prisma, quoteId, user);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const rows = await this.prisma.quoteAddOnInput.findMany({
            where: { quoteVersionId: versionId },
            orderBy: { inputKey: "asc" },
        });
        return {
            inputs: rows.map((r) => ({
                inputKey: r.inputKey,
                valueNumeric: toNum(r.valueNumeric),
                valueText: r.valueText,
            })),
        };
    }
    async setAddOnInputs(quoteId, versionId, dto, user) {
        await (0, quote_access_helper_1.assertUserCanAccessQuote)(this.prisma, quoteId, user);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const inputs = dto.inputs ?? [];
        const keys = inputs.map((i) => i.inputKey).filter(Boolean);
        const seen = new Set();
        for (const k of keys) {
            if (seen.has(k))
                throw new common_1.BadRequestException(`inputKey duplicado: ${k}`);
            seen.add(k);
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.quoteAddOnInput.deleteMany({ where: { quoteVersionId: versionId } });
            for (const i of inputs) {
                if (!i.inputKey?.trim())
                    continue;
                await tx.quoteAddOnInput.create({
                    data: {
                        quoteVersionId: versionId,
                        inputKey: i.inputKey.trim(),
                        valueNumeric: i.valueNumeric != null ? new client_1.Prisma.Decimal(i.valueNumeric) : null,
                        valueText: i.valueText ?? null,
                    },
                });
            }
        });
        return this.getAddOnInputs(quoteId, versionId, user);
    }
    async evaluateAddOnSuggestions(quoteId, versionId, user) {
        await (0, quote_access_helper_1.assertUserCanAccessQuote)(this.prisma, quoteId, user);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const inputRows = await this.prisma.quoteAddOnInput.findMany({
            where: { quoteVersionId: versionId },
        });
        const inputMap = new Map();
        for (const r of inputRows) {
            inputMap.set(r.inputKey, {
                valueNumeric: toNum(r.valueNumeric),
                valueText: r.valueText,
            });
        }
        const rules = await this.prisma.quoteAddOn.findMany({
            where: { active: true, applicationMode: APPLICATION_MODE_SUGERIDO },
            orderBy: { sortOrder: "asc" },
        });
        const toUpsert = [];
        const addOnIdsToDelete = [];
        for (const rule of rules) {
            const input = inputMap.get(rule.inputKey);
            const valueNum = input?.valueNumeric ?? null;
            const valueText = input?.valueText ?? null;
            const num = valueNum ?? (valueText != null ? Number(valueText) : NaN);
            if (valueNum == null && (valueText == null || valueText === ""))
                continue;
            const threshold = toNum(rule.thresholdNumeric) ?? 0;
            let passes = false;
            switch (rule.conditionType) {
                case "NUMERIC_GT":
                    passes =
                        typeof num === "number" && !Number.isNaN(num) && num > threshold;
                    break;
                case "NUMERIC_GTE":
                    passes =
                        typeof num === "number" && !Number.isNaN(num) && num >= threshold;
                    break;
                case "NUMERIC_LT":
                    passes =
                        typeof num === "number" && !Number.isNaN(num) && num < threshold;
                    break;
                case "NUMERIC_LTE":
                    passes =
                        typeof num === "number" && !Number.isNaN(num) && num <= threshold;
                    break;
                case "BOOLEAN":
                    passes = valueText === "true" || valueNum === 1;
                    break;
                default:
                    passes = false;
            }
            if (!passes) {
                const existing = await this.prisma.quoteAddOnSuggestion.findUnique({
                    where: {
                        quoteVersionId_quoteAddOnId: {
                            quoteVersionId: versionId,
                            quoteAddOnId: rule.id,
                        },
                    },
                });
                if (existing?.status === "PENDING")
                    addOnIdsToDelete.push(rule.id);
                continue;
            }
            let quantity = 0;
            switch (rule.quantityRule) {
                case "EXCESS":
                    quantity = Math.max(0, (typeof num === "number" && !Number.isNaN(num) ? num : 0) - threshold);
                    break;
                case "VALUE":
                    quantity =
                        typeof num === "number" && !Number.isNaN(num) ? num : 0;
                    break;
                case "FIXED":
                default:
                    quantity = 1;
                    break;
            }
            const unitPrice = toNum(rule.unitPriceDefault) ?? 0;
            toUpsert.push({
                quoteAddOnId: rule.id,
                suggestedQuantity: quantity,
                suggestedUnitPrice: unitPrice,
                currency: rule.currency,
            });
        }
        await this.prisma.$transaction(async (tx) => {
            for (const addOnId of addOnIdsToDelete) {
                await tx.quoteAddOnSuggestion.deleteMany({
                    where: {
                        quoteVersionId: versionId,
                        quoteAddOnId: addOnId,
                        status: "PENDING",
                    },
                });
            }
            for (const u of toUpsert) {
                const existing = await tx.quoteAddOnSuggestion.findUnique({
                    where: {
                        quoteVersionId_quoteAddOnId: {
                            quoteVersionId: versionId,
                            quoteAddOnId: u.quoteAddOnId,
                        },
                    },
                });
                const keepStatus = existing?.status === "ACCEPTED" || existing?.status === "REJECTED";
                await tx.quoteAddOnSuggestion.upsert({
                    where: {
                        quoteVersionId_quoteAddOnId: {
                            quoteVersionId: versionId,
                            quoteAddOnId: u.quoteAddOnId,
                        },
                    },
                    create: {
                        quoteVersionId: versionId,
                        quoteAddOnId: u.quoteAddOnId,
                        suggestedQuantity: new client_1.Prisma.Decimal(u.suggestedQuantity),
                        suggestedUnitPrice: new client_1.Prisma.Decimal(u.suggestedUnitPrice),
                        currency: u.currency,
                        status: "PENDING",
                    },
                    update: keepStatus
                        ? {}
                        : {
                            suggestedQuantity: new client_1.Prisma.Decimal(u.suggestedQuantity),
                            suggestedUnitPrice: new client_1.Prisma.Decimal(u.suggestedUnitPrice),
                            currency: u.currency,
                            status: "PENDING",
                        },
                });
            }
        });
        return this.getAddOnSuggestions(quoteId, versionId, user);
    }
    async getAddOnSuggestions(quoteId, versionId, user) {
        await (0, quote_access_helper_1.assertUserCanAccessQuote)(this.prisma, quoteId, user);
        await this.ensureVersionBelongsToQuote(quoteId, versionId);
        const rows = await this.prisma.quoteAddOnSuggestion.findMany({
            where: { quoteVersionId: versionId },
            include: { quoteAddOn: true },
            orderBy: [{ quoteAddOn: { sortOrder: "asc" } }, { createdAt: "asc" }],
        });
        return {
            suggestions: rows.map((s) => ({
                id: s.id,
                quoteAddOnId: s.quoteAddOnId,
                code: s.quoteAddOn.code,
                name: s.quoteAddOn.name,
                description: s.quoteAddOn.description,
                unit: s.quoteAddOn.unit,
                suggestedQuantity: toNum(s.suggestedQuantity),
                suggestedUnitPrice: toNum(s.suggestedUnitPrice),
                currency: s.currency,
                status: s.status,
                quoteItemId: s.quoteItemId,
            })),
        };
    }
};
exports.QuoteAddOnsService = QuoteAddOnsService;
exports.QuoteAddOnsService = QuoteAddOnsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], QuoteAddOnsService);

// @ts-nocheck
// Lógica generada desde dist (emit-fv-study-service.js); tipado gradual en etapas posteriores.
import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as roleConstants from "../auth/role-constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import * as cnCommercial from "../quotes/commercial-number";
import { mapQuoteResponse } from "../quotes/quote-response.mapper";
import { QuoteVersionsService } from "../quotes/versions/quote-versions.service";
import * as suggestedItemsMatching from "./suggested-items-matching";
import { commercialNameForQuoteLine } from "../../common/product-quote-display-name";
import {
    collectFvSystemConfigErrors,
    getSystemScenarioOrNull,
} from "./domain/system-scenario";

const DEFAULT_HSP_DAILY = 5.5;
const DEFAULT_PR = 0.85;
const CALCULATION_METHOD_VERSION = "1.0";
const VALID_STATUSES = ["DRAFT", "VALIDADO", "COTIZADO", "ARCHIVADO"];
const VALID_CONNECTION_TYPES = ["MONOFASICO", "TRIFASICO"];
const VALID_SYSTEM_TYPES = ["ON_GRID", "OFF_GRID", "HYBRID"];
export const GENERATION_SOURCE_VALUES = ["INTERNAL", "EXPLORADOR_SOLAR", "MANUAL", "EXTERNAL"];
const GENERATION_SOURCE_INTERNAL = "INTERNAL";
const GENERATION_SOURCE_MANUAL = "MANUAL";
const GENERATION_SOURCE_EXPLORADOR_SOLAR = "EXPLORADOR_SOLAR";
const ACCEPTED_GENERATION_SOURCES = [
    GENERATION_SOURCE_INTERNAL,
    GENERATION_SOURCE_MANUAL,
    GENERATION_SOURCE_EXPLORADOR_SOLAR,
];
export const MOUNTING_TYPE_VALUES = ["TECHO", "SUELO", "INCLINADO_FIJO", "SEGUIMIENTO", "OTRO"];
/** Umbral relativo para considerar kWp del estudio incoherente vs paneles×Wp (solo entonces se recalcula). */
const STUDY_KWP_INCONSISTENT_RATIO = 0.2;
function roundKwp2(n) {
    return Math.round(n * 100) / 100;
}
/**
 * kWp para ítems sugeridos al crear cotización desde estudio: mantiene `studyKwp` si es > 0 y coherente
 * con paneles×Wp; si es null/0/NaN o claramente inconsistente, usa el valor derivado del layout.
 */
function effectivePotenciaSistemaKwpForStudyQuote(studyKwp, panelCount, panelWp) {
    const k = studyKwp != null && studyKwp !== "" ? Number(studyKwp) : NaN;
    const studyPositive = Number.isFinite(k) && k > 0;
    const pc = Number(panelCount);
    const pw = Number(panelWp);
    const expected = pc > 0 && pw > 0 && Number.isFinite(pc) && Number.isFinite(pw)
        ? roundKwp2((pc * pw) / 1000)
        : null;
    if (!studyPositive) {
        if (expected != null && expected > 0)
            return expected;
        return Number.isFinite(k) ? k : 0;
    }
    if (expected == null || expected <= 0)
        return k;
    const denom = Math.max(expected, k, 0.01);
    const relDiff = Math.abs(k - expected) / denom;
    if (relDiff > STUDY_KWP_INCONSISTENT_RATIO)
        return expected;
    return k;
}
function validateAndNormalizeMonths(months) {
    if (!Array.isArray(months) || months.length !== 12) {
        throw new BadRequestException("Debe enviar exactamente 12 meses (monthIndex 1 a 12 con consumptionKwh).");
    }
    const byIndex = new Map();
    for (const m of months) {
        const idx = Number(m.monthIndex);
        if (!Number.isInteger(idx) || idx < 1 || idx > 12) {
            throw new BadRequestException(`monthIndex debe ser entero entre 1 y 12; recibido: ${m.monthIndex}`);
        }
        if (byIndex.has(idx)) {
            throw new BadRequestException(`monthIndex duplicado: ${idx}`);
        }
        const consumption = Number(m.consumptionKwh);
        if (typeof consumption !== "number" || consumption < 0 || !Number.isFinite(consumption)) {
            throw new BadRequestException(`consumptionKwh inválido para mes ${idx}`);
        }
        byIndex.set(idx, consumption);
    }
    for (let i = 1; i <= 12; i++) {
        if (!byIndex.has(i)) {
            throw new BadRequestException(`Falta monthIndex ${i}. Debe haber exactamente un registro por mes (1 a 12).`);
        }
    }
    return Array.from({ length: 12 }, (_, i) => ({
        monthIndex: i + 1,
        consumptionKwh: byIndex.get(i + 1) ?? 0,
    }));
}
function validateAndNormalizeMonthsForManual(months) {
    if (!Array.isArray(months) || months.length !== 12) {
        throw new BadRequestException("Para generación manual debe enviar exactamente 12 meses (monthIndex 1 a 12) con consumptionKwh y generationKwh.");
    }
    const byIndex = new Map();
    for (const m of months) {
        const idx = Number(m.monthIndex);
        if (!Number.isInteger(idx) || idx < 1 || idx > 12) {
            throw new BadRequestException(`monthIndex debe ser entero entre 1 y 12; recibido: ${m.monthIndex}`);
        }
        if (byIndex.has(idx)) {
            throw new BadRequestException(`monthIndex duplicado: ${idx}`);
        }
        const consumption = Number(m.consumptionKwh);
        if (typeof consumption !== "number" || consumption < 0 || !Number.isFinite(consumption)) {
            throw new BadRequestException(`consumptionKwh debe ser >= 0 para mes ${idx}.`);
        }
        const gen = m.generationKwh;
        if (gen === undefined || gen === null) {
            throw new BadRequestException(`Para generación manual, generationKwh es obligatorio en cada mes. Falta en mes ${idx}.`);
        }
        const generation = Number(gen);
        if (typeof generation !== "number" || generation < 0 || !Number.isFinite(generation)) {
            throw new BadRequestException(`generationKwh debe ser >= 0 para mes ${idx}.`);
        }
        byIndex.set(idx, { consumptionKwh: consumption, generationKwh: generation });
    }
    for (let i = 1; i <= 12; i++) {
        if (!byIndex.has(i)) {
            throw new BadRequestException(`Falta monthIndex ${i}. Debe haber exactamente un registro por mes (1 a 12).`);
        }
    }
    return Array.from({ length: 12 }, (_, i) => {
        const data = byIndex.get(i + 1);
        return { monthIndex: i + 1, consumptionKwh: data.consumptionKwh, generationKwh: data.generationKwh };
    });
}
function calculateStudyResultsFromManualGeneration(monthsInput, params) {
    const vConsumo = params.valorKwhConsumo;
    const vInyeccion = params.valorKwhInyeccion;
    const generacionAnualKwh = monthsInput.reduce((s, m) => s + m.generationKwh, 0);
    const potenciaRealKwp = params.hspDaily * 365 * params.pr > 0
        ? generacionAnualKwh / (params.hspDaily * 365 * params.pr)
        : 0;
    const potenciaPorPanelWp = params.potenciaPorPanelWp > 0 ? params.potenciaPorPanelWp : 400;
    const cantidadPaneles = Math.ceil((potenciaRealKwp * 1000) / potenciaPorPanelWp);
    const monthlyResults = monthsInput.map((m) => {
        const consumptionKwh = m.consumptionKwh;
        const consumptionValue = consumptionKwh * vConsumo;
        const generationKwh = m.generationKwh;
        const autoconsumo = Math.min(generationKwh, consumptionKwh);
        const excedente = Math.max(0, generationKwh - consumptionKwh);
        const generationValue = autoconsumo * vConsumo + excedente * vInyeccion;
        const estimatedPayment = Math.max(0, consumptionValue - generationValue);
        const savingsPercent = consumptionValue > 0 ? (generationValue / consumptionValue) * 100 : 0;
        return {
            monthIndex: m.monthIndex,
            consumptionKwh,
            consumptionValue: Math.round(consumptionValue * 100) / 100,
            generationKwh: Math.round(generationKwh * 100) / 100,
            generationValue: Math.round(generationValue * 100) / 100,
            savingsPercent: Math.round(savingsPercent * 100) / 100,
            estimatedPayment: Math.round(estimatedPayment * 100) / 100,
        };
    });
    const ahorroAnual = monthlyResults.reduce((s, r) => s + r.generationValue, 0);
    const pagoResidualAnual = monthlyResults.reduce((s, r) => s + r.estimatedPayment, 0);
    const totalConsumptionValue = monthlyResults.reduce((s, r) => s + r.consumptionKwh * vConsumo, 0);
    const porcentajeAhorro = totalConsumptionValue > 0 ? (ahorroAnual / totalConsumptionValue) * 100 : 0;
    return {
        potenciaSistemaKwp: Math.round(potenciaRealKwp * 100) / 100,
        cantidadPaneles,
        generacionAnualKwh: Math.round(generacionAnualKwh * 100) / 100,
        ahorroAnual: Math.round(ahorroAnual * 100) / 100,
        porcentajeAhorro: Math.round(porcentajeAhorro * 100) / 100,
        pagoResidualAnual: Math.round(pagoResidualAnual * 100) / 100,
        monthlyResults,
        hspDailyUsed: params.hspDaily,
        performanceRatioUsed: params.pr,
        calculationMethodVersion: params.methodVersion,
    };
}
function calculateStudyResults(monthsInput, params) {
    const consumoAnualKwh = monthsInput.reduce((s, m) => s + m.consumptionKwh, 0);
    const cobertura = Math.min(100, Math.max(0, params.coberturaDeseada)) / 100;
    const generacionAnualPorKwp = params.hspDaily * 365 * params.pr;
    const potenciaPorPanelWp = params.potenciaPorPanelWp > 0 ? params.potenciaPorPanelWp : 400;
    let plantaKwp;
    let cantidadPaneles;
    let potenciaRealKwp;
    const fixedPanels = params.fixedCantidadPaneles != null && Number.isFinite(Number(params.fixedCantidadPaneles))
        ? Math.max(0, Math.round(Number(params.fixedCantidadPaneles)))
        : 0;
    if (fixedPanels > 0) {
        cantidadPaneles = fixedPanels;
        potenciaRealKwp = (cantidadPaneles * potenciaPorPanelWp) / 1000;
    }
    else {
        if (params.potenciaSistemaKwp != null && params.potenciaSistemaKwp > 0) {
            plantaKwp = params.potenciaSistemaKwp;
        }
        else {
            if (generacionAnualPorKwp <= 0)
                throw new BadRequestException("Parámetros de generación inválidos (HSP/PR).");
            const energiaACubrirKwh = consumoAnualKwh * cobertura;
            plantaKwp = energiaACubrirKwh / generacionAnualPorKwp;
        }
        plantaKwp = Math.round(plantaKwp * 100) / 100;
        cantidadPaneles = Math.ceil((plantaKwp * 1000) / potenciaPorPanelWp);
        potenciaRealKwp = (cantidadPaneles * potenciaPorPanelWp) / 1000;
    }
    const generacionAnualKwh = potenciaRealKwp * params.hspDaily * 365 * params.pr;
    const generacionMensualKwh = generacionAnualKwh / 12;
    const vConsumo = params.valorKwhConsumo;
    const vInyeccion = params.valorKwhInyeccion;
    const monthlyResults = monthsInput.map((m) => {
        const consumptionKwh = m.consumptionKwh;
        const consumptionValue = consumptionKwh * vConsumo;
        const generationKwh = generacionMensualKwh;
        const autoconsumo = Math.min(generationKwh, consumptionKwh);
        const excedente = Math.max(0, generationKwh - consumptionKwh);
        const generationValue = autoconsumo * vConsumo + excedente * vInyeccion;
        const estimatedPayment = Math.max(0, consumptionValue - generationValue);
        const savingsPercent = consumptionValue > 0 ? (generationValue / consumptionValue) * 100 : 0;
        return {
            monthIndex: m.monthIndex,
            consumptionKwh,
            consumptionValue: Math.round(consumptionValue * 100) / 100,
            generationKwh: Math.round(generationKwh * 100) / 100,
            generationValue: Math.round(generationValue * 100) / 100,
            savingsPercent: Math.round(savingsPercent * 100) / 100,
            estimatedPayment: Math.round(estimatedPayment * 100) / 100,
        };
    });
    const ahorroAnual = monthlyResults.reduce((s, r) => s + r.generationValue, 0);
    const pagoResidualAnual = monthlyResults.reduce((s, r) => s + r.estimatedPayment, 0);
    const totalConsumptionValue = monthlyResults.reduce((s, r) => s + r.consumptionKwh * vConsumo, 0);
    const porcentajeAhorro = totalConsumptionValue > 0 ? (ahorroAnual / totalConsumptionValue) * 100 : 0;
    return {
        potenciaSistemaKwp: Math.round(potenciaRealKwp * 100) / 100,
        cantidadPaneles,
        generacionAnualKwh: Math.round(generacionAnualKwh * 100) / 100,
        ahorroAnual: Math.round(ahorroAnual * 100) / 100,
        porcentajeAhorro: Math.round(porcentajeAhorro * 100) / 100,
        pagoResidualAnual: Math.round(pagoResidualAnual * 100) / 100,
        monthlyResults,
        hspDailyUsed: params.hspDaily,
        performanceRatioUsed: params.pr,
        calculationMethodVersion: params.methodVersion,
    };
}
const MOUNTING_TYPE_LABELS = {
    TECHO: "techo",
    SUELO: "suelo",
    INCLINADO_FIJO: "inclinado fijo",
    SEGUIMIENTO: "seguimiento",
    OTRO: "otro",
};
const CONNECTION_TYPE_LABELS = {
    MONOFASICO: "monofásico",
    TRIFASICO: "trifásico",
};
@Injectable()
export class FvStudyService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly quoteVersionsService: QuoteVersionsService,
    ) {}
    async findAll(clientId, _currentUser) {
        const where = {};
        if (clientId)
            where.clientId = clientId;
        const list = await this.prisma.fvStudy.findMany({
            where,
            include: {
                client: { select: { id: true, name: true } },
                owner: { select: { id: true, name: true, email: true } },
                months: { orderBy: { monthIndex: "asc" } },
            },
            orderBy: { updatedAt: "desc" },
        });
        return list.map((row) => this.toResponse(row));
    }
    async findByClientId(clientId) {
        const client = await this.prisma.client.findUnique({ where: { id: clientId } });
        if (!client)
            throw new NotFoundException("Cliente no encontrado");
        return this.findAll(clientId, undefined);
    }
    async findOne(id, currentUser) {
        const study = await this.prisma.fvStudy.findUnique({
            where: { id },
            include: {
                client: { select: { id: true, name: true, email: true, address: true } },
                owner: { select: { id: true, name: true, email: true } },
                months: { orderBy: { monthIndex: "asc" } },
            },
        });
        if (!study)
            throw new NotFoundException("Estudio FV no encontrado");
        this.assertCanRead(study, currentUser);
        return this.toResponse(study);
    }
    async create(dto, currentUser) {
        const client = await this.prisma.client.findUnique({ where: { id: dto.clientId } });
        if (!client)
            throw new NotFoundException("Cliente no encontrado");
        this.validateMonthIndex(dto.referenceMonth, "referenceMonth");
        this.validateConnectionType(dto.connectionType);
        if (dto.systemType != null) {
            this.validateSystemType(dto.systemType);
        }
        this.validateFvStudyGridFlagsOnCreate(dto);
        const systemTypeForScenario = dto.systemType ?? "ON_GRID";
        this.assertFvSystemConfig({
            systemType: systemTypeForScenario,
            utilityGridAvailable: dto.utilityGridAvailable,
            gridExportEnabled: dto.gridExportEnabled,
        });
        this.validateSolarResource(dto);
        const source = dto.generationSource ?? GENERATION_SOURCE_INTERNAL;
        const hsp = dto.hspDailyUsed ?? DEFAULT_HSP_DAILY;
        const pr = dto.performanceRatioUsed ?? DEFAULT_PR;
        const methodVersion = dto.calculationMethodVersion ?? CALCULATION_METHOD_VERSION;
        const currency = dto.currency ?? "CLP";
        let result;
        if (source === GENERATION_SOURCE_MANUAL) {
            const monthsInput = validateAndNormalizeMonthsForManual(dto.months);
            result = calculateStudyResultsFromManualGeneration(monthsInput, {
                valorKwhConsumo: dto.valorKwhConsumo,
                valorKwhInyeccion: dto.valorKwhInyeccion,
                potenciaPorPanelWp: dto.potenciaPorPanelWp,
                hspDaily: hsp,
                pr,
                methodVersion,
            });
        }
        else {
            const monthsInput = validateAndNormalizeMonths(dto.months);
            result = calculateStudyResults(monthsInput, {
                valorKwhConsumo: dto.valorKwhConsumo,
                valorKwhInyeccion: dto.valorKwhInyeccion,
                coberturaDeseada: dto.coberturaDeseada,
                potenciaPorPanelWp: dto.potenciaPorPanelWp,
                potenciaSistemaKwp: dto.potenciaSistemaKwp,
                hspDaily: hsp,
                pr,
                methodVersion,
            });
        }
        const study = await this.prisma.fvStudy.create({
            data: {
                clientId: dto.clientId,
                ownerId: currentUser.id,
                status: "DRAFT",
                title: dto.title,
                referenceMonth: dto.referenceMonth,
                referenceBillAmount: dto.referenceBillAmount ?? null,
                referenceConsumptionKwh: dto.referenceConsumptionKwh ?? null,
                valorKwhConsumo: dto.valorKwhConsumo,
                valorKwhInyeccion: dto.valorKwhInyeccion,
                currency,
                connectionType: dto.connectionType,
                tipoProyecto: dto.tipoProyecto,
                systemType: dto.systemType ?? "ON_GRID",
                utilityGridAvailable: dto.utilityGridAvailable,
                gridExportEnabled: dto.gridExportEnabled,
                potenciaSistemaKwp: result.potenciaSistemaKwp,
                potenciaPorPanelWp: dto.potenciaPorPanelWp,
                coberturaDeseada: dto.coberturaDeseada,
                hspDailyUsed: result.hspDailyUsed,
                performanceRatioUsed: result.performanceRatioUsed,
                calculationMethodVersion: result.calculationMethodVersion,
                cantidadPaneles: result.cantidadPaneles,
                generacionAnualKwh: result.generacionAnualKwh,
                ahorroAnual: result.ahorroAnual,
                porcentajeAhorro: result.porcentajeAhorro,
                pagoResidualAnual: result.pagoResidualAnual,
                ...this.solarResourceDataFromDto(dto),
            },
        });
        await this.prisma.fvStudyMonth.createMany({
            data: result.monthlyResults.map((r) => ({
                fvStudyId: study.id,
                monthIndex: r.monthIndex,
                consumptionKwh: r.consumptionKwh,
                consumptionValue: r.consumptionValue,
                generationKwh: r.generationKwh,
                generationValue: r.generationValue,
                savingsPercent: r.savingsPercent,
                estimatedPayment: r.estimatedPayment,
            })),
        });
        return this.findOne(study.id, currentUser);
    }
    async update(id, dto, currentUser) {
        const study = await this.prisma.fvStudy.findUnique({
            where: { id },
            include: { months: { orderBy: { monthIndex: "asc" } } },
        });
        if (!study)
            throw new NotFoundException("Estudio FV no encontrado");
        this.assertCanWrite(study, currentUser);
        if (study.status === "ARCHIVADO") {
            throw new BadRequestException("No se puede editar un estudio archivado.");
        }
        if (dto.referenceMonth != null)
            this.validateMonthIndex(dto.referenceMonth, "referenceMonth");
        if (dto.connectionType != null)
            this.validateConnectionType(dto.connectionType);
        if (dto.systemType !== undefined && dto.systemType != null) {
            this.validateSystemType(dto.systemType);
        }
        if (dto.status != null && !VALID_STATUSES.includes(dto.status)) {
            throw new BadRequestException(`status debe ser uno de: ${VALID_STATUSES.join(", ")}`);
        }
        this.validateSolarResource(dto);
        const effectiveSource = (dto.generationSource ?? study.generationSource ?? GENERATION_SOURCE_INTERNAL).toString();
        let result = null;
        if (dto.months != null && dto.months.length > 0) {
            const hsp = dto.hspDailyUsed ?? study.hspDailyUsed;
            const pr = dto.performanceRatioUsed ?? study.performanceRatioUsed;
            const methodVersion = dto.calculationMethodVersion ?? study.calculationMethodVersion;
            if (effectiveSource === GENERATION_SOURCE_MANUAL) {
                const monthsNormalized = validateAndNormalizeMonthsForManual(dto.months);
                result = calculateStudyResultsFromManualGeneration(monthsNormalized, {
                    valorKwhConsumo: dto.valorKwhConsumo ?? study.valorKwhConsumo,
                    valorKwhInyeccion: dto.valorKwhInyeccion ?? study.valorKwhInyeccion,
                    potenciaPorPanelWp: dto.potenciaPorPanelWp ?? study.potenciaPorPanelWp,
                    hspDaily: hsp,
                    pr,
                    methodVersion,
                });
            }
            else {
                const monthsInput = validateAndNormalizeMonths(dto.months);
                result = calculateStudyResults(monthsInput, {
                    valorKwhConsumo: dto.valorKwhConsumo ?? study.valorKwhConsumo,
                    valorKwhInyeccion: dto.valorKwhInyeccion ?? study.valorKwhInyeccion,
                    coberturaDeseada: dto.coberturaDeseada ?? study.coberturaDeseada,
                    potenciaPorPanelWp: dto.potenciaPorPanelWp ?? study.potenciaPorPanelWp,
                    potenciaSistemaKwp: dto.potenciaSistemaKwp ?? study.potenciaSistemaKwp,
                    hspDaily: hsp,
                    pr,
                    methodVersion,
                });
            }
        }
        const updateData = {};
        if (dto.title != null)
            updateData.title = dto.title;
        if (dto.referenceMonth != null)
            updateData.referenceMonth = dto.referenceMonth;
        if (dto.referenceBillAmount !== undefined)
            updateData.referenceBillAmount = dto.referenceBillAmount;
        if (dto.referenceConsumptionKwh !== undefined)
            updateData.referenceConsumptionKwh = dto.referenceConsumptionKwh;
        if (dto.valorKwhConsumo != null)
            updateData.valorKwhConsumo = dto.valorKwhConsumo;
        if (dto.valorKwhInyeccion != null)
            updateData.valorKwhInyeccion = dto.valorKwhInyeccion;
        if (dto.currency != null)
            updateData.currency = dto.currency;
        if (dto.connectionType != null)
            updateData.connectionType = dto.connectionType;
        if (dto.tipoProyecto != null)
            updateData.tipoProyecto = dto.tipoProyecto;
        if (dto.systemType !== undefined) {
            updateData.systemType = dto.systemType;
        }
        if (dto.utilityGridAvailable !== undefined) {
            if (typeof dto.utilityGridAvailable !== "boolean") {
                throw new BadRequestException("utilityGridAvailable debe ser boolean.");
            }
            updateData.utilityGridAvailable = dto.utilityGridAvailable;
        }
        if (dto.gridExportEnabled !== undefined) {
            if (typeof dto.gridExportEnabled !== "boolean") {
                throw new BadRequestException("gridExportEnabled debe ser boolean.");
            }
            updateData.gridExportEnabled = dto.gridExportEnabled;
        }
        if (dto.status != null)
            updateData.status = dto.status;
        if (dto.hspDailyUsed != null)
            updateData.hspDailyUsed = dto.hspDailyUsed;
        if (dto.performanceRatioUsed != null)
            updateData.performanceRatioUsed = dto.performanceRatioUsed;
        if (dto.calculationMethodVersion != null)
            updateData.calculationMethodVersion = dto.calculationMethodVersion;
        if (dto.potenciaPorPanelWp != null)
            updateData.potenciaPorPanelWp = dto.potenciaPorPanelWp;
        if (dto.coberturaDeseada != null)
            updateData.coberturaDeseada = dto.coberturaDeseada;
        if (result) {
            updateData.potenciaSistemaKwp = result.potenciaSistemaKwp;
            updateData.cantidadPaneles = result.cantidadPaneles;
            updateData.generacionAnualKwh = result.generacionAnualKwh;
            updateData.ahorroAnual = result.ahorroAnual;
            updateData.porcentajeAhorro = result.porcentajeAhorro;
            updateData.pagoResidualAnual = result.pagoResidualAnual;
            updateData.hspDailyUsed = result.hspDailyUsed;
            updateData.performanceRatioUsed = result.performanceRatioUsed;
            updateData.calculationMethodVersion = result.calculationMethodVersion;
        }
        if (dto.potenciaSistemaKwp != null)
            updateData.potenciaSistemaKwp = dto.potenciaSistemaKwp;
        Object.assign(updateData, this.solarResourceDataFromDto(dto));
        const nextScenarioInput = {
            systemType:
                updateData.systemType !== undefined ? updateData.systemType : study.systemType ?? "ON_GRID",
            utilityGridAvailable:
                updateData.utilityGridAvailable !== undefined
                    ? updateData.utilityGridAvailable
                    : study.utilityGridAvailable,
            gridExportEnabled:
                updateData.gridExportEnabled !== undefined
                    ? updateData.gridExportEnabled
                    : study.gridExportEnabled,
        };
        this.assertFvSystemConfig(nextScenarioInput);
        await this.prisma.fvStudy.update({
            where: { id },
            data: updateData,
        });
        if (result) {
            await this.prisma.fvStudyMonth.deleteMany({ where: { fvStudyId: id } });
            await this.prisma.fvStudyMonth.createMany({
                data: result.monthlyResults.map((r) => ({
                    fvStudyId: id,
                    monthIndex: r.monthIndex,
                    consumptionKwh: r.consumptionKwh,
                    consumptionValue: r.consumptionValue,
                    generationKwh: r.generationKwh,
                    generationValue: r.generationValue,
                    savingsPercent: r.savingsPercent,
                    estimatedPayment: r.estimatedPayment,
                })),
            });
        }
        return this.findOne(id, currentUser);
    }
    async syncFromImplantationDesign(input) {
        const study = await this.prisma.fvStudy.findUnique({
            where: { id: input.fvStudyId },
            include: { months: { orderBy: { monthIndex: "asc" } } },
        });
        if (!study)
            return;
        const panelCount = Math.max(0, Math.round(Number(input.panelCount) || 0));
        const panelPowerWp = input.panelPowerWp != null && Number.isFinite(input.panelPowerWp) && input.panelPowerWp > 0
            ? input.panelPowerWp
            : study.potenciaPorPanelWp;
        const updateData = {
            cantidadPaneles: panelCount,
        };
        if (study.latitude == null && input.centerLat != null) {
            updateData.latitude = input.centerLat;
        }
        if (study.longitude == null && input.centerLng != null) {
            updateData.longitude = input.centerLng;
        }
        if (input.panelPowerWp != null && Number.isFinite(input.panelPowerWp) && input.panelPowerWp > 0) {
            updateData.potenciaPorPanelWp = input.panelPowerWp;
        }
        const potenciaSistemaKwp = panelPowerWp != null && panelCount > 0 ? Math.round(((panelCount * panelPowerWp) / 1000) * 100) / 100 : null;
        if (potenciaSistemaKwp != null) {
            updateData.potenciaSistemaKwp = potenciaSistemaKwp;
        }
        const generationSource = (study.generationSource ?? GENERATION_SOURCE_INTERNAL).toString();
        const canRecalculate = generationSource !== GENERATION_SOURCE_MANUAL &&
            study.months.length === 12 &&
            panelPowerWp != null &&
            potenciaSistemaKwp != null;
        let result = null;
        if (canRecalculate) {
            result = calculateStudyResults(study.months.map((m) => ({
                monthIndex: m.monthIndex,
                consumptionKwh: m.consumptionKwh,
            })), {
                valorKwhConsumo: study.valorKwhConsumo,
                valorKwhInyeccion: study.valorKwhInyeccion,
                coberturaDeseada: study.coberturaDeseada,
                potenciaPorPanelWp: panelPowerWp,
                potenciaSistemaKwp,
                fixedCantidadPaneles: panelCount > 0 ? panelCount : undefined,
                hspDaily: study.hspDailyUsed ?? DEFAULT_HSP_DAILY,
                pr: study.performanceRatioUsed ?? DEFAULT_PR,
                methodVersion: study.calculationMethodVersion ?? CALCULATION_METHOD_VERSION,
            });
            updateData.potenciaSistemaKwp = result.potenciaSistemaKwp;
            updateData.cantidadPaneles = result.cantidadPaneles;
            updateData.generacionAnualKwh = result.generacionAnualKwh;
            updateData.ahorroAnual = result.ahorroAnual;
            updateData.porcentajeAhorro = result.porcentajeAhorro;
            updateData.pagoResidualAnual = result.pagoResidualAnual;
            updateData.hspDailyUsed = result.hspDailyUsed;
            updateData.performanceRatioUsed = result.performanceRatioUsed;
            updateData.calculationMethodVersion = result.calculationMethodVersion;
        }
        await this.prisma.fvStudy.update({
            where: { id: study.id },
            data: updateData,
        });
        if (result) {
            await this.prisma.fvStudyMonth.deleteMany({ where: { fvStudyId: study.id } });
            await this.prisma.fvStudyMonth.createMany({
                data: result.monthlyResults.map((r) => ({
                    fvStudyId: study.id,
                    monthIndex: r.monthIndex,
                    consumptionKwh: r.consumptionKwh,
                    consumptionValue: r.consumptionValue,
                    generationKwh: r.generationKwh,
                    generationValue: r.generationValue,
                    savingsPercent: r.savingsPercent,
                    estimatedPayment: r.estimatedPayment,
                })),
            });
        }
    }
    async archive(id, currentUser) {
        const study = await this.prisma.fvStudy.findUnique({ where: { id } });
        if (!study)
            throw new NotFoundException("Estudio FV no encontrado");
        this.assertCanWrite(study, currentUser);
        await this.prisma.fvStudy.update({
            where: { id },
            data: { status: "ARCHIVADO" },
        });
        return this.findOne(id, currentUser);
    }
    /**
     * Eliminación permanente. Cotizaciones que referenciaban el estudio conservan datos;
     * `sourceFvStudyId` queda en null (onDelete: SetNull en schema). Meses e implantación se eliminan en cascada.
     */
    async remove(id, currentUser) {
        const study = await this.prisma.fvStudy.findUnique({ where: { id } });
        if (!study)
            throw new NotFoundException("Estudio FV no encontrado");
        this.assertCanWrite(study, currentUser);
        try {
            await this.prisma.fvStudy.delete({ where: { id } });
        }
        catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
                throw new BadRequestException("No se puede eliminar: el estudio sigue referenciado de forma que impide borrarlo.");
            }
            throw e;
        }
        return { deleted: true };
    }
    async getSolarResourceExternalContext(id, currentUser) {
        const study = await this.findOne(id, currentUser);
        const design = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId: id },
            include: { placements: true },
        });
        const hasDesign = design != null;
        const placementCount = design?.placements?.length ?? 0;
        const useImplantationPanelCount = hasDesign && placementCount > 0;
        const panelCount = useImplantationPanelCount
            ? placementCount
            : study.cantidadPaneles != null
                ? study.cantidadPaneles
                : null;
        const panelSource = useImplantationPanelCount
            ? "IMPLANTATION_DESIGN"
            : panelCount != null
                ? "FV_STUDY"
                : null;
        const panelPowerWp = design?.panelPowerWSnapshot != null
            ? design.panelPowerWSnapshot
            : study.potenciaPorPanelWp != null
                ? study.potenciaPorPanelWp
                : null;
        const systemPowerKw = panelCount != null && panelPowerWp != null ? (panelCount * panelPowerWp) / 1000 : null;
        return {
            fvStudyId: study.id,
            generationSource: study.generationSource ?? "INTERNAL",
            /** Para estimación externa: respaldo mismo criterio INTERNAL (kWp × HSP × 365 × PR). */
            hspDailyUsed: study.hspDailyUsed,
            performanceRatioUsed: study.performanceRatioUsed,
            address: study.client?.address ?? null,
            latitude: study.latitude != null
                ? study.latitude
                : design != null
                    ? design.centerLat
                    : null,
            longitude: study.longitude != null
                ? study.longitude
                : design != null
                    ? design.centerLng
                    : null,
            mountingType: study.mountingType ?? null,
            tiltDegrees: study.tiltDegrees ?? null,
            azimuthDegrees: study.azimuthDegrees ?? null,
            solarResourceProvider: study.solarResourceProvider ?? null,
            panelCount,
            panelSource,
            panelProductId: design?.panelProductId ?? null,
            panelName: design?.panelNameSnapshot ?? null,
            panelPowerWp,
            systemPowerKw,
            hasImplantationDesign: hasDesign,
            implantationDesignId: design?.id ?? null,
        };
    }
    async createQuoteFromStudy(studyId, createWithSuggestedItems, currentUser, options) {
        const quoteKind = options?.quoteKind === "MARGIN" ? "MARGIN" : "STANDARD";
        const study = await this.prisma.fvStudy.findUnique({
            where: { id: studyId },
            select: {
                id: true,
                clientId: true,
                title: true,
                tipoProyecto: true,
                currency: true,
                ownerId: true,
                cantidadPaneles: true,
                potenciaPorPanelWp: true,
                potenciaSistemaKwp: true,
                connectionType: true,
                mountingType: true,
            },
        });
        if (!study)
            throw new NotFoundException("Estudio FV no encontrado");
        this.assertCanWrite(study, currentUser);
        const implantationDesign = await this.prisma.implantationDesign.findUnique({
            where: { fvStudyId: studyId },
            select: {
                panelProductId: true,
                panelNameSnapshot: true,
                panelPowerWSnapshot: true,
                _count: { select: { placements: true } },
            },
        });
        const placementCount = implantationDesign?._count?.placements ?? 0;
        const useImplantationCount = placementCount > 0;
        const effectiveCantidadPaneles = useImplantationCount ? placementCount : study.cantidadPaneles;
        const effectivePotenciaPorPanelWp = useImplantationCount &&
            implantationDesign?.panelPowerWSnapshot != null &&
            Number(implantationDesign.panelPowerWSnapshot) > 0
            ? implantationDesign.panelPowerWSnapshot
            : study.potenciaPorPanelWp;
        const effectivePotenciaSistemaKwp = effectivePotenciaSistemaKwpForStudyQuote(study.potenciaSistemaKwp, effectiveCantidadPaneles, effectivePotenciaPorPanelWp);
        const studyForSuggestions = {
            ...study,
            cantidadPaneles: effectiveCantidadPaneles,
            potenciaPorPanelWp: effectivePotenciaPorPanelWp,
            potenciaSistemaKwp: effectivePotenciaSistemaKwp,
        };
        const title = study.title?.trim()
            ? `Cotización - ${study.title.trim()}`
            : "Cotización FV";
        const currency = study.currency ?? "CLP";
        const connLabel = CONNECTION_TYPE_LABELS[study.connectionType] ?? study.connectionType;
        const mountLabel = study.mountingType
            ? MOUNTING_TYPE_LABELS[study.mountingType] ?? study.mountingType
            : "";
        const manualPanelsBaseName = useImplantationCount && implantationDesign?.panelNameSnapshot?.trim()
            ? implantationDesign.panelNameSnapshot.trim()
            : "Suministro de paneles fotovoltaicos";
        const manualPanels = {
            productNameSnapshot: manualPanelsBaseName,
            productDescriptionSnapshot: `${effectiveCantidadPaneles} unidades de ${effectivePotenciaPorPanelWp} Wp (sistema ${effectivePotenciaSistemaKwp} kWp)`,
            quantity: effectiveCantidadPaneles,
        };
        const manualInverter = {
            productNameSnapshot: "Suministro de inversor",
            productDescriptionSnapshot: `Inversor ${connLabel} para sistema de ${effectivePotenciaSistemaKwp} kW`,
            quantity: 1,
        };
        const manualStructure = {
            productNameSnapshot: "Estructura de montaje",
            productDescriptionSnapshot: mountLabel
                ? `Estructura ${mountLabel} para ${effectiveCantidadPaneles} paneles`
                : `Estructura para ${effectiveCantidadPaneles} paneles`,
            quantity: 1,
        };
        const designPanelProductId = (implantationDesign?.panelProductId ?? "").trim();
        const result = await this.prisma.$transaction(async (tx) => {
            const sellerInitials = cnCommercial.sellerInitialsForCommercialNumber({
                fullName: currentUser.fullName,
                name: currentUser.name,
                email: currentUser.email,
            });
            const { commercialSequence, commercialNumber } = await cnCommercial.getNextCommercialNumber(tx, study.tipoProyecto, {
                sellerInitials,
            });
            const quote = await tx.quote.create({
                data: {
                    clientId: study.clientId,
                    ownerId: currentUser.id,
                    sourceFvStudyId: study.id,
                    suggestedItemsFromStudy: createWithSuggestedItems,
                    status: "BORRADOR",
                    title,
                    projectType: study.tipoProyecto,
                    currency,
                    commercialSequence,
                    commercialNumber,
                    quoteKind,
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
            if (createWithSuggestedItems) {
                let panelResult;
                if (useImplantationCount && designPanelProductId) {
                    const fromDesign = await suggestedItemsMatching.resolvePanelProductById(tx, designPanelProductId, effectiveCantidadPaneles, currency);
                    panelResult = fromDesign ?? { fromCatalog: false, quantity: effectiveCantidadPaneles };
                }
                else {
                    panelResult = await suggestedItemsMatching.resolvePanelCandidate(tx, studyForSuggestions, currency);
                }
                const inverterResult = await suggestedItemsMatching.resolveInverterCandidate(tx, studyForSuggestions, currency);
                const structureResult = await suggestedItemsMatching.resolveStructureCandidate(tx, studyForSuggestions, currency);
                const buildLineData = (result, manual) => {
                    if (result.fromCatalog) {
                        const lineTotal = result.quantity * result.unitPrice;
                        const displayName = commercialNameForQuoteLine(result.product);
                        return {
                            mainName: displayName,
                            lineData: {
                                productId: result.product.id,
                                categoryId: result.product.categoryId,
                                brandId: result.product.brandId,
                                modelId: result.product.modelId,
                                productNameSnapshot: displayName,
                                productDescriptionSnapshot: result.product.description ?? null,
                                categoryNameSnapshot: result.product.category?.name ?? null,
                                brandNameSnapshot: result.product.brandNameFree ?? result.product.brand?.name ?? null,
                                modelNameSnapshot: result.product.modelNameFree ?? result.product.model?.name ?? null,
                                currencySnapshot: result.currency,
                                unitPriceSnapshot: result.unitPrice,
                                unitCostSnapshot: null,
                                discountPercentSnapshot: 0,
                                marginPercentSnapshot: null,
                                quantity: result.quantity,
                                lineTotalSnapshot: lineTotal,
                            },
                        };
                    }
                    return {
                        mainName: manual.productNameSnapshot,
                        lineData: {
                            productId: null,
                            categoryId: null,
                            brandId: null,
                            modelId: null,
                            productNameSnapshot: manual.productNameSnapshot,
                            productDescriptionSnapshot: manual.productDescriptionSnapshot,
                            categoryNameSnapshot: null,
                            brandNameSnapshot: null,
                            modelNameSnapshot: null,
                            currencySnapshot: currency,
                            unitPriceSnapshot: 0,
                            unitCostSnapshot: null,
                            discountPercentSnapshot: 0,
                            marginPercentSnapshot: null,
                            quantity: manual.quantity,
                            lineTotalSnapshot: 0,
                        },
                    };
                };
                const createMainItemAndLine = async (sortOrder, mainName, lineData, sourceFromFvStudyKind) => {
                    const mainItem = await tx.quoteMainItem.create({
                        data: {
                            quoteVersionId: version.id,
                            name: mainName,
                            description: null,
                            sortOrder,
                            visibleInFinalQuote: true,
                            totalMode: "SUM_LINES",
                            totalOverride: null,
                            sourceFromFvStudyKind: sourceFromFvStudyKind ?? null,
                        },
                    });
                    await tx.quoteItemLine.create({
                        data: {
                            quoteMainItemId: mainItem.id,
                            productId: lineData.productId,
                            categoryId: lineData.categoryId,
                            brandId: lineData.brandId,
                            modelId: lineData.modelId,
                            productNameSnapshot: lineData.productNameSnapshot,
                            productDescriptionSnapshot: lineData.productDescriptionSnapshot,
                            categoryNameSnapshot: lineData.categoryNameSnapshot,
                            brandNameSnapshot: lineData.brandNameSnapshot,
                            modelNameSnapshot: lineData.modelNameSnapshot,
                            currencySnapshot: lineData.currencySnapshot,
                            unitPriceSnapshot: lineData.unitPriceSnapshot,
                            unitCostSnapshot: lineData.unitCostSnapshot,
                            discountPercentSnapshot: lineData.discountPercentSnapshot,
                            marginPercentSnapshot: lineData.marginPercentSnapshot,
                            quantity: lineData.quantity,
                            lineTotalSnapshot: lineData.lineTotalSnapshot,
                            sortOrder: 0,
                            visibleInFinalQuote: false,
                            configSnapshot: null,
                        },
                    });
                };
                const panel = buildLineData(panelResult, manualPanels);
                await createMainItemAndLine(0, panel.mainName, panel.lineData, "PANELS");
                const inverter = buildLineData(inverterResult, manualInverter);
                await createMainItemAndLine(1, inverter.mainName, inverter.lineData, "INVERTER");
                const structure = buildLineData(structureResult, manualStructure);
                await createMainItemAndLine(2, structure.mainName, structure.lineData, "STRUCTURE");
                await createMainItemAndLine(3, "Instalación y puesta en marcha", {
                    productId: null,
                    categoryId: null,
                    brandId: null,
                    modelId: null,
                    productNameSnapshot: "Instalación y puesta en marcha",
                    productDescriptionSnapshot: "Incluye instalación y puesta en marcha del sistema",
                    categoryNameSnapshot: null,
                    brandNameSnapshot: null,
                    modelNameSnapshot: null,
                    currencySnapshot: currency,
                    unitPriceSnapshot: 0,
                    unitCostSnapshot: null,
                    discountPercentSnapshot: 0,
                    marginPercentSnapshot: null,
                    quantity: 1,
                    lineTotalSnapshot: 0,
                }, null);
                await createMainItemAndLine(4, "Ingeniería y documentación técnica", {
                    productId: null,
                    categoryId: null,
                    brandId: null,
                    modelId: null,
                    productNameSnapshot: "Ingeniería y documentación técnica",
                    productDescriptionSnapshot: "Proyecto de ingeniería y documentación técnica",
                    categoryNameSnapshot: null,
                    brandNameSnapshot: null,
                    modelNameSnapshot: null,
                    currencySnapshot: currency,
                    unitPriceSnapshot: 0,
                    unitCostSnapshot: null,
                    discountPercentSnapshot: 0,
                    marginPercentSnapshot: null,
                    quantity: 1,
                    lineTotalSnapshot: 0,
                }, null);
                await this.quoteVersionsService.recalcVersionTotalsTx(tx, version.id);
            }
            await tx.fvStudy.update({
                where: { id: studyId },
                data: { status: "COTIZADO" },
            });
            return { quote, version };
        });
        return {
            quote: mapQuoteResponse(result.quote),
            version: {
                id: result.version.id,
                versionNumber: result.version.versionNumber,
                status: result.version.status,
            },
        };
    }
    assertCanRead(study, currentUser) {
        if (!currentUser)
            return;
        const roles = currentUser.roles ?? [];
        if (roleConstants.hasGlobalAdminPrivileges(roles))
            return;
        if (study.ownerId === currentUser.id)
            return;
        if (roles.includes(roleConstants.ROLE_VENTAS_LEGACY) ||
            roles.includes(roleConstants.ROLE_VENDEDOR_TECNICO) ||
            roles.includes("INGENIERIA") ||
            roles.includes("LECTURA"))
            return;
    }
    async assertCanWrite(study, currentUser) {
        const roles = currentUser.roles ?? [];
        if (roleConstants.hasGlobalAdminPrivileges(roles))
            return;
        if (study.ownerId === currentUser.id)
            return;
        if (roles.includes(roleConstants.ROLE_VENTAS_LEGACY) ||
            roles.includes(roleConstants.ROLE_VENDEDOR_TECNICO) ||
            roles.includes("INGENIERIA"))
            return;
        throw new ForbiddenException("Sin permiso para modificar este estudio FV.");
    }
    validateMonthIndex(value, field) {
        const n = Number(value);
        if (!Number.isInteger(n) || n < 1 || n > 12) {
            throw new BadRequestException(`${field} debe ser un entero entre 1 y 12; recibido: ${value}`);
        }
    }
    validateConnectionType(connectionType) {
        if (!VALID_CONNECTION_TYPES.includes(connectionType)) {
            throw new BadRequestException(`connectionType debe ser MONOFASICO o TRIFASICO; recibido: ${connectionType}`);
        }
    }
    validateSystemType(systemType) {
        if (!VALID_SYSTEM_TYPES.includes(systemType)) {
            throw new BadRequestException(
                `systemType debe ser ON_GRID, OFF_GRID o HYBRID; recibido: ${systemType}`,
            );
        }
    }
    validateFvStudyGridFlagsOnCreate(dto) {
        if (dto.utilityGridAvailable === undefined || dto.gridExportEnabled === undefined) {
            throw new BadRequestException(
                "En la creación son obligatorios utilityGridAvailable y gridExportEnabled (boolean).",
            );
        }
        if (typeof dto.utilityGridAvailable !== "boolean" || typeof dto.gridExportEnabled !== "boolean") {
            throw new BadRequestException("utilityGridAvailable y gridExportEnabled deben ser boolean.");
        }
    }
    assertFvSystemConfig(input) {
        const errs = collectFvSystemConfigErrors(input);
        if (errs.length === 0)
            return;
        if (errs.length === 1) {
            throw new BadRequestException(errs[0]);
        }
        throw new BadRequestException({
            message: "Configuración del sistema FV inválida.",
            errors: errs,
        });
    }
    validateSolarResource(dto) {
        if (dto.generationSource != null && !ACCEPTED_GENERATION_SOURCES.includes(dto.generationSource)) {
            throw new BadRequestException(`generationSource debe ser INTERNAL, MANUAL o EXPLORADOR_SOLAR. Valor no implementado: ${dto.generationSource}.`);
        }
        if (dto.latitude != null && (typeof dto.latitude !== "number" || dto.latitude < -90 || dto.latitude > 90)) {
            throw new BadRequestException("latitude debe ser un número entre -90 y 90.");
        }
        if (dto.longitude != null && (typeof dto.longitude !== "number" || dto.longitude < -180 || dto.longitude > 180)) {
            throw new BadRequestException("longitude debe ser un número entre -180 y 180.");
        }
        if (dto.tiltDegrees != null && (typeof dto.tiltDegrees !== "number" || dto.tiltDegrees < 0 || dto.tiltDegrees > 90)) {
            throw new BadRequestException("tiltDegrees debe ser un número entre 0 y 90.");
        }
        if (dto.azimuthDegrees != null && (typeof dto.azimuthDegrees !== "number" || dto.azimuthDegrees < 0 || dto.azimuthDegrees > 360)) {
            throw new BadRequestException("azimuthDegrees debe ser un número entre 0 y 360.");
        }
        if (dto.mountingType != null && !MOUNTING_TYPE_VALUES.includes(dto.mountingType)) {
            throw new BadRequestException(`mountingType debe ser uno de: ${MOUNTING_TYPE_VALUES.join(", ")}.`);
        }
        if (dto.solarResourceMetadata != null && typeof dto.solarResourceMetadata !== "string") {
            throw new BadRequestException("solarResourceMetadata debe ser un string.");
        }
    }
    solarResourceDataFromDto(dto) {
        const data = {};
        if (dto.generationSource !== undefined)
            data.generationSource = dto.generationSource || GENERATION_SOURCE_INTERNAL;
        if (dto.solarResourceProvider !== undefined)
            data.solarResourceProvider = dto.solarResourceProvider ?? null;
        if (dto.latitude !== undefined)
            data.latitude = dto.latitude ?? null;
        if (dto.longitude !== undefined)
            data.longitude = dto.longitude ?? null;
        if (dto.mountingType !== undefined)
            data.mountingType = dto.mountingType ?? null;
        if (dto.tiltDegrees !== undefined)
            data.tiltDegrees = dto.tiltDegrees ?? null;
        if (dto.azimuthDegrees !== undefined)
            data.azimuthDegrees = dto.azimuthDegrees ?? null;
        if (dto.solarResourceRequestedAt !== undefined) {
            data.solarResourceRequestedAt = dto.solarResourceRequestedAt ? new Date(dto.solarResourceRequestedAt) : null;
        }
        if (dto.solarResourceMetadata !== undefined)
            data.solarResourceMetadata = dto.solarResourceMetadata ?? null;
        return data;
    }
    toResponse(row) {
        return {
            id: row.id,
            clientId: row.clientId,
            ownerId: row.ownerId,
            status: row.status,
            title: row.title,
            referenceMonth: row.referenceMonth,
            referenceBillAmount: row.referenceBillAmount,
            referenceConsumptionKwh: row.referenceConsumptionKwh,
            valorKwhConsumo: row.valorKwhConsumo,
            valorKwhInyeccion: row.valorKwhInyeccion,
            currency: row.currency,
            connectionType: row.connectionType,
            tipoProyecto: row.tipoProyecto,
            systemType: row.systemType,
            utilityGridAvailable: row.utilityGridAvailable,
            gridExportEnabled: row.gridExportEnabled,
            systemScenario: getSystemScenarioOrNull({
                systemType: row.systemType ?? "ON_GRID",
                utilityGridAvailable: row.utilityGridAvailable,
                gridExportEnabled: row.gridExportEnabled,
            }),
            potenciaSistemaKwp: row.potenciaSistemaKwp,
            potenciaPorPanelWp: row.potenciaPorPanelWp,
            coberturaDeseada: row.coberturaDeseada,
            hspDailyUsed: row.hspDailyUsed,
            performanceRatioUsed: row.performanceRatioUsed,
            calculationMethodVersion: row.calculationMethodVersion,
            cantidadPaneles: row.cantidadPaneles,
            generacionAnualKwh: row.generacionAnualKwh,
            ahorroAnual: row.ahorroAnual,
            porcentajeAhorro: row.porcentajeAhorro,
            pagoResidualAnual: row.pagoResidualAnual,
            generationSource: row.generationSource ?? "INTERNAL",
            solarResourceProvider: row.solarResourceProvider ?? null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            mountingType: row.mountingType ?? null,
            tiltDegrees: row.tiltDegrees ?? null,
            azimuthDegrees: row.azimuthDegrees ?? null,
            solarResourceRequestedAt: row.solarResourceRequestedAt?.toISOString() ?? null,
            solarResourceMetadata: row.solarResourceMetadata ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            client: row.client,
            owner: row.owner,
            months: row.months?.map((m) => ({
                id: m.id,
                monthIndex: m.monthIndex,
                consumptionKwh: m.consumptionKwh,
                consumptionValue: m.consumptionValue,
                generationKwh: m.generationKwh,
                generationValue: m.generationValue,
                savingsPercent: m.savingsPercent,
                estimatedPayment: m.estimatedPayment,
            })),
        };
    }
}

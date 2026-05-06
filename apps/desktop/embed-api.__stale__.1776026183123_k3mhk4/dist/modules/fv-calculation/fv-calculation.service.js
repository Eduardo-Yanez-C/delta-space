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
exports.FvCalculationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quotes/quote-access.helper");
const DEFAULT_HSP_DAILY = 5.5;
const DEFAULT_PR = 0.85;
const CALCULATION_METHOD_VERSION = "1.0";
function resolveConsumption(dto) {
    if (dto.consumoAnualKwh != null && dto.consumoAnualKwh > 0) {
        return {
            consumoAnualKwh: dto.consumoAnualKwh,
            consumoMensualKwh: dto.consumoAnualKwh / 12,
        };
    }
    const consumoMensualKwh = dto.consumoMensualKwh;
    return {
        consumoAnualKwh: consumoMensualKwh * 12,
        consumoMensualKwh,
    };
}
let FvCalculationService = class FvCalculationService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    calculate(dto, hspDaily = DEFAULT_HSP_DAILY, pr = DEFAULT_PR) {
        const { consumoAnualKwh, consumoMensualKwh } = resolveConsumption(dto);
        const cobertura = Math.min(100, Math.max(0, dto.coberturaDeseada)) / 100;
        const energiaACubrirKwh = consumoAnualKwh * cobertura;
        const generacionAnualPorKwp = hspDaily * 365 * pr;
        let plantaKwp;
        if (dto.potenciaObjetivoKwp != null && dto.potenciaObjetivoKwp > 0) {
            plantaKwp = dto.potenciaObjetivoKwp;
        }
        else {
            if (generacionAnualPorKwp <= 0) {
                throw new common_1.BadRequestException("Parámetros de generación inválidos");
            }
            plantaKwp = energiaACubrirKwh / generacionAnualPorKwp;
        }
        plantaKwp = Math.round(plantaKwp * 100) / 100;
        const potenciaPorPanelWp = dto.potenciaPorPanelWp > 0 ? dto.potenciaPorPanelWp : 400;
        const cantidadPaneles = Math.ceil((plantaKwp * 1000) / potenciaPorPanelWp);
        const potenciaRealKwp = (cantidadPaneles * potenciaPorPanelWp) / 1000;
        const generacionAnualKwh = potenciaRealKwp * hspDaily * 365 * pr;
        const generacionMensualKwh = generacionAnualKwh / 12;
        const autoconsumo = Math.min(generacionMensualKwh, consumoMensualKwh);
        const excedente = Math.max(0, generacionMensualKwh - consumoMensualKwh);
        const ahorroAutoconsumo = autoconsumo * dto.valorKwhConsumo;
        const ingresoInyeccion = excedente * dto.valorKwhInyeccion;
        const ahorroMensual = ahorroAutoconsumo + ingresoInyeccion;
        const ahorroAnual = ahorroMensual * 12;
        const cuentaMensual = dto.cuentaMensual >= 0 ? dto.cuentaMensual : 0;
        const pagoResidual = Math.max(0, cuentaMensual - ahorroMensual);
        const porcentajeAhorro = cuentaMensual > 0 ? (ahorroMensual / cuentaMensual) * 100 : 0;
        return {
            plantaKwp: Math.round(potenciaRealKwp * 100) / 100,
            cantidadPaneles,
            generacionAnualKwh: Math.round(generacionAnualKwh * 100) / 100,
            generacionMensualKwh: Math.round(generacionMensualKwh * 100) / 100,
            ahorroMensual: Math.round(ahorroMensual * 100) / 100,
            ahorroAnual: Math.round(ahorroAnual * 100) / 100,
            porcentajeAhorro: Math.round(porcentajeAhorro * 100) / 100,
            pagoResidual: Math.round(pagoResidual * 100) / 100,
            hspDailyUsed: hspDaily,
            performanceRatioUsed: pr,
            calculationMethodVersion: CALCULATION_METHOD_VERSION,
        };
    }
    async findByQuote(quoteId, versionId, currentUser) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true, ownerId: true, salespersonId: true },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (currentUser && !(0, quote_access_helper_1.canAccessQuote)(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (versionId) {
            const calc = await this.prisma.quoteFvCalculation.findFirst({
                where: { quoteId, quoteVersionId: versionId },
                orderBy: { createdAt: "desc" },
            });
            return calc ? this.toResponse(calc) : null;
        }
        const calc = await this.prisma.quoteFvCalculation.findFirst({
            where: { quoteId },
            orderBy: { createdAt: "desc" },
        });
        return calc ? this.toResponse(calc) : null;
    }
    async save(quoteId, dto, currentUser, quoteVersionId) {
        const quote = await this.prisma.quote.findUnique({
            where: { id: quoteId },
            select: { quoteKind: true, ownerId: true, salespersonId: true },
        });
        if (!quote) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (!(0, quote_access_helper_1.canAccessQuote)(currentUser, quote)) {
            throw new common_1.NotFoundException("Cotización no encontrada");
        }
        if (quoteVersionId) {
            const ver = await this.prisma.quoteVersion.findFirst({
                where: { id: quoteVersionId, quoteId },
            });
            if (!ver) {
                throw new common_1.BadRequestException("Versión no pertenece a esta cotización");
            }
        }
        const result = this.calculate(dto);
        const currency = dto.currency ?? "CLP";
        const { consumoAnualKwh, consumoMensualKwh } = resolveConsumption(dto);
        const created = await this.prisma.quoteFvCalculation.create({
            data: {
                quoteId,
                quoteVersionId: quoteVersionId ?? null,
                consumoMensualKwh,
                consumoAnualKwh,
                cuentaMensual: dto.cuentaMensual,
                valorKwhConsumo: dto.valorKwhConsumo,
                valorKwhInyeccion: dto.valorKwhInyeccion,
                coberturaDeseada: dto.coberturaDeseada,
                tipoProyecto: dto.tipoProyecto,
                potenciaObjetivoKwp: dto.potenciaObjetivoKwp ?? null,
                potenciaPorPanelWp: dto.potenciaPorPanelWp,
                currency,
                hspDailyUsed: result.hspDailyUsed,
                performanceRatioUsed: result.performanceRatioUsed,
                calculationMethodVersion: result.calculationMethodVersion,
                plantaKwp: result.plantaKwp,
                cantidadPaneles: result.cantidadPaneles,
                generacionAnualKwh: result.generacionAnualKwh,
                generacionMensualKwh: result.generacionMensualKwh,
                ahorroMensual: result.ahorroMensual,
                ahorroAnual: result.ahorroAnual,
                porcentajeAhorro: result.porcentajeAhorro,
                pagoResidual: result.pagoResidual,
                createdById: currentUser.id,
            },
        });
        return this.toResponse(created);
    }
    toResponse(row) {
        return {
            id: row.id,
            quoteId: row.quoteId,
            quoteVersionId: row.quoteVersionId,
            consumoMensualKwh: row.consumoMensualKwh,
            consumoAnualKwh: row.consumoAnualKwh,
            cuentaMensual: row.cuentaMensual,
            valorKwhConsumo: row.valorKwhConsumo,
            valorKwhInyeccion: row.valorKwhInyeccion,
            coberturaDeseada: row.coberturaDeseada,
            tipoProyecto: row.tipoProyecto,
            potenciaObjetivoKwp: row.potenciaObjetivoKwp,
            potenciaPorPanelWp: row.potenciaPorPanelWp,
            currency: row.currency,
            hspDailyUsed: row.hspDailyUsed,
            performanceRatioUsed: row.performanceRatioUsed,
            calculationMethodVersion: row.calculationMethodVersion,
            plantaKwp: row.plantaKwp,
            cantidadPaneles: row.cantidadPaneles,
            generacionAnualKwh: row.generacionAnualKwh,
            generacionMensualKwh: row.generacionMensualKwh,
            ahorroMensual: row.ahorroMensual,
            ahorroAnual: row.ahorroAnual,
            porcentajeAhorro: row.porcentajeAhorro,
            pagoResidual: row.pagoResidual,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
};
exports.FvCalculationService = FvCalculationService;
exports.FvCalculationService = FvCalculationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FvCalculationService);

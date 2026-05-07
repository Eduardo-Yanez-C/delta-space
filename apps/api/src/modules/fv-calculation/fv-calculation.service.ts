import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { canAccessQuote } from "../quotes/quote-access.helper";
import type { CreateFvCalculationDto } from "./dto/create-fv-calculation.dto";
import type { AuthUserPayload } from "../auth/auth.service";

const DEFAULT_HSP_DAILY = 5.5;
const DEFAULT_PR = 0.85;
const CALCULATION_METHOD_VERSION = "1.0";

function resolveConsumption(dto: CreateFvCalculationDto) {
  if (dto.consumoAnualKwh != null && dto.consumoAnualKwh > 0) {
    return {
      consumoAnualKwh: dto.consumoAnualKwh,
      consumoMensualKwh: dto.consumoAnualKwh / 12,
    };
  }
  const consumoMensualKwh = dto.consumoMensualKwh!;
  return {
    consumoAnualKwh: consumoMensualKwh * 12,
    consumoMensualKwh,
  };
}

@Injectable()
export class FvCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  calculate(
    dto: CreateFvCalculationDto,
    hspDaily = DEFAULT_HSP_DAILY,
    pr = DEFAULT_PR,
  ) {
    const { consumoAnualKwh, consumoMensualKwh } = resolveConsumption(dto);
    const cobertura = Math.min(100, Math.max(0, dto.coberturaDeseada!)) / 100;
    const energiaACubrirKwh = consumoAnualKwh * cobertura;
    const generacionAnualPorKwp = hspDaily * 365 * pr;
    let plantaKwp: number;
    if (dto.potenciaObjetivoKwp != null && dto.potenciaObjetivoKwp > 0) {
      plantaKwp = dto.potenciaObjetivoKwp;
    } else {
      if (generacionAnualPorKwp <= 0) {
        throw new BadRequestException("Parámetros de generación inválidos");
      }
      plantaKwp = energiaACubrirKwh / generacionAnualPorKwp;
    }
    plantaKwp = Math.round(plantaKwp * 100) / 100;
    const potenciaPorPanelWp =
      dto.potenciaPorPanelWp! > 0 ? dto.potenciaPorPanelWp! : 400;
    const cantidadPaneles = Math.ceil((plantaKwp * 1000) / potenciaPorPanelWp);
    const potenciaRealKwp = (cantidadPaneles * potenciaPorPanelWp) / 1000;
    const generacionAnualKwh = potenciaRealKwp * hspDaily * 365 * pr;
    const generacionMensualKwh = generacionAnualKwh / 12;
    const autoconsumo = Math.min(generacionMensualKwh, consumoMensualKwh);
    const excedente = Math.max(0, generacionMensualKwh - consumoMensualKwh);
    const ahorroAutoconsumo = autoconsumo * dto.valorKwhConsumo!;
    const ingresoInyeccion = excedente * dto.valorKwhInyeccion!;
    const ahorroMensual = ahorroAutoconsumo + ingresoInyeccion;
    const ahorroAnual = ahorroMensual * 12;
    const cuentaMensual = dto.cuentaMensual! >= 0 ? dto.cuentaMensual! : 0;
    const pagoResidual = Math.max(0, cuentaMensual - ahorroMensual);
    const porcentajeAhorro =
      cuentaMensual > 0 ? (ahorroMensual / cuentaMensual) * 100 : 0;
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

  async findByQuote(
    quoteId: string,
    versionId: string | undefined,
    currentUser: AuthUserPayload | undefined,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { quoteKind: true, ownerId: true, salespersonId: true, companyId: true },
    });
    if (!quote) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (currentUser && !canAccessQuote(currentUser, quote)) {
      throw new NotFoundException("Cotización no encontrada");
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

  async save(
    quoteId: string,
    dto: CreateFvCalculationDto,
    currentUser: AuthUserPayload,
    quoteVersionId: string | undefined,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { quoteKind: true, ownerId: true, salespersonId: true, companyId: true },
    });
    if (!quote) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (!canAccessQuote(currentUser, quote)) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (quoteVersionId) {
      const ver = await this.prisma.quoteVersion.findFirst({
        where: { id: quoteVersionId, quoteId },
      });
      if (!ver) {
        throw new BadRequestException("Versión no pertenece a esta cotización");
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
        cuentaMensual: dto.cuentaMensual!,
        valorKwhConsumo: dto.valorKwhConsumo!,
        valorKwhInyeccion: dto.valorKwhInyeccion!,
        coberturaDeseada: dto.coberturaDeseada!,
        tipoProyecto: dto.tipoProyecto!,
        potenciaObjetivoKwp: dto.potenciaObjetivoKwp ?? null,
        potenciaPorPanelWp: dto.potenciaPorPanelWp!,
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

  toResponse(row: {
    id: string;
    quoteId: string;
    quoteVersionId: string | null;
    consumoMensualKwh: number;
    consumoAnualKwh: number | null;
    cuentaMensual: number;
    valorKwhConsumo: number;
    valorKwhInyeccion: number;
    coberturaDeseada: number;
    tipoProyecto: string;
    potenciaObjetivoKwp: number | null;
    potenciaPorPanelWp: number;
    currency: string;
    hspDailyUsed: number;
    performanceRatioUsed: number;
    calculationMethodVersion: string;
    plantaKwp: number;
    cantidadPaneles: number;
    generacionAnualKwh: number;
    generacionMensualKwh: number;
    ahorroMensual: number;
    ahorroAnual: number;
    porcentajeAhorro: number;
    pagoResidual: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
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
}

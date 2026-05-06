import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateTransportCommercialTariffDto } from "./dto/create-transport-commercial-tariff.dto";
import { UpdateTransportCommercialTariffDto } from "./dto/update-transport-commercial-tariff.dto";
import { UpsertTransportGroupCommercialDto } from "./dto/upsert-transport-group-commercial.dto";
import { transportCommercialGroupKey } from "./transport-commercial-group-key";

function normStr(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t || null;
}

@Injectable()
export class TransportCommercialService {
  constructor(private readonly prisma: PrismaService) {}

  async listTariffs(filters: { projectId?: string | null; supplierId?: string | null }) {
    const projectId = filters.projectId?.trim() || null;
    const supplierId = filters.supplierId?.trim() || null;
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (supplierId) where.supplierId = supplierId;
    return this.prisma.transportCommercialTariff.findMany({
      where,
      orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
      include: {
        project: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  async createTariff(dto: CreateTransportCommercialTariffDto) {
    const projectId = normStr(dto.projectId);
    const supplierId = normStr(dto.supplierId);
    const currency = (dto.currency ?? "CLP").trim() || "CLP";
    return this.prisma.transportCommercialTariff.create({
      data: {
        projectId,
        supplierId,
        label: dto.label.trim(),
        originHint: normStr(dto.originHint),
        destinationHint: normStr(dto.destinationHint),
        baseAmount: dto.baseAmount,
        currency,
        fuelAdjustmentPercent:
          dto.fuelAdjustmentPercent === undefined || dto.fuelAdjustmentPercent === null
            ? null
            : dto.fuelAdjustmentPercent,
        notes: normStr(dto.notes),
        active: dto.active !== false,
      },
      include: {
        project: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  async updateTariff(id: string, dto: UpdateTransportCommercialTariffDto) {
    const existing = await this.prisma.transportCommercialTariff.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Plantilla no encontrada.");
    const data: Record<string, unknown> = {};
    if (dto.projectId !== undefined) data.projectId = normStr(dto.projectId);
    if (dto.supplierId !== undefined) data.supplierId = normStr(dto.supplierId);
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.originHint !== undefined) data.originHint = normStr(dto.originHint);
    if (dto.destinationHint !== undefined)
      data.destinationHint = normStr(dto.destinationHint);
    if (dto.baseAmount !== undefined) data.baseAmount = dto.baseAmount;
    if (dto.currency !== undefined)
      data.currency = (dto.currency ?? "CLP").trim() || "CLP";
    if (dto.fuelAdjustmentPercent !== undefined)
      data.fuelAdjustmentPercent = dto.fuelAdjustmentPercent;
    if (dto.notes !== undefined) data.notes = normStr(dto.notes);
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.transportCommercialTariff.update({
      where: { id },
      data: data as never,
      include: {
        project: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    });
  }

  async deleteTariff(id: string) {
    const existing = await this.prisma.transportCommercialTariff.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException("Plantilla no encontrada.");
    await this.prisma.transportCommercialTariff.delete({ where: { id } });
    return { ok: true as const };
  }

  async dealsForGroupKeys(groupKeys: string[]) {
    const uniq = [...new Set(groupKeys.map((k) => k.trim()).filter(Boolean))];
    if (!uniq.length) return [];
    return this.prisma.transportGroupCommercial.findMany({
      where: { groupKey: { in: uniq } },
      include: {
        tariff: {
          include: {
            project: { select: { id: true, code: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
        contractVersion: {
          include: {
            contract: {
              select: { id: true, title: true, supplierId: true, projectId: true },
            },
          },
        },
      },
    });
  }

  async getDealByGroupKey(groupKey: string) {
    const gk = groupKey.trim();
    if (!gk) throw new BadRequestException("groupKey requerido.");
    return this.prisma.transportGroupCommercial.findUnique({
      where: { groupKey: gk },
      include: {
        tariff: {
          include: {
            project: { select: { id: true, code: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
        contractVersion: {
          include: {
            contract: {
              select: { id: true, title: true, supplierId: true, projectId: true },
            },
          },
        },
      },
    });
  }

  async upsertDeal(dto: UpsertTransportGroupCommercialDto) {
    const projectId = dto.projectId.trim();
    if (!projectId) throw new BadRequestException("projectId inválido.");
    const palletId = normStr(dto.palletId);
    const expected = transportCommercialGroupKey(projectId, palletId);
    if (dto.groupKey.trim() !== expected) {
      throw new BadRequestException(
        `groupKey no coincide con proyecto y pallet (esperado: ${expected}).`,
      );
    }
    const proj = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!proj) throw new BadRequestException("Proyecto no existe.");

    const linkingTouched = dto.contractVersionId !== undefined || dto.tariffId !== undefined;
    let tariffId: string | null = null;
    let contractVersionId: string | null = null;
    let templateBaseSnapshot: number | null = null;

    if (linkingTouched) {
      const cvId = normStr(dto.contractVersionId);
      const tfId = normStr(dto.tariffId);
      if (cvId) {
        const cv = await this.prisma.transportContractVersion.findUnique({
          where: { id: cvId },
          include: { contract: true, items: true, overrides: true },
        });
        if (!cv) throw new BadRequestException("Versión de contrato no encontrada.");
        if (cv.status !== "PUBLISHED") {
          throw new BadRequestException("La versión del contrato debe estar publicada.");
        }
        if (cv.contract.projectId && cv.contract.projectId !== projectId) {
          throw new BadRequestException("El contrato está asociado a otro proyecto.");
        }
        contractVersionId = cvId;
        tariffId = null;
        const itemSum = cv.items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
        const additionSum = (cv.overrides ?? [])
          .filter((o) => (o.action ?? "").toUpperCase() === "ADDITION")
          .reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
        templateBaseSnapshot = itemSum + additionSum;
      } else if (tfId) {
        const t = await this.prisma.transportCommercialTariff.findFirst({
          where: { id: tfId, active: true },
        });
        if (!t) throw new BadRequestException("Plantilla no encontrada o inactiva.");
        tariffId = tfId;
        contractVersionId = null;
        templateBaseSnapshot = t.baseAmount;
      } else {
        tariffId = null;
        contractVersionId = null;
        templateBaseSnapshot = null;
      }
    } else {
      const prev = await this.prisma.transportGroupCommercial.findUnique({
        where: { groupKey: expected },
        select: { tariffId: true, contractVersionId: true, templateBaseSnapshot: true },
      });
      if (prev) {
        tariffId = prev.tariffId;
        contractVersionId = prev.contractVersionId;
        templateBaseSnapshot = prev.templateBaseSnapshot;
      }
    }

    const currency = (dto.currency ?? "CLP").trim() || "CLP";
    const commercialStatus = (dto.commercialStatus ?? "DRAFT").trim() || "DRAFT";
    const fuel =
      dto.fuelSurchargePercent === undefined ? null : dto.fuelSurchargePercent;
    const agreed =
      dto.agreedAmount === undefined || dto.agreedAmount === null
        ? null
        : dto.agreedAmount;
    const manualPrice = dto.manualPrice === true;
    const notes = normStr(dto.commercialNotes);

    return this.prisma.transportGroupCommercial.upsert({
      where: { groupKey: expected },
      create: {
        groupKey: expected,
        projectId,
        palletId,
        tariffId,
        contractVersionId,
        templateBaseSnapshot,
        fuelSurchargePercent: fuel,
        agreedAmount: agreed,
        currency,
        manualPrice,
        commercialNotes: notes,
        commercialStatus,
      },
      update: {
        projectId,
        palletId,
        tariffId,
        contractVersionId,
        templateBaseSnapshot,
        fuelSurchargePercent: fuel,
        agreedAmount: agreed,
        currency,
        manualPrice,
        commercialNotes: notes,
        commercialStatus,
      },
      include: {
        tariff: {
          include: {
            project: { select: { id: true, code: true, name: true } },
            supplier: { select: { id: true, name: true } },
          },
        },
        contractVersion: {
          include: {
            contract: {
              select: { id: true, title: true, supplierId: true, projectId: true },
            },
          },
        },
      },
    });
  }
}

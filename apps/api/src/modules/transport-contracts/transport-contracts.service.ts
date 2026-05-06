import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateTransportContractDto } from "./dto/create-transport-contract.dto";
import { CreateTransportContractVersionDto } from "./dto/create-transport-contract-version.dto";
import { CreateTransportTariffItemDto } from "./dto/create-transport-tariff-item.dto";
import { CreateTransportTariffOverrideDto } from "./dto/create-transport-tariff-override.dto";
import { UpdateTransportContractDto } from "./dto/update-transport-contract.dto";
import { UpdateTransportContractVersionDto } from "./dto/update-transport-contract-version.dto";
import { UpdateTransportTariffItemDto } from "./dto/update-transport-tariff-item.dto";
import { UpdateTransportTariffOverrideDto } from "./dto/update-transport-tariff-override.dto";

const UNITS = new Set([
  "TRIP",
  "CONTAINER",
  "DAY",
  "HOUR",
  "KM",
  "FIXED",
  "UF_PER_TON_MONTH",
  "PCT",
  "OTHER",
]);
const TAX_MODES = new Set(["NONE", "VAT_EXTRA", "VAT_INCLUDED"]);
const OVERRIDE_ACTIONS = new Set(["ADDITION", "REPLACE_BASE", "SUPPRESS_BASE"]);

function normStr(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t || null;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new BadRequestException("Fecha inválida.");
  return d;
}

@Injectable()
export class TransportContractsService {
  constructor(private readonly prisma: PrismaService) {}

  private assertUnit(u: string) {
    const x = u.trim().toUpperCase();
    if (!UNITS.has(x)) throw new BadRequestException(`Unidad no válida: ${u}. Use: ${[...UNITS].join(", ")}`);
    return x;
  }

  private assertTax(m: string) {
    const x = m.trim().toUpperCase();
    if (!TAX_MODES.has(x)) throw new BadRequestException(`taxMode no válido: ${m}`);
    return x;
  }

  private assertOverrideAction(a: string) {
    const x = a.trim().toUpperCase();
    if (!OVERRIDE_ACTIONS.has(x)) {
      throw new BadRequestException(`action de excepción no válida: ${a}. Use: ${[...OVERRIDE_ACTIONS].join(", ")}`);
    }
    return x;
  }

  async listContracts(filters: { projectId?: string | null; supplierId?: string | null; active?: boolean }) {
    const where: Prisma.TransportContractWhereInput = {};
    if (filters.projectId?.trim()) where.projectId = filters.projectId.trim();
    if (filters.supplierId?.trim()) where.supplierId = filters.supplierId.trim();
    if (filters.active !== undefined) where.active = filters.active;
    return this.prisma.transportContract.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        supplier: { select: { id: true, name: true, actorType: true } },
        project: { select: { id: true, code: true, name: true } },
        transportVariableProfile: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 5,
          select: {
            id: true,
            versionNumber: true,
            status: true,
            label: true,
            publishedAt: true,
            effectiveFrom: true,
            effectiveTo: true,
            _count: { select: { items: true, overrides: true } },
          },
        },
      },
    });
  }

  async getContract(id: string) {
    const c = await this.prisma.transportContract.findUnique({
      where: { id },
      include: {
        supplier: { select: { id: true, name: true, taxId: true, actorType: true } },
        project: { select: { id: true, code: true, name: true } },
        transportVariableProfile: { select: { id: true, name: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: {
            items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            overrides: {
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
              include: { baseItem: { select: { id: true, label: true, code: true } } },
            },
            _count: { select: { deals: true } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException("Contrato no encontrado.");
    return c;
  }

  async createContract(dto: CreateTransportContractDto) {
    const supplierId = dto.supplierId.trim();
    const sup = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!sup) throw new BadRequestException("Proveedor no existe.");
    if (sup.actorType !== "TRANSPORTISTA") {
      throw new BadRequestException("El proveedor debe ser de tipo TRANSPORTISTA.");
    }
    const projectId = normStr(dto.projectId);
    if (projectId) {
      const p = await this.prisma.project.findUnique({ where: { id: projectId } });
      if (!p) throw new BadRequestException("Proyecto no existe.");
    }
    const currency = (dto.defaultCurrency ?? "CLP").trim() || "CLP";
    const vat = dto.defaultVatPercent ?? 19;
    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.transportContract.create({
        data: {
          supplierId,
          projectId,
          title: dto.title.trim(),
          contractNumber: normStr(dto.contractNumber),
          clientLegalName: normStr(dto.clientLegalName),
          contractorLegalName: normStr(dto.contractorLegalName),
          signedAt: parseDate(dto.signedAt ?? null),
          paymentTerms: normStr(dto.paymentTerms),
          jurisdiction: normStr(dto.jurisdiction),
          defaultCurrency: currency,
          defaultVatPercent: vat,
          notes: normStr(dto.notes),
          active: dto.active !== false,
        },
      });
      await tx.transportContractVersion.create({
        data: {
          contractId: contract.id,
          versionNumber: 1,
          status: "DRAFT",
          label: "Versión 1",
        },
      });
      return this.getContract(contract.id);
    });
  }

  async updateContract(id: string, dto: UpdateTransportContractDto) {
    const existing = await this.prisma.transportContract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contrato no encontrado.");
    if (dto.supplierId !== undefined) {
      const sid = dto.supplierId.trim();
      const sup = await this.prisma.supplier.findUnique({ where: { id: sid } });
      if (!sup) throw new BadRequestException("Proveedor no existe.");
      if (sup.actorType !== "TRANSPORTISTA") {
        throw new BadRequestException("El proveedor debe ser de tipo TRANSPORTISTA.");
      }
    }
    if (dto.projectId !== undefined && dto.projectId) {
      const p = await this.prisma.project.findUnique({ where: { id: dto.projectId.trim() } });
      if (!p) throw new BadRequestException("Proyecto no existe.");
    }
    const data: Record<string, unknown> = {};
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId.trim();
    if (dto.projectId !== undefined) data.projectId = normStr(dto.projectId);
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.contractNumber !== undefined) data.contractNumber = normStr(dto.contractNumber);
    if (dto.clientLegalName !== undefined) data.clientLegalName = normStr(dto.clientLegalName);
    if (dto.contractorLegalName !== undefined) data.contractorLegalName = normStr(dto.contractorLegalName);
    if (dto.signedAt !== undefined) data.signedAt = parseDate(dto.signedAt ?? null);
    if (dto.paymentTerms !== undefined) data.paymentTerms = normStr(dto.paymentTerms);
    if (dto.jurisdiction !== undefined) data.jurisdiction = normStr(dto.jurisdiction);
    if (dto.defaultCurrency !== undefined) data.defaultCurrency = (dto.defaultCurrency ?? "CLP").trim() || "CLP";
    if (dto.defaultVatPercent !== undefined) data.defaultVatPercent = dto.defaultVatPercent;
    if (dto.notes !== undefined) data.notes = normStr(dto.notes);
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.transportVariableProfileId !== undefined) {
      const pid = normStr(dto.transportVariableProfileId);
      if (pid) {
        const p = await this.prisma.transportVariableProfile.count({ where: { id: pid } });
        if (!p) throw new BadRequestException("Perfil de variables no existe.");
      }
      data.transportVariableProfileId = pid;
    }
    await this.prisma.transportContract.update({ where: { id }, data: data as never });
    return this.getContract(id);
  }

  async deleteContract(id: string) {
    const existing = await this.prisma.transportContract.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException("Contrato no encontrado.");
    await this.prisma.transportContract.update({ where: { id }, data: { active: false } });
    return { ok: true as const };
  }

  private async getVersionInContract(contractId: string, versionId: string) {
    const v = await this.prisma.transportContractVersion.findFirst({
      where: { id: versionId, contractId },
    });
    if (!v) throw new NotFoundException("Versión no encontrada en este contrato.");
    return v;
  }

  async createVersion(contractId: string, dto: CreateTransportContractVersionDto) {
    await this.getContract(contractId);
    const agg = await this.prisma.transportContractVersion.aggregate({
      where: { contractId },
      _max: { versionNumber: true },
    });
    const nextN = (agg._max.versionNumber ?? 0) + 1;
    const copyFrom = normStr(dto.copyFromVersionId);
    let sourceItems: {
      code: string | null;
      label: string;
      unit: string;
      amount: number;
      currency: string;
      taxMode: string;
      legalRef: string | null;
      sortOrder: number;
      notes: string | null;
      activeFrom: Date | null;
      activeTo: Date | null;
    }[] = [];
    type SrcOverride = {
      action: string;
      label: string;
      amount: number;
      currency: string;
      unit: string;
      taxMode: string;
      legalRef: string | null;
      reason: string;
      documentRef: string | null;
      validFrom: Date;
      validTo: Date | null;
      sortOrder: number;
      notes: string | null;
      baseTariffItemId: string | null;
    };
    let sourceOverrides: SrcOverride[] = [];
    let oldItemIdsOrdered: string[] = [];

    if (copyFrom) {
      const src = await this.prisma.transportContractVersion.findFirst({
        where: { id: copyFrom, contractId },
        include: {
          items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          overrides: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        },
      });
      if (!src) throw new BadRequestException("La versión origen no pertenece a este contrato.");
      sourceItems = src.items.map((it) => ({
        code: it.code,
        label: it.label,
        unit: it.unit,
        amount: it.amount,
        currency: it.currency,
        taxMode: it.taxMode,
        legalRef: it.legalRef,
        sortOrder: it.sortOrder,
        notes: it.notes,
        activeFrom: it.activeFrom,
        activeTo: it.activeTo,
      }));
      oldItemIdsOrdered = src.items.map((it) => it.id);
      sourceOverrides = src.overrides.map((o) => ({
        action: o.action,
        label: o.label,
        amount: o.amount,
        currency: o.currency,
        unit: o.unit,
        taxMode: o.taxMode,
        legalRef: o.legalRef,
        reason: o.reason,
        documentRef: o.documentRef,
        validFrom: o.validFrom,
        validTo: o.validTo,
        sortOrder: o.sortOrder,
        notes: o.notes,
        baseTariffItemId: o.baseTariffItemId,
      }));
    }
    const created = await this.prisma.transportContractVersion.create({
      data: {
        contractId,
        versionNumber: nextN,
        status: "DRAFT",
        label: normStr(dto.label),
        effectiveFrom: parseDate(dto.effectiveFrom ?? null),
        effectiveTo: parseDate(dto.effectiveTo ?? null),
        notes: normStr(dto.notes),
        items:
          sourceItems.length > 0
            ? {
                create: sourceItems.map((it) => ({
                  code: it.code,
                  label: it.label,
                  unit: it.unit,
                  amount: it.amount,
                  currency: it.currency,
                  taxMode: it.taxMode,
                  legalRef: it.legalRef,
                  sortOrder: it.sortOrder,
                  notes: it.notes,
                  activeFrom: it.activeFrom,
                  activeTo: it.activeTo,
                })),
              }
            : undefined,
      },
    });

    if (copyFrom && sourceOverrides.length > 0 && oldItemIdsOrdered.length > 0) {
      const newItems = await this.prisma.transportTariffItem.findMany({
        where: { contractVersionId: created.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true },
      });
      if (newItems.length === oldItemIdsOrdered.length) {
        const idMap = new Map<string, string>();
        for (let i = 0; i < oldItemIdsOrdered.length; i++) {
          idMap.set(oldItemIdsOrdered[i]!, newItems[i]!.id);
        }
        for (const o of sourceOverrides) {
          const mappedBase = o.baseTariffItemId ? idMap.get(o.baseTariffItemId) ?? null : null;
          await this.prisma.transportTariffOverride.create({
            data: {
              contractVersionId: created.id,
              baseTariffItemId: mappedBase,
              action: o.action,
              label: o.label,
              amount: o.amount,
              currency: o.currency,
              unit: o.unit,
              taxMode: o.taxMode,
              legalRef: o.legalRef,
              reason: o.reason,
              documentRef: o.documentRef,
              validFrom: o.validFrom,
              validTo: o.validTo,
              sortOrder: o.sortOrder,
              notes: o.notes,
            },
          });
        }
      }
    }

    return this.getContractVersion(contractId, created.id);
  }

  async getContractVersion(contractId: string, versionId: string) {
    await this.getContract(contractId);
    const v = await this.prisma.transportContractVersion.findFirst({
      where: { id: versionId, contractId },
      include: {
        items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        overrides: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { baseItem: { select: { id: true, label: true, code: true } } },
        },
        _count: { select: { deals: true } },
      },
    });
    if (!v) throw new NotFoundException("Versión no encontrada.");
    return v;
  }

  async updateVersion(contractId: string, versionId: string, dto: UpdateTransportContractVersionDto) {
    const v = await this.getVersionInContract(contractId, versionId);
    if (v.status !== "DRAFT") throw new ForbiddenException("Solo se editan versiones en borrador.");
    await this.prisma.transportContractVersion.update({
      where: { id: versionId },
      data: {
        label: dto.label !== undefined ? normStr(dto.label) : undefined,
        effectiveFrom: dto.effectiveFrom !== undefined ? parseDate(dto.effectiveFrom ?? null) : undefined,
        effectiveTo: dto.effectiveTo !== undefined ? parseDate(dto.effectiveTo ?? null) : undefined,
        notes: dto.notes !== undefined ? normStr(dto.notes) : undefined,
      },
    });
    return this.getContractVersion(contractId, versionId);
  }

  async publishVersion(contractId: string, versionId: string) {
    const v = await this.getVersionInContract(contractId, versionId);
    if (v.status !== "DRAFT") throw new BadRequestException("Solo se publica una versión en borrador.");
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.transportContractVersion.updateMany({
        where: { contractId, status: "PUBLISHED" },
        data: { status: "ARCHIVED", effectiveTo: now },
      }),
      this.prisma.transportContractVersion.update({
        where: { id: versionId },
        data: { status: "PUBLISHED", publishedAt: now, effectiveFrom: v.effectiveFrom ?? now },
      }),
    ]);
    return this.getContractVersion(contractId, versionId);
  }

  async createTariffItem(contractId: string, versionId: string, dto: CreateTransportTariffItemDto) {
    const v = await this.getVersionInContract(contractId, versionId);
    if (v.status !== "DRAFT") throw new ForbiddenException("Solo se agregan ítems a versiones en borrador.");
    const unit = this.assertUnit(dto.unit);
    const taxMode = this.assertTax(dto.taxMode);
    const currency = (dto.currency ?? "CLP").trim() || "CLP";
    return this.prisma.transportTariffItem.create({
      data: {
        contractVersionId: versionId,
        code: normStr(dto.code),
        label: dto.label.trim(),
        unit,
        amount: dto.amount,
        currency,
        taxMode,
        legalRef: normStr(dto.legalRef),
        sortOrder: dto.sortOrder ?? 0,
        notes: normStr(dto.notes),
        activeFrom: dto.activeFrom !== undefined ? parseDate(dto.activeFrom ?? null) : undefined,
        activeTo: dto.activeTo !== undefined ? parseDate(dto.activeTo ?? null) : undefined,
      },
    });
  }

  async updateTariffItem(contractId: string, versionId: string, itemId: string, dto: UpdateTransportTariffItemDto) {
    await this.getVersionInContract(contractId, versionId);
    const item = await this.prisma.transportTariffItem.findFirst({
      where: { id: itemId, contractVersionId: versionId },
    });
    if (!item) throw new NotFoundException("Ítem no encontrado.");
    const ver = await this.prisma.transportContractVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.status !== "DRAFT") throw new ForbiddenException("Solo se editan ítems en borrador.");
    const data: Record<string, unknown> = {};
    if (dto.code !== undefined) data.code = normStr(dto.code);
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.unit !== undefined) data.unit = this.assertUnit(dto.unit);
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.currency !== undefined) data.currency = (dto.currency ?? "CLP").trim() || "CLP";
    if (dto.taxMode !== undefined) data.taxMode = this.assertTax(dto.taxMode);
    if (dto.legalRef !== undefined) data.legalRef = normStr(dto.legalRef);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.notes !== undefined) data.notes = normStr(dto.notes);
    if (dto.activeFrom !== undefined) data.activeFrom = parseDate(dto.activeFrom ?? null);
    if (dto.activeTo !== undefined) data.activeTo = parseDate(dto.activeTo ?? null);
    return this.prisma.transportTariffItem.update({
      where: { id: itemId },
      data: data as never,
    });
  }

  async deleteTariffItem(contractId: string, versionId: string, itemId: string) {
    await this.getVersionInContract(contractId, versionId);
    const ver = await this.prisma.transportContractVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.status !== "DRAFT") throw new ForbiddenException("Solo se eliminan ítems en borrador.");
    const item = await this.prisma.transportTariffItem.findFirst({
      where: { id: itemId, contractVersionId: versionId },
    });
    if (!item) throw new NotFoundException("Ítem no encontrado.");
    await this.prisma.transportTariffItem.delete({ where: { id: itemId } });
    return { ok: true as const };
  }

  async createTariffOverride(contractId: string, versionId: string, dto: CreateTransportTariffOverrideDto) {
    const v = await this.getVersionInContract(contractId, versionId);
    if (v.status !== "DRAFT") throw new ForbiddenException("Solo se agregan excepciones en borrador.");
    const action = this.assertOverrideAction(dto.action ?? "ADDITION");
    const unit = this.assertUnit(dto.unit);
    const taxMode = this.assertTax(dto.taxMode);
    const currency = (dto.currency ?? "CLP").trim() || "CLP";
    const vf = parseDate(dto.validFrom);
    if (!vf) throw new BadRequestException("validFrom es obligatorio.");
    const baseId = normStr(dto.baseTariffItemId);
    if (baseId) {
      const bi = await this.prisma.transportTariffItem.findFirst({
        where: { id: baseId, contractVersionId: versionId },
      });
      if (!bi) throw new BadRequestException("La línea base no pertenece a esta versión.");
    }
    return this.prisma.transportTariffOverride.create({
      data: {
        contractVersionId: versionId,
        baseTariffItemId: baseId,
        action,
        label: dto.label.trim(),
        amount: dto.amount,
        currency,
        unit,
        taxMode,
        legalRef: normStr(dto.legalRef),
        reason: dto.reason.trim(),
        documentRef: normStr(dto.documentRef),
        validFrom: vf,
        validTo: parseDate(dto.validTo ?? null),
        sortOrder: dto.sortOrder ?? 0,
        notes: normStr(dto.notes),
      },
      include: { baseItem: { select: { id: true, label: true, code: true } } },
    });
  }

  async updateTariffOverride(
    contractId: string,
    versionId: string,
    overrideId: string,
    dto: UpdateTransportTariffOverrideDto,
  ) {
    await this.getVersionInContract(contractId, versionId);
    const ver = await this.prisma.transportContractVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.status !== "DRAFT") throw new ForbiddenException("Solo se editan excepciones en borrador.");
    const row = await this.prisma.transportTariffOverride.findFirst({
      where: { id: overrideId, contractVersionId: versionId },
    });
    if (!row) throw new NotFoundException("Excepción no encontrada.");
    if (dto.baseTariffItemId !== undefined) {
      const baseId = normStr(dto.baseTariffItemId);
      if (baseId) {
        const bi = await this.prisma.transportTariffItem.findFirst({
          where: { id: baseId, contractVersionId: versionId },
        });
        if (!bi) throw new BadRequestException("La línea base no pertenece a esta versión.");
      }
    }
    const data: Record<string, unknown> = {};
    if (dto.action !== undefined) data.action = this.assertOverrideAction(dto.action);
    if (dto.label !== undefined) data.label = dto.label.trim();
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.currency !== undefined) data.currency = (dto.currency ?? "CLP").trim() || "CLP";
    if (dto.unit !== undefined) data.unit = this.assertUnit(dto.unit);
    if (dto.taxMode !== undefined) data.taxMode = this.assertTax(dto.taxMode);
    if (dto.legalRef !== undefined) data.legalRef = normStr(dto.legalRef);
    if (dto.reason !== undefined) data.reason = dto.reason.trim();
    if (dto.documentRef !== undefined) data.documentRef = normStr(dto.documentRef);
    if (dto.validFrom !== undefined) {
      const d = parseDate(dto.validFrom);
      if (!d) throw new BadRequestException("validFrom inválido.");
      data.validFrom = d;
    }
    if (dto.validTo !== undefined) data.validTo = parseDate(dto.validTo ?? null);
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;
    if (dto.notes !== undefined) data.notes = normStr(dto.notes);
    if (dto.baseTariffItemId !== undefined) data.baseTariffItemId = normStr(dto.baseTariffItemId);
    return this.prisma.transportTariffOverride.update({
      where: { id: overrideId },
      data: data as never,
      include: { baseItem: { select: { id: true, label: true, code: true } } },
    });
  }

  async deleteTariffOverride(contractId: string, versionId: string, overrideId: string) {
    await this.getVersionInContract(contractId, versionId);
    const ver = await this.prisma.transportContractVersion.findUnique({ where: { id: versionId } });
    if (!ver || ver.status !== "DRAFT") throw new ForbiddenException("Solo se eliminan excepciones en borrador.");
    const row = await this.prisma.transportTariffOverride.findFirst({
      where: { id: overrideId, contractVersionId: versionId },
    });
    if (!row) throw new NotFoundException("Excepción no encontrada.");
    await this.prisma.transportTariffOverride.delete({ where: { id: overrideId } });
    return { ok: true as const };
  }

  /** Versiones publicadas aplicables a un proyecto + transportista (para selectores en UI). */
  async listPublishedVersionsForContext(filters: { projectId?: string | null; supplierId?: string | null }) {
    const pid = filters.projectId?.trim() || null;
    const sid = filters.supplierId?.trim() || null;
    const contractWhere: Prisma.TransportContractWhereInput = {
      active: true,
      ...(sid ? { supplierId: sid } : {}),
      ...(pid ? { OR: [{ projectId: pid }, { projectId: null }] } : {}),
    };
    const versions = await this.prisma.transportContractVersion.findMany({
      where: {
        status: "PUBLISHED",
        contract: contractWhere,
      },
      orderBy: [{ contractId: "asc" }, { versionNumber: "desc" }],
      include: {
        contract: {
          select: {
            id: true,
            title: true,
            projectId: true,
            supplierId: true,
            supplier: { select: { id: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
          },
        },
        items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        overrides: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          include: { baseItem: { select: { id: true, label: true, code: true } } },
        },
      },
    });
    return versions;
  }
}

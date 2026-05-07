// @ts-nocheck — alineado con dist (Decimal / includes).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hasGlobalAdminPrivileges } from "../auth/role-constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import {
  canAccessQuote,
  quoteVisibilityWhereForUser,
} from "./quote-access.helper";
import * as cnCommercial from "./commercial-number";
import {
  isQuoteTerminalArchivedOrCancelled,
  normalizeQuoteCommercialStatus,
  QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST,
} from "./commercial-status";
import {
  mapQuoteResponse,
  serializeTechnicalBasicsJson,
} from "./quote-response.mapper";
import type { CreateQuoteDto } from "./dto/create-quote.dto";
import type { UpdateQuoteDto } from "./dto/update-quote.dto";
import type { FilterQuotesDto } from "./dto/filter-quotes.dto";
import type { AuthUserPayload } from "../auth/auth.service";

function formatCurrentVersion(v: {
  id: string;
  versionNumber: number;
  status: string;
  total: unknown;
  createdAt: Date;
  createdBy?: { id: string; name: string | null; email: string } | null;
} | null) {
  if (!v) return null;
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    status: v.status,
    total:
      typeof v.total === "object" && v.total !== null && "toNumber" in v.total
        ? (v.total as { toNumber: () => number }).toNumber()
        : Number(v.total),
    createdAt: v.createdAt,
    createdBy: v.createdBy
      ? { id: v.createdBy.id, name: v.createdBy.name, email: v.createdBy.email }
      : undefined,
  };
}

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveSellerForIndustrialInitials(
    dto: CreateQuoteDto,
    currentUser: AuthUserPayload,
  ) {
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

  async findAll(filters: FilterQuotesDto, currentUser: AuthUserPayload) {
    let where: Record<string, unknown> = {};
    const includeInactive =
      filters.includeInactive === true || filters.includeInactive === "true";
    if (filters.status) {
      where.status = filters.status;
    } else if (!includeInactive) {
      where.status = { notIn: [...QUOTE_STATUSES_HIDDEN_FROM_DEFAULT_LIST] };
    }
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.sourceFvStudyId?.trim()) {
      where.sourceFvStudyId = filters.sourceFvStudyId.trim();
    }
    if (filters.search?.trim()) {
      where.title = { contains: filters.search.trim() };
    }
    if (filters.updatedAfter) {
      const d = new Date(filters.updatedAfter);
      if (!Number.isNaN(d.getTime())) where.updatedAt = { gte: d };
    }
    const roles = currentUser?.roles ?? [];
    if (roles.length > 0 && !hasGlobalAdminPrivileges(roles)) {
      const visibility = quoteVisibilityWhereForUser(currentUser.id, currentUser.companyId);
      where =
        Object.keys(where).length > 0 ? { AND: [where, visibility] } : visibility;
    } else if (currentUser?.companyId) {
      // Admin global: por defecto ve todo (sin filtro). Si más adelante quieres “scope por empresa” en UI, se agrega aquí.
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
        ...mapQuoteResponse(rest),
        currentVersion: formatCurrentVersion(latest),
      };
    });
  }

  async findOne(id: string, currentUser: AuthUserPayload) {
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
      throw new NotFoundException(`Cotización con id ${id} no encontrada`);
    }
    if (!canAccessQuote(currentUser, quote)) {
      throw new NotFoundException(`Cotización con id ${id} no encontrada`);
    }
    const latest =
      quote.versions.length > 0
        ? quote.versions[quote.versions.length - 1]
        : null;
    const { versions: versionRows, ...quoteRest } = quote;
    return {
      ...mapQuoteResponse(quoteRest),
      currentVersion: formatCurrentVersion(latest),
      versions: versionRows.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        status: v.status,
        subtotal:
          typeof v.subtotal === "object" &&
          v.subtotal !== null &&
          "toNumber" in v.subtotal
            ? (v.subtotal as { toNumber: () => number }).toNumber()
            : Number(v.subtotal),
        discountsTotal:
          typeof v.discountsTotal === "object" &&
          v.discountsTotal !== null &&
          "toNumber" in v.discountsTotal
            ? (v.discountsTotal as { toNumber: () => number }).toNumber()
            : Number(v.discountsTotal),
        taxesTotal:
          typeof v.taxesTotal === "object" &&
          v.taxesTotal !== null &&
          "toNumber" in v.taxesTotal
            ? (v.taxesTotal as { toNumber: () => number }).toNumber()
            : Number(v.taxesTotal),
        total:
          typeof v.total === "object" && v.total !== null && "toNumber" in v.total
            ? (v.total as { toNumber: () => number }).toNumber()
            : Number(v.total),
        createdAt: v.createdAt,
        createdBy: v.createdBy,
      })),
    };
  }

  async create(dto: CreateQuoteDto, currentUser: AuthUserPayload) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException("Cliente no encontrado");
    }
    const validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    if (dto.validUntil && Number.isNaN(validUntil.getTime())) {
      throw new BadRequestException("validUntil inválido");
    }
    const quoteKind = dto.quoteKind === "MARGIN" ? "MARGIN" : "STANDARD";
    if (
      dto.quoteKind != null &&
      dto.quoteKind !== "STANDARD" &&
      dto.quoteKind !== "MARGIN"
    ) {
      throw new BadRequestException("quoteKind debe ser STANDARD o MARGIN");
    }
    let technicalStored = null;
    if (dto.technicalBasicsJson != null) {
      technicalStored = serializeTechnicalBasicsJson(dto.technicalBasicsJson);
    }
    const sellerPayload = await this.resolveSellerForIndustrialInitials(
      dto,
      currentUser,
    );
    const sellerInitials =
      cnCommercial.sellerInitialsForCommercialNumber(sellerPayload);
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const { commercialSequence: nextSequence, commercialNumber } =
        await cnCommercial.getNextCommercialNumber(
          this.prisma,
          dto.projectType,
          { sellerInitials },
        );
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
        return mapQuoteResponse(created);
      } catch (err) {
        const isUniqueViolation =
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "P2002";
        if (isUniqueViolation && attempt < maxRetries - 1) continue;
        throw err;
      }
    }
    throw new BadRequestException(
      "No se pudo asignar número correlativo; reintente.",
    );
  }

  async update(id: string, dto: UpdateQuoteDto, currentUser: AuthUserPayload) {
    const quote = await this.prisma.quote.findUnique({ where: { id } });
    if (!quote) {
      throw new NotFoundException(`Cotización con id ${id} no encontrada`);
    }
    if (!currentUser || !canAccessQuote(currentUser, quote)) {
      throw new NotFoundException(`Cotización con id ${id} no encontrada`);
    }
    const patchKeys = (
      Object.keys(dto) as (keyof UpdateQuoteDto)[]
    ).filter((k) => dto[k] !== undefined);
    if (
      isQuoteTerminalArchivedOrCancelled(quote.status) &&
      patchKeys.length > 0
    ) {
      const onlyStatus =
        patchKeys.length === 1 && patchKeys[0] === "status";
      let nextStatus: string | undefined;
      if (dto.status !== undefined) {
        try {
          nextStatus = normalizeQuoteCommercialStatus(dto.status);
        } catch {
          throw new BadRequestException("Estado comercial inválido");
        }
      }
      const reopening =
        onlyStatus &&
        nextStatus != null &&
        !isQuoteTerminalArchivedOrCancelled(nextStatus);
      if (!reopening) {
        throw new BadRequestException(
          "La cotización está anulada o archivada. Solo puede reactivarse cambiando " +
            "`status` a un estado operativo (p. ej. BORRADOR). No se permiten otros cambios.",
        );
      }
    }
    const validUntil =
      dto.validUntil !== undefined
        ? dto.validUntil
          ? new Date(dto.validUntil)
          : null
        : undefined;
    if (dto.validUntil && validUntil && Number.isNaN(validUntil.getTime())) {
      throw new BadRequestException("validUntil inválido");
    }
    let normalizedStatus: string | undefined = undefined;
    if (dto.status !== undefined) {
      try {
        normalizedStatus = normalizeQuoteCommercialStatus(dto.status);
      } catch {
        throw new BadRequestException(
          "Estado comercial inválido. Valores: " +
            "BORRADOR, LISTA_PARA_ENVIAR, ENVIADA, ACEPTADA, RECHAZADA, ANULADA (o CANCELADA), " +
            "CERRADA_SIN_VENTA, EXPIRADA, ARCHIVADA.",
        );
      }
    }
    let sourceFvStudyId: string | null | undefined = undefined;
    if (dto.sourceFvStudyId !== undefined) {
      const raw = dto.sourceFvStudyId;
      if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
        sourceFvStudyId = null;
      } else {
        const study = await this.prisma.fvStudy.findUnique({
          where: { id: raw.trim() },
          select: { id: true, clientId: true, ownerId: true },
        });
        if (!study) {
          throw new NotFoundException("Estudio FV no encontrado");
        }
        if (study.clientId !== quote.clientId) {
          throw new BadRequestException(
            "El estudio FV debe pertenecer al mismo cliente que la cotización",
          );
        }
        const roles = currentUser?.roles ?? [];
        const isPrivileged = hasGlobalAdminPrivileges(roles);
        const ownsStudy =
          study.ownerId === null || study.ownerId === currentUser?.id;
        if (!isPrivileged && !ownsStudy) {
          throw new BadRequestException(
            "No tiene permiso para vincular este estudio a la cotización",
          );
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
          technicalBasicsJson:
            dto.technicalBasicsJson === null
              ? null
              : serializeTechnicalBasicsJson(dto.technicalBasicsJson),
        }),
      },
      include: {
        client: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true, fullName: true, email: true } },
        salesperson: { select: { id: true, name: true, fullName: true, email: true } },
      },
    });
    return mapQuoteResponse(updated);
  }
}

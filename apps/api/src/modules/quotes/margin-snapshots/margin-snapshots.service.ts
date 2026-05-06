// @ts-nocheck — alineado con dist.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { canAccessQuote } from "../quote-access.helper";
import { parseTechnicalBasicsJson } from "../quote-response.mapper";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import {
  isMarginSnapshotPayloadV1,
  MARGIN_SNAPSHOT_SCHEMA_VERSION,
} from "./margin-snapshot-payload";
import type { CreateMarginSnapshotDto } from "./dto/create-margin-snapshot.dto";
import type { ApplyLatestMarginSnapshotDto } from "./dto/apply-latest-margin-snapshot.dto";
import type { AuthUserPayload } from "../../auth/auth.service";

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d)
    return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

function toNumOrNull(d: unknown): number | null {
  if (d == null) return null;
  const n = toNum(d);
  return Number.isFinite(n) ? n : null;
}

function buildPayloadFromVersionData(
  mainItems: Array<{
    name: string;
    description: string | null;
    sortOrder: number;
    visibleInFinalQuote: boolean;
    totalMode: string;
    totalOverride: unknown;
    sourceFromFvStudyKind: string | null;
    lines: Array<{
      productId: string | null;
      categoryId: string | null;
      brandId: string | null;
      modelId: string | null;
      productNameSnapshot: string;
      productDescriptionSnapshot: string | null;
      categoryNameSnapshot: string | null;
      brandNameSnapshot: string | null;
      modelNameSnapshot: string | null;
      currencySnapshot: string | null;
      unitPriceSnapshot: unknown;
      unitCostSnapshot: unknown;
      discountPercentSnapshot: unknown;
      marginPercentSnapshot: unknown;
      quantity: unknown;
      lineTotalSnapshot: unknown;
      configSnapshot: unknown;
      sortOrder: number;
      visibleInFinalQuote: boolean;
    }>;
  }>,
) {
  return {
    schemaVersion: MARGIN_SNAPSHOT_SCHEMA_VERSION,
    blocks: mainItems.map((m) => ({
      name: m.name,
      description: m.description,
      sortOrder: m.sortOrder,
      visibleInFinalQuote: m.visibleInFinalQuote,
      totalMode: m.totalMode,
      totalOverride: toNumOrNull(m.totalOverride),
      sourceFromFvStudyKind: m.sourceFromFvStudyKind,
      lines: m.lines.map((l) => ({
        productId: l.productId,
        categoryId: l.categoryId,
        brandId: l.brandId,
        modelId: l.modelId,
        productNameSnapshot: l.productNameSnapshot,
        productDescriptionSnapshot: l.productDescriptionSnapshot,
        categoryNameSnapshot: l.categoryNameSnapshot,
        brandNameSnapshot: l.brandNameSnapshot,
        modelNameSnapshot: l.modelNameSnapshot,
        currencySnapshot: l.currencySnapshot,
        unitPriceSnapshot: toNum(l.unitPriceSnapshot),
        unitCostSnapshot: toNumOrNull(l.unitCostSnapshot),
        discountPercentSnapshot: toNumOrNull(l.discountPercentSnapshot),
        marginPercentSnapshot: toNumOrNull(l.marginPercentSnapshot),
        quantity: toNum(l.quantity),
        lineTotalSnapshot: toNum(l.lineTotalSnapshot),
        configSnapshot: l.configSnapshot,
        sortOrder: l.sortOrder,
        visibleInFinalQuote: l.visibleInFinalQuote,
      })),
    })),
  };
}

function parsePayloadJson(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BadRequestException("El snapshot guardado no es JSON válido.");
  }
  if (!isMarginSnapshotPayloadV1(parsed)) {
    throw new BadRequestException(
      `Snapshot con schemaVersion no soportada (se esperaba "${MARGIN_SNAPSHOT_SCHEMA_VERSION}").`,
    );
  }
  return parsed;
}

@Injectable()
export class MarginSnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteVersionsService: QuoteVersionsService,
  ) {}

  mapSnapshotRow(row: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    systemType: string | null;
    mountStructureType: string | null;
    schemaVersion: string;
    sourceQuoteId: string | null;
    sourceQuoteVersionId: string | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdAt: row.createdAt.toISOString(),
      systemType: row.systemType,
      mountStructureType: row.mountStructureType,
      schemaVersion: row.schemaVersion,
      sourceQuoteId: row.sourceQuoteId,
      sourceQuoteVersionId: row.sourceQuoteVersionId,
    };
  }

  async createFromVersion(
    quoteId: string,
    versionId: string,
    dto: CreateMarginSnapshotDto,
    user: AuthUserPayload,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        quoteKind: true,
        ownerId: true,
        salespersonId: true,
        technicalBasicsJson: true,
      },
    });
    if (!quote || !canAccessQuote(user, quote)) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (quote.quoteKind !== "MARGIN") {
      throw new BadRequestException(
        "Solo se pueden guardar plantillas valorizadas desde cotizaciones con margen.",
      );
    }
    const version = await this.prisma.quoteVersion.findFirst({
      where: { id: versionId, quoteId },
      select: { id: true, status: true },
    });
    if (!version) {
      throw new NotFoundException("Versión no encontrada");
    }
    if (version.status !== "BORRADOR") {
      throw new BadRequestException(
        "Solo se puede guardar un snapshot desde una versión en borrador.",
      );
    }
    const mainItems = await this.prisma.quoteMainItem.findMany({
      where: { quoteVersionId: versionId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        lines: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      },
    });
    if (mainItems.length === 0) {
      throw new BadRequestException(
        "No hay bloques (ítems principales) para guardar. Arme la jerarquía antes.",
      );
    }
    const totalLines = mainItems.reduce(
      (n, m) => n + (m.lines?.length ?? 0),
      0,
    );
    if (totalLines === 0) {
      throw new BadRequestException(
        "La jerarquía no tiene líneas para guardar. Agregue al menos un subítem.",
      );
    }
    const basics = parseTechnicalBasicsJson(quote.technicalBasicsJson);
    const systemType =
      basics && typeof basics.systemType === "string"
        ? basics.systemType
        : null;
    const mountStructureType =
      basics && typeof basics.mountStructureType === "string"
        ? basics.mountStructureType
        : null;
    const payload = buildPayloadFromVersionData(mainItems);
    const payloadJson = JSON.stringify(payload);
    const row = await this.prisma.marginTemplateSnapshot.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        createdById: user.id,
        sourceQuoteId: quoteId,
        sourceQuoteVersionId: versionId,
        systemType,
        mountStructureType,
        schemaVersion: MARGIN_SNAPSHOT_SCHEMA_VERSION,
        payloadJson,
        active: true,
      },
    });
    return this.mapSnapshotRow(row);
  }

  async findLatestForUser(userId: string) {
    const row = await this.prisma.marginTemplateSnapshot.findFirst({
      where: { createdById: userId, active: true },
      orderBy: { createdAt: "desc" },
    });
    return row ? this.mapSnapshotRow(row) : null;
  }

  async listForUser(userId: string) {
    const rows = await this.prisma.marginTemplateSnapshot.findMany({
      where: { createdById: userId, active: true },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        systemType: true,
        mountStructureType: true,
        schemaVersion: true,
        sourceQuoteId: true,
        sourceQuoteVersionId: true,
      },
    });
    return rows.map((r) => this.mapSnapshotRow(r));
  }

  async applyLatestToVersion(
    quoteId: string,
    versionId: string,
    dto: ApplyLatestMarginSnapshotDto,
    user: AuthUserPayload,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        quoteKind: true,
        ownerId: true,
        salespersonId: true,
        currency: true,
      },
    });
    if (!quote || !canAccessQuote(user, quote)) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (quote.quoteKind !== "MARGIN") {
      throw new BadRequestException(
        "Solo se puede aplicar plantilla valorizada en cotizaciones con margen.",
      );
    }
    const version = await this.prisma.quoteVersion.findFirst({
      where: { id: versionId, quoteId },
      select: { id: true, status: true },
    });
    if (!version) {
      throw new NotFoundException("Versión no encontrada");
    }
    if (version.status !== "BORRADOR") {
      throw new BadRequestException("Solo se puede aplicar en versiones en borrador.");
    }
    const existingCount = await this.prisma.quoteMainItem.count({
      where: { quoteVersionId: versionId },
    });
    if (existingCount > 0 && dto.replaceExisting !== true) {
      throw new BadRequestException(
        "La versión ya tiene jerarquía. Envíe replaceExisting=true para reemplazarla por la plantilla guardada.",
      );
    }
    const snap = await this.prisma.marginTemplateSnapshot.findFirst({
      where: { createdById: user.id, active: true },
      orderBy: { createdAt: "desc" },
    });
    if (!snap) {
      throw new NotFoundException(
        "No tiene plantillas valorizadas guardadas. Guarde una desde otra cotización con margen.",
      );
    }
    const payload = parsePayloadJson(snap.payloadJson);
    if (!payload.blocks.length) {
      throw new BadRequestException("El snapshot guardado no contiene bloques válidos.");
    }
    const currency = quote.currency?.trim() || "CLP";
    await this.prisma.$transaction(async (tx) => {
      if (existingCount > 0) {
        await tx.quoteMainItem.deleteMany({
          where: { quoteVersionId: versionId },
        });
      }
      for (const block of payload.blocks as Array<{
        name: string;
        description: string | null;
        sortOrder: number;
        visibleInFinalQuote: boolean;
        totalMode: string;
        totalOverride: number | null;
        sourceFromFvStudyKind: string | null;
        lines: Array<{
          productId: string | null;
          categoryId: string | null;
          brandId: string | null;
          modelId: string | null;
          productNameSnapshot: string;
          productDescriptionSnapshot: string | null;
          categoryNameSnapshot: string | null;
          brandNameSnapshot: string | null;
          modelNameSnapshot: string | null;
          currencySnapshot: string | null;
          unitPriceSnapshot: number;
          unitCostSnapshot: number | null;
          discountPercentSnapshot: number | null;
          marginPercentSnapshot: number | null;
          quantity: number;
          lineTotalSnapshot: number;
          configSnapshot: unknown;
          sortOrder: number;
          visibleInFinalQuote: boolean;
        }>;
      }>) {
        const mainItem = await tx.quoteMainItem.create({
          data: {
            quoteVersionId: versionId,
            name: block.name,
            description: block.description,
            sortOrder: block.sortOrder,
            visibleInFinalQuote: block.visibleInFinalQuote,
            totalMode: block.totalMode,
            totalOverride:
              block.totalOverride != null
                ? new Prisma.Decimal(block.totalOverride)
                : null,
            sourceFromFvStudyKind: block.sourceFromFvStudyKind,
          },
        });
        for (const line of block.lines) {
          await tx.quoteItemLine.create({
            data: {
              quoteMainItemId: mainItem.id,
              productId: line.productId,
              categoryId: line.categoryId,
              brandId: line.brandId,
              modelId: line.modelId,
              productNameSnapshot: line.productNameSnapshot,
              productDescriptionSnapshot: line.productDescriptionSnapshot,
              categoryNameSnapshot: line.categoryNameSnapshot,
              brandNameSnapshot: line.brandNameSnapshot,
              modelNameSnapshot: line.modelNameSnapshot,
              currencySnapshot: line.currencySnapshot?.trim() || currency,
              unitPriceSnapshot: new Prisma.Decimal(line.unitPriceSnapshot),
              unitCostSnapshot:
                line.unitCostSnapshot != null
                  ? new Prisma.Decimal(line.unitCostSnapshot)
                  : null,
              discountPercentSnapshot:
                line.discountPercentSnapshot != null
                  ? new Prisma.Decimal(line.discountPercentSnapshot)
                  : new Prisma.Decimal(0),
              marginPercentSnapshot:
                line.marginPercentSnapshot != null
                  ? new Prisma.Decimal(line.marginPercentSnapshot)
                  : null,
              quantity: new Prisma.Decimal(line.quantity),
              lineTotalSnapshot: new Prisma.Decimal(line.lineTotalSnapshot),
              configSnapshot: line.configSnapshot,
              sortOrder: line.sortOrder,
              visibleInFinalQuote: line.visibleInFinalQuote,
            },
          });
        }
      }
      await this.quoteVersionsService.recalcVersionTotalsTx(tx, versionId);
    });
    return {
      applied: true,
      snapshotId: snap.id,
      blocksApplied: payload.blocks.length,
    };
  }
}

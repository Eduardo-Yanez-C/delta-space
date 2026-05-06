// @ts-nocheck — alineado con dist.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { canAccessQuote } from "../quote-access.helper";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import { filterBlocksForApplyClean } from "./margin-hierarchy.clean-blocks";
import {
  isValidMarginHierarchyMountStructureType,
  isValidMarginHierarchySystemType,
} from "./margin-hierarchy.constants";
import type { ApplyCleanDto } from "./dto/apply-clean.dto";
import type { AuthUserPayload } from "../../auth/auth.service";

@Injectable()
export class MarginHierarchyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteVersionsService: QuoteVersionsService,
  ) {}

  async applyCleanHierarchy(
    quoteId: string,
    versionId: string,
    dto: ApplyCleanDto,
    currentUser: AuthUserPayload,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        id: true,
        quoteKind: true,
        ownerId: true,
        salespersonId: true,
        status: true,
        currency: true,
      },
    });
    if (!quote) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (quote.quoteKind !== "MARGIN") {
      throw new BadRequestException(
        "Esta acción solo está disponible para cotizaciones MARGIN",
      );
    }
    if (!currentUser || !canAccessQuote(currentUser, quote)) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (quote.status !== "BORRADOR") {
      throw new BadRequestException(
        "Solo se puede aplicar plantilla limpia en cotizaciones en estado BORRADOR",
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
        "Solo se puede aplicar plantilla limpia en versiones BORRADOR",
      );
    }
    if (!isValidMarginHierarchySystemType(dto.systemType)) {
      throw new BadRequestException(`systemType inválido: ${dto.systemType}`);
    }
    if (!isValidMarginHierarchyMountStructureType(dto.mountStructureType)) {
      throw new BadRequestException(
        `mountStructureType inválido: ${dto.mountStructureType}`,
      );
    }
    const systemType = dto.systemType;
    const mountStructureType = dto.mountStructureType;
    const existingCount = await this.prisma.quoteMainItem.count({
      where: { quoteVersionId: versionId },
    });
    if (existingCount > 0 && dto.replaceExisting !== true) {
      throw new BadRequestException(
        "La versión ya tiene ítems principales. Envíe replaceExisting=true para reemplazar la jerarquía.",
      );
    }
    const blocks = filterBlocksForApplyClean(systemType, mountStructureType);
    const currency = quote.currency?.trim() || "CLP";
    await this.prisma.$transaction(async (tx) => {
      if (dto.replaceExisting === true && existingCount > 0) {
        await tx.quoteMainItem.deleteMany({
          where: { quoteVersionId: versionId },
        });
      }
      for (const block of blocks) {
        const mainItem = await tx.quoteMainItem.create({
          data: {
            quoteVersionId: versionId,
            name: block.name,
            description: block.description ?? null,
            sortOrder: block.sortOrder,
            visibleInFinalQuote: true,
            totalMode: "SUM_LINES",
            totalOverride: null,
          },
        });
        for (const lineDef of block.lines) {
          await tx.quoteItemLine.create({
            data: {
              quoteMainItemId: mainItem.id,
              productId: null,
              categoryId: null,
              brandId: null,
              modelId: null,
              productNameSnapshot: lineDef.productNameSnapshot,
              productDescriptionSnapshot:
                lineDef.productDescriptionSnapshot ?? null,
              categoryNameSnapshot: null,
              brandNameSnapshot: null,
              modelNameSnapshot: null,
              currencySnapshot: currency,
              unitPriceSnapshot: new Prisma.Decimal(0),
              unitCostSnapshot: null,
              discountPercentSnapshot: new Prisma.Decimal(0),
              marginPercentSnapshot: null,
              quantity: new Prisma.Decimal(1),
              lineTotalSnapshot: new Prisma.Decimal(0),
              sortOrder: lineDef.sortOrder,
              visibleInFinalQuote: true,
              configSnapshot: null,
            },
          });
        }
      }
      await this.quoteVersionsService.recalcVersionTotalsTx(tx, versionId);
    });
    return { applied: true, blocksCreated: blocks.length };
  }
}

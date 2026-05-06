// @ts-nocheck — alineado con dist.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  hasGlobalAdminPrivileges,
  hasSalesLikePrivileges,
} from "../../auth/role-constants";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { lineUtilityAndMarginPercent } from "../quote-margin-economics.helper";
import { canAccessQuote } from "../quote-access.helper";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import type { CreateQuoteItemDto } from "./dto/create-quote-item.dto";
import type { UpdateQuoteItemDto } from "./dto/update-quote-item.dto";
import type { AuthUserPayload } from "../../auth/auth.service";
import { commercialNameForQuoteLine } from "../../../common/product-quote-display-name";

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d)
    return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

function canApplyPriceOverride(roles: string[] | undefined) {
  return hasSalesLikePrivileges(roles ?? []);
}

function lineTotal(quantity: number, unitPrice: number, discountPercent: number) {
  const sub = quantity * unitPrice;
  return sub * (1 - discountPercent / 100);
}

@Injectable()
export class QuoteItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteVersionsService: QuoteVersionsService,
  ) {}

  async findAll(
    quoteId: string,
    versionId: string,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const version = await this.quoteVersionsService.findOne(
      quoteId,
      versionId,
      currentUser,
    );
    return version.items;
  }

  async addItem(
    quoteId: string,
    versionId: string,
    dto: CreateQuoteItemDto,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    if (
      dto.unitPriceOverride !== undefined &&
      !canApplyPriceOverride(currentUser?.roles)
    ) {
      throw new ForbiddenException(
        "No tiene permiso para aplicar ajuste de precio en el ítem",
      );
    }
    const roles = currentUser?.roles ?? [];
    const isPrivileged = hasGlobalAdminPrivileges(roles);
    if (dto.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: dto.productId },
        include: { category: true, brand: true, model: true },
      });
      if (!product) {
        throw new NotFoundException("Producto no encontrado");
      }
      let unitPrice = 0;
      let currency = product.defaultCurrency ?? "CLP";
      let unitCost: number | null = null;
      if (dto.priceId) {
        const price = await this.prisma.productPrice.findFirst({
          where: { id: dto.priceId, productId: dto.productId },
        });
        if (!price) {
          throw new BadRequestException(
            "Precio no encontrado o no corresponde al producto",
          );
        }
        unitPrice = toNum(price.price);
        currency = price.currency ?? currency;
        if (isPrivileged && price.cost != null) unitCost = toNum(price.cost);
      } else {
        const now = new Date();
        const vigent = await this.prisma.productPrice.findFirst({
          where: {
            productId: dto.productId,
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gte: now } }],
          },
          orderBy: { validFrom: "desc" },
        });
        if (vigent) {
          unitPrice = toNum(vigent.price);
          currency = vigent.currency ?? currency;
          if (isPrivileged && vigent.cost != null) unitCost = toNum(vigent.cost);
        }
      }
      if (
        dto.unitPriceOverride !== undefined &&
        canApplyPriceOverride(currentUser?.roles)
      ) {
        unitPrice = dto.unitPriceOverride;
      }
      if (unitPrice <= 0) {
        throw new BadRequestException(
          "No hay precio vigente para el producto o debe indicar unitPriceOverride",
        );
      }
      const discountPercent = dto.discountPercent ?? 0;
      const quantity = dto.quantity;
      const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
      const maxSort = await this.prisma.quoteItem.findFirst({
        where: { quoteVersionId: versionId },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      const sortOrder = (maxSort?.sortOrder ?? 0) + 1;
      const item = await this.prisma.quoteItem.create({
        data: {
          quoteVersionId: versionId,
          productId: dto.productId,
          categoryId: product.categoryId,
          brandId: product.brandId,
          modelId: product.modelId,
          productNameSnapshot: commercialNameForQuoteLine(product),
          productDescriptionSnapshot: product.description ?? null,
          categoryNameSnapshot: product.category?.name ?? null,
          brandNameSnapshot: product.brandNameFree ?? product.brand?.name ?? null,
          modelNameSnapshot: product.modelNameFree ?? product.model?.name ?? null,
          currencySnapshot: currency,
          unitPriceSnapshot: unitPrice,
          unitCostSnapshot: unitCost,
          discountPercentSnapshot: discountPercent,
          marginPercentSnapshot: null,
          quantity,
          lineTotalSnapshot,
          sortOrder,
        },
      });
      await this.quoteVersionsService.recalcVersionTotals(versionId);
      const qk = await this.prisma.quote.findUnique({
        where: { id: quoteId },
        select: { quoteKind: true },
      });
      return this.mapItem(item, currentUser, qk?.quoteKind);
    }
    const name = dto.productNameSnapshot?.trim();
    const qty = dto.quantity;
    const price = dto.unitPriceSnapshot ?? dto.unitPriceOverride;
    const currencySnapshot = dto.currencySnapshot?.trim() ?? "CLP";
    if (!name || name.length === 0) {
      throw new BadRequestException(
        "productNameSnapshot es obligatorio para ítem manual",
      );
    }
    if (price == null || Number(price) < 0) {
      throw new BadRequestException(
        "unitPriceSnapshot es obligatorio para ítem manual y debe ser >= 0",
      );
    }
    const discountPercent = dto.discountPercent ?? 0;
    const lineTotalSnapshot = lineTotal(qty, price, discountPercent);
    const maxSort = await this.prisma.quoteItem.findFirst({
      where: { quoteVersionId: versionId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? 0) + 1;
    const item = await this.prisma.quoteItem.create({
      data: {
        quoteVersionId: versionId,
        productId: null,
        categoryId: null,
        brandId: null,
        modelId: null,
        productNameSnapshot: name,
        productDescriptionSnapshot: dto.productDescriptionSnapshot?.trim() ?? null,
        categoryNameSnapshot: dto.categoryNameSnapshot?.trim() ?? null,
        brandNameSnapshot: dto.brandNameSnapshot?.trim() ?? null,
        modelNameSnapshot: dto.modelNameSnapshot?.trim() ?? null,
        currencySnapshot: currencySnapshot,
        unitPriceSnapshot: price,
        unitCostSnapshot: null,
        discountPercentSnapshot: discountPercent,
        marginPercentSnapshot: null,
        quantity: qty,
        lineTotalSnapshot,
        sortOrder,
      },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    const qkManual = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { quoteKind: true },
    });
    return this.mapItem(item, currentUser, qkManual?.quoteKind);
  }

  async updateItem(
    quoteId: string,
    versionId: string,
    itemId: string,
    dto: UpdateQuoteItemDto,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    const item = await this.prisma.quoteItem.findFirst({
      where: { id: itemId, quoteVersionId: versionId },
    });
    if (!item) {
      throw new NotFoundException("Ítem no encontrado");
    }
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    if (
      dto.unitPriceOverride !== undefined &&
      !canApplyPriceOverride(currentUser?.roles)
    ) {
      throw new ForbiddenException(
        "No tiene permiso para aplicar ajuste de precio en el ítem",
      );
    }
    const quoteMeta = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { quoteKind: true },
    });
    const isMargin = quoteMeta?.quoteKind === "MARGIN";
    let quantity = toNum(item.quantity);
    let unitPrice = toNum(item.unitPriceSnapshot);
    let discountPercent =
      item.discountPercentSnapshot != null
        ? toNum(item.discountPercentSnapshot)
        : 0;
    let unitCost =
      item.unitCostSnapshot != null ? toNum(item.unitCostSnapshot) : null;
    if (dto.quantity !== undefined) quantity = dto.quantity;
    if (
      dto.unitPriceOverride !== undefined &&
      canApplyPriceOverride(currentUser?.roles)
    ) {
      unitPrice = dto.unitPriceOverride;
    }
    if (dto.discountPercent !== undefined) discountPercent = dto.discountPercent;
    if (dto.unitCostSnapshot !== undefined) {
      if (!isMargin) {
      } else if (dto.unitCostSnapshot === null) {
        unitCost = null;
      } else {
        const v = Number(dto.unitCostSnapshot);
        if (v < 0 || !Number.isFinite(v)) {
          throw new BadRequestException("unitCostSnapshot debe ser >= 0 o null");
        }
        unitCost = v;
      }
    }
    const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
    const data: Record<string, unknown> = {
      quantity,
      unitPriceSnapshot: unitPrice,
      discountPercentSnapshot: discountPercent,
      lineTotalSnapshot,
    };
    if (isMargin && dto.unitCostSnapshot !== undefined) {
      data.unitCostSnapshot =
        unitCost === null ? null : new Prisma.Decimal(unitCost);
    }
    const updated = await this.prisma.quoteItem.update({
      where: { id: itemId },
      data,
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return this.mapItem(updated, currentUser, quoteMeta?.quoteKind);
  }

  async removeItem(
    quoteId: string,
    versionId: string,
    itemId: string,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    const item = await this.prisma.quoteItem.findFirst({
      where: { id: itemId, quoteVersionId: versionId },
    });
    if (!item) {
      throw new NotFoundException("Ítem no encontrado");
    }
    await this.prisma.quoteItem.delete({
      where: { id: itemId },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return { deleted: true };
  }

  async ensureQuoteEditable(quoteId: string, currentUser: AuthUserPayload) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        quoteKind: true,
        ownerId: true,
        salespersonId: true,
        status: true,
      },
    });
    if (!quote) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (!currentUser || !canAccessQuote(currentUser, quote)) {
      throw new NotFoundException("Cotización no encontrada");
    }
    if (quote.status !== "BORRADOR") {
      throw new BadRequestException(
        "Solo se pueden modificar ítems en cotizaciones en estado BORRADOR",
      );
    }
  }

  async ensureVersionBelongsToQuote(quoteId: string, versionId: string) {
    const v = await this.prisma.quoteVersion.findFirst({
      where: { id: versionId, quoteId },
    });
    if (!v) {
      throw new NotFoundException("Versión no encontrada");
    }
  }

  mapItem(
    i: {
      id: string;
      productId: string | null;
      productNameSnapshot: string;
      productDescriptionSnapshot: string | null;
      categoryNameSnapshot: string | null;
      brandNameSnapshot: string | null;
      modelNameSnapshot: string | null;
      currencySnapshot: string | null;
      unitPriceSnapshot: unknown;
      discountPercentSnapshot: unknown;
      quantity: unknown;
      lineTotalSnapshot: unknown;
      sortOrder: number;
      unitCostSnapshot?: unknown;
      marginPercentSnapshot?: unknown;
    },
    currentUser: AuthUserPayload,
    quoteKind: string | null | undefined,
  ) {
    const isMargin = quoteKind === "MARGIN";
    const showCostFields =
      hasGlobalAdminPrivileges(currentUser?.roles ?? []) || isMargin;
    const lineTotalSale = toNum(i.lineTotalSnapshot);
    const qty = toNum(i.quantity);
    const uc = i.unitCostSnapshot != null ? toNum(i.unitCostSnapshot) : null;
    const out: Record<string, unknown> = {
      id: i.id,
      productId: i.productId ?? null,
      productNameSnapshot: i.productNameSnapshot,
      productDescriptionSnapshot: i.productDescriptionSnapshot,
      categoryNameSnapshot: i.categoryNameSnapshot,
      brandNameSnapshot: i.brandNameSnapshot,
      modelNameSnapshot: i.modelNameSnapshot,
      currencySnapshot: i.currencySnapshot,
      unitPriceSnapshot: toNum(i.unitPriceSnapshot),
      discountPercentSnapshot:
        i.discountPercentSnapshot != null
          ? toNum(i.discountPercentSnapshot)
          : null,
      quantity: qty,
      lineTotalSnapshot: lineTotalSale,
      sortOrder: i.sortOrder,
    };
    if (showCostFields) {
      out.unitCostSnapshot = uc;
      out.marginPercentSnapshot =
        i.marginPercentSnapshot != null ? toNum(i.marginPercentSnapshot) : null;
    }
    if (isMargin) {
      const econ = lineUtilityAndMarginPercent(lineTotalSale, qty, uc);
      out.lineCostTotal = econ.lineCostTotal;
      out.lineUtility = econ.lineUtility;
      out.lineMarginPercent = econ.lineMarginPercent;
    }
    return out;
  }
}

// @ts-nocheck — alineado con dist.
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  hasGlobalAdminPrivileges,
  hasSalesLikePrivileges,
} from "../../auth/role-constants";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { canAccessQuote } from "../quote-access.helper";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import { commercialNameForQuoteLine } from "../../../common/product-quote-display-name";
import type { CreateMainItemDto } from "./dto/create-main-item.dto";
import type { UpdateMainItemDto } from "./dto/update-main-item.dto";
import type { CreateLineDto } from "./dto/create-line.dto";
import type { UpdateLineDto } from "./dto/update-line.dto";
import type { AuthUserPayload } from "../../auth/auth.service";

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d)
    return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

function lineTotal(quantity: number, unitPrice: number, discountPercent: number) {
  const sub = quantity * unitPrice;
  return sub * (1 - discountPercent / 100);
}

function canApplyPriceOverride(roles: string[] | undefined) {
  return hasSalesLikePrivileges(roles ?? []);
}

@Injectable()
export class QuoteMainItemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteVersionsService: QuoteVersionsService,
  ) {}

  async createMainItem(
    quoteId: string,
    versionId: string,
    dto: CreateMainItemDto,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException("name es obligatorio");
    }
    const totalMode = dto.totalMode === "MANUAL" ? "MANUAL" : "SUM_LINES";
    const totalOverride = dto.totalOverride != null ? dto.totalOverride : null;
    const visibleInFinalQuote = dto.visibleInFinalQuote ?? true;
    const maxSort = await this.prisma.quoteMainItem.findFirst({
      where: { quoteVersionId: versionId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
    const mainItem = await this.prisma.quoteMainItem.create({
      data: {
        quoteVersionId: versionId,
        name,
        description: dto.description?.trim() ?? null,
        sortOrder,
        visibleInFinalQuote,
        totalMode,
        totalOverride,
      },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return mainItem;
  }

  async updateMainItem(
    quoteId: string,
    versionId: string,
    mainItemId: string,
    dto: UpdateMainItemDto,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const current = await this.ensureMainItemBelongsToVersion(
      mainItemId,
      versionId,
    );
    const touched =
      dto.name !== undefined ||
      dto.description !== undefined ||
      dto.visibleInFinalQuote !== undefined ||
      dto.totalMode !== undefined ||
      dto.totalOverride !== undefined;
    if (!touched) {
      throw new BadRequestException("Debe enviar al menos un campo a actualizar");
    }
    const lineRows = await this.prisma.quoteItemLine.findMany({
      where: { quoteMainItemId: mainItemId },
      select: { lineTotalSnapshot: true },
    });
    const sumLines = lineRows.reduce((s, l) => s + toNum(l.lineTotalSnapshot), 0);
    let nextName = current.name;
    if (dto.name !== undefined) {
      const t = String(dto.name).trim();
      if (!t) {
        throw new BadRequestException("name no puede estar vacío");
      }
      nextName = t;
    }
    let nextDescription = current.description;
    if (dto.description !== undefined) {
      const t = String(dto.description).trim();
      nextDescription = t === "" ? null : t;
    }
    let nextVisible = current.visibleInFinalQuote;
    if (dto.visibleInFinalQuote !== undefined) {
      nextVisible = Boolean(dto.visibleInFinalQuote);
    }
    let nextMode = current.totalMode;
    if (dto.totalMode !== undefined) {
      if (dto.totalMode !== "MANUAL" && dto.totalMode !== "SUM_LINES") {
        throw new BadRequestException("totalMode debe ser SUM_LINES o MANUAL");
      }
      nextMode = dto.totalMode === "MANUAL" ? "MANUAL" : "SUM_LINES";
    }
    if (
      dto.totalOverride !== undefined &&
      dto.totalMode === undefined &&
      current.totalMode === "SUM_LINES"
    ) {
      nextMode = "MANUAL";
    }
    let nextOverride: Prisma.Decimal | null | undefined;
    if (nextMode === "SUM_LINES") {
      nextOverride = null;
    } else {
      if (dto.totalOverride !== undefined) {
        if (dto.totalOverride === null) {
          nextOverride = null;
        } else {
          const v = Number(dto.totalOverride);
          if (!Number.isFinite(v) || v < 0) {
            throw new BadRequestException(
              "totalOverride debe ser un número >= 0 o null",
            );
          }
          nextOverride = new Prisma.Decimal(v);
        }
      } else if (current.totalMode === "SUM_LINES" && nextMode === "MANUAL") {
        nextOverride = new Prisma.Decimal(Math.round(sumLines * 100) / 100);
      } else {
        nextOverride = current.totalOverride;
      }
    }
    const updated = await this.prisma.quoteMainItem.update({
      where: { id: mainItemId },
      data: {
        name: nextName,
        description: nextDescription,
        visibleInFinalQuote: nextVisible,
        totalMode: nextMode,
        totalOverride: nextOverride,
      },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return updated;
  }

  async createLine(
    quoteId: string,
    versionId: string,
    mainItemId: string,
    dto: CreateLineDto,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    await this.ensureMainItemBelongsToVersion(mainItemId, versionId);
    const source = dto.source;
    if (source !== "MANUAL" && source !== "FROM_CATALOG") {
      throw new BadRequestException("source debe ser MANUAL o FROM_CATALOG");
    }
    if (source === "MANUAL") {
      return this.createLineManual(quoteId, versionId, mainItemId, dto);
    }
    return this.createLineFromCatalog(
      quoteId,
      versionId,
      mainItemId,
      dto,
      currentUser,
    );
  }

  async createLineManual(
    quoteId: string,
    versionId: string,
    mainItemId: string,
    dto: CreateLineDto,
  ) {
    if (dto.productId != null && dto.productId !== "") {
      throw new BadRequestException("Para línea manual no debe enviar productId");
    }
    const name = dto.productNameSnapshot?.trim();
    const quantity = Number(dto.quantity);
    const unitPrice =
      dto.unitPriceSnapshot != null ? Number(dto.unitPriceSnapshot) : null;
    const currencySnapshot = dto.currencySnapshot?.trim() || "CLP";
    if (!name) {
      throw new BadRequestException(
        "productNameSnapshot es obligatorio para línea manual",
      );
    }
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      throw new BadRequestException("quantity debe ser un número positivo");
    }
    if (unitPrice == null || unitPrice < 0 || !Number.isFinite(unitPrice)) {
      throw new BadRequestException(
        "unitPriceSnapshot es obligatorio para línea manual y debe ser >= 0",
      );
    }
    const discountPercent =
      dto.discountPercentSnapshot != null
        ? Number(dto.discountPercentSnapshot)
        : 0;
    const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
    const quoteRow = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { quoteKind: true },
    });
    const isMargin = quoteRow?.quoteKind === "MARGIN";
    let unitCostSnapshot: Prisma.Decimal | null = null;
    if (isMargin && dto.unitCostSnapshot !== undefined) {
      if (dto.unitCostSnapshot === null) {
        unitCostSnapshot = null;
      } else {
        const c = Number(dto.unitCostSnapshot);
        if (!Number.isFinite(c) || c < 0) {
          throw new BadRequestException(
            "unitCostSnapshot debe ser un número >= 0 o null",
          );
        }
        unitCostSnapshot = new Prisma.Decimal(c);
      }
    }
    const maxSort = await this.prisma.quoteItemLine.findFirst({
      where: { quoteMainItemId: mainItemId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
    const line = await this.prisma.quoteItemLine.create({
      data: {
        quoteMainItemId: mainItemId,
        productId: null,
        categoryId: null,
        brandId: null,
        modelId: null,
        productNameSnapshot: name,
        productDescriptionSnapshot: dto.productDescriptionSnapshot?.trim() ?? null,
        categoryNameSnapshot: null,
        brandNameSnapshot: null,
        modelNameSnapshot: null,
        currencySnapshot: currencySnapshot,
        unitPriceSnapshot: unitPrice,
        unitCostSnapshot,
        discountPercentSnapshot: discountPercent,
        marginPercentSnapshot: null,
        quantity,
        lineTotalSnapshot,
        sortOrder,
        visibleInFinalQuote: false,
      },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return line;
  }

  async createLineFromCatalog(
    _quoteId: string,
    versionId: string,
    mainItemId: string,
    dto: CreateLineDto,
    currentUser: AuthUserPayload,
  ) {
    if (dto.productNameSnapshot != null && dto.productNameSnapshot !== "") {
      throw new BadRequestException(
        "Para línea desde catálogo no debe enviar productNameSnapshot",
      );
    }
    const productId = dto.productId?.trim();
    const quantity = Number(dto.quantity);
    if (!productId) {
      throw new BadRequestException(
        "productId es obligatorio para línea desde catálogo",
      );
    }
    if (quantity <= 0 || !Number.isFinite(quantity)) {
      throw new BadRequestException("quantity debe ser un número positivo");
    }
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { category: true, brand: true, model: true },
    });
    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }
    let unitPrice = 0;
    let currency = product.defaultCurrency ?? "CLP";
    let unitCost: number | null = null;
    const isPrivileged = hasGlobalAdminPrivileges(currentUser?.roles ?? []);
    if (dto.priceId) {
      const price = await this.prisma.productPrice.findFirst({
        where: { id: dto.priceId, productId },
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
          productId,
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
    const discountPercent = 0;
    const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
    const maxSort = await this.prisma.quoteItemLine.findFirst({
      where: { quoteMainItemId: mainItemId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
    const line = await this.prisma.quoteItemLine.create({
      data: {
        quoteMainItemId: mainItemId,
        productId,
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
        visibleInFinalQuote: false,
      },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return line;
  }

  async updateLine(
    quoteId: string,
    versionId: string,
    lineId: string,
    dto: UpdateLineDto,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const line = await this.ensureLineBelongsToVersion(lineId, versionId);
    const quoteRow = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      select: { quoteKind: true },
    });
    const isMargin = quoteRow?.quoteKind === "MARGIN";
    let quantity = toNum(line.quantity);
    let unitPrice = toNum(line.unitPriceSnapshot);
    let discountPercent =
      line.discountPercentSnapshot != null
        ? toNum(line.discountPercentSnapshot)
        : 0;
    let unitCost =
      line.unitCostSnapshot != null ? toNum(line.unitCostSnapshot) : null;
    if (dto.quantity !== undefined) {
      const v = Number(dto.quantity);
      if (v <= 0 || !Number.isFinite(v))
        throw new BadRequestException("quantity debe ser un número positivo");
      quantity = v;
    }
    if (dto.unitPriceSnapshot !== undefined) {
      const v = Number(dto.unitPriceSnapshot);
      if (v < 0 || !Number.isFinite(v))
        throw new BadRequestException("unitPriceSnapshot debe ser >= 0");
      unitPrice = v;
    }
    if (dto.discountPercentSnapshot !== undefined) {
      const v = Number(dto.discountPercentSnapshot);
      if (v < 0 || v > 100 || !Number.isFinite(v))
        throw new BadRequestException(
          "discountPercentSnapshot debe estar entre 0 y 100",
        );
      discountPercent = v;
    }
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
    if (dto.productNameSnapshot !== undefined) {
      const v = dto.productNameSnapshot.trim();
      data.productNameSnapshot = v || line.productNameSnapshot;
    }
    if (dto.productDescriptionSnapshot !== undefined) {
      data.productDescriptionSnapshot =
        dto.productDescriptionSnapshot.trim() || null;
    }
    if (dto.currencySnapshot !== undefined) {
      const v = dto.currencySnapshot.trim();
      data.currencySnapshot = v || line.currencySnapshot;
    }
    if (dto.visibleInFinalQuote !== undefined) {
      data.visibleInFinalQuote = dto.visibleInFinalQuote;
    }
    const updated = await this.prisma.quoteItemLine.update({
      where: { id: lineId },
      data,
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return updated;
  }

  async deleteLine(
    quoteId: string,
    versionId: string,
    lineId: string,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    await this.ensureLineBelongsToVersion(lineId, versionId);
    await this.prisma.quoteItemLine.delete({
      where: { id: lineId },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return { deleted: true };
  }

  async duplicateLine(
    quoteId: string,
    versionId: string,
    lineId: string,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const line = await this.prisma.quoteItemLine.findFirst({
      where: { id: lineId },
      include: { quoteMainItem: true },
    });
    if (!line || line.quoteMainItem.quoteVersionId !== versionId) {
      throw new NotFoundException(
        "Línea no encontrada o no pertenece a esta versión",
      );
    }
    const mainItemId = line.quoteMainItemId;
    const maxSort = await this.prisma.quoteItemLine.findFirst({
      where: { quoteMainItemId: mainItemId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
    const quantity = toNum(line.quantity);
    const unitPrice = toNum(line.unitPriceSnapshot);
    const discountPercent =
      line.discountPercentSnapshot != null
        ? toNum(line.discountPercentSnapshot)
        : 0;
    const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
    const created = await this.prisma.quoteItemLine.create({
      data: {
        quoteMainItemId: mainItemId,
        productId: line.productId,
        categoryId: line.categoryId,
        brandId: line.brandId,
        modelId: line.modelId,
        productNameSnapshot: line.productNameSnapshot,
        productDescriptionSnapshot: line.productDescriptionSnapshot,
        categoryNameSnapshot: line.categoryNameSnapshot,
        brandNameSnapshot: line.brandNameSnapshot,
        modelNameSnapshot: line.modelNameSnapshot,
        currencySnapshot: line.currencySnapshot,
        unitPriceSnapshot: unitPrice,
        unitCostSnapshot: line.unitCostSnapshot,
        discountPercentSnapshot: discountPercent,
        marginPercentSnapshot: null,
        quantity,
        lineTotalSnapshot,
        configSnapshot: line.configSnapshot,
        sortOrder,
        visibleInFinalQuote: line.visibleInFinalQuote,
      },
    });
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return { id: created.id };
  }

  async duplicateMainItem(
    quoteId: string,
    versionId: string,
    mainItemId: string,
    currentUser: AuthUserPayload,
  ) {
    await this.ensureQuoteEditable(quoteId, currentUser);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const source = await this.ensureMainItemBelongsToVersion(
      mainItemId,
      versionId,
    );
    const lines = await this.prisma.quoteItemLine.findMany({
      where: { quoteMainItemId: mainItemId },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    const maxMain = await this.prisma.quoteMainItem.findFirst({
      where: { quoteVersionId: versionId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const mainSortOrder = (maxMain?.sortOrder ?? -1) + 1;
    const createdMain = await this.prisma.quoteMainItem.create({
      data: {
        quoteVersionId: versionId,
        name: source.name,
        description: source.description,
        visibleInFinalQuote: source.visibleInFinalQuote,
        totalMode: source.totalMode,
        totalOverride: source.totalOverride,
        sortOrder: mainSortOrder,
        sourceFromFvStudyKind: null,
      },
    });
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      const quantity = toNum(ln.quantity);
      const unitPrice = toNum(ln.unitPriceSnapshot);
      const discountPercent =
        ln.discountPercentSnapshot != null
          ? toNum(ln.discountPercentSnapshot)
          : 0;
      const lineTotalSnapshot = lineTotal(quantity, unitPrice, discountPercent);
      await this.prisma.quoteItemLine.create({
        data: {
          quoteMainItemId: createdMain.id,
          productId: ln.productId,
          categoryId: ln.categoryId,
          brandId: ln.brandId,
          modelId: ln.modelId,
          productNameSnapshot: ln.productNameSnapshot,
          productDescriptionSnapshot: ln.productDescriptionSnapshot,
          categoryNameSnapshot: ln.categoryNameSnapshot,
          brandNameSnapshot: ln.brandNameSnapshot,
          modelNameSnapshot: ln.modelNameSnapshot,
          currencySnapshot: ln.currencySnapshot,
          unitPriceSnapshot: unitPrice,
          unitCostSnapshot: ln.unitCostSnapshot,
          discountPercentSnapshot: discountPercent,
          marginPercentSnapshot: null,
          quantity,
          lineTotalSnapshot,
          configSnapshot: ln.configSnapshot,
          sortOrder: i,
          visibleInFinalQuote: ln.visibleInFinalQuote,
        },
      });
    }
    await this.quoteVersionsService.recalcVersionTotals(versionId);
    return { id: createdMain.id };
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

  async ensureMainItemBelongsToVersion(mainItemId: string, versionId: string) {
    const mainItem = await this.prisma.quoteMainItem.findFirst({
      where: { id: mainItemId, quoteVersionId: versionId },
    });
    if (!mainItem) {
      throw new NotFoundException(
        "Ítem principal no encontrado o no pertenece a esta versión",
      );
    }
    return mainItem;
  }

  async ensureLineBelongsToVersion(lineId: string, versionId: string) {
    const line = await this.prisma.quoteItemLine.findFirst({
      where: { id: lineId },
      include: { quoteMainItem: true },
    });
    if (!line || line.quoteMainItem.quoteVersionId !== versionId) {
      throw new NotFoundException(
        "Línea no encontrada o no pertenece a esta versión",
      );
    }
    return line;
  }
}

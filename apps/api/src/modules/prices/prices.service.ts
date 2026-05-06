import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import {
  isAdmin,
  stripSensitiveFromPrice,
  stripSensitiveFromPrices,
} from "./strip-sensitive";
import type { CreatePriceDto } from "./dto/create-price.dto";

function dayBefore(date: Date) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function parseDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException(`Fecha inválida: ${s}`);
  }
  return d;
}

function endOfUtcDay(d: Date) {
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

@Injectable()
export class PricesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByProductId(productId: string, currentUser: AuthUserPayload) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Producto con id ${productId} no encontrado`);
    }
    const list = await this.prisma.productPrice.findMany({
      where: { productId },
      orderBy: { validFrom: "desc" },
      include: { supplier: true, updatedBy: true },
    });
    if (!isAdmin(currentUser?.roles)) {
      return stripSensitiveFromPrices(
        list as unknown as Record<string, unknown>[],
      ) as typeof list;
    }
    return list;
  }

  async findAll(
    filters: {
      productId?: string;
      supplierId?: string;
      validAt?: string;
      supplyOrigin?: string;
    },
    currentUser: AuthUserPayload,
  ) {
    const where: Record<string, unknown> = {};
    if (filters.productId) {
      where.productId = filters.productId;
    }
    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }
    if (filters.supplyOrigin) {
      where.supplier = { supplyOrigin: filters.supplyOrigin };
    }
    if (filters.validAt) {
      const validAt = parseDate(filters.validAt);
      where.validFrom = { lte: validAt };
      where.OR = [{ validTo: null }, { validTo: { gte: validAt } }];
    }
    const list = await this.prisma.productPrice.findMany({
      where: where as never,
      orderBy: { validFrom: "desc" },
      include: { product: true, supplier: true },
    });
    if (!isAdmin(currentUser?.roles)) {
      return stripSensitiveFromPrices(
        list as unknown as Record<string, unknown>[],
      ) as typeof list;
    }
    return list;
  }

  async findOne(id: string, currentUser: AuthUserPayload) {
    const price = await this.prisma.productPrice.findUnique({
      where: { id },
      include: { product: true, supplier: true, updatedBy: true },
    });
    if (!price) {
      throw new NotFoundException(`Precio con id ${id} no encontrado`);
    }
    if (!isAdmin(currentUser?.roles)) {
      return stripSensitiveFromPrice(
        price as unknown as Record<string, unknown>,
      ) as typeof price;
    }
    return price;
  }

  async create(dto: CreatePriceDto) {
    if (!dto.productId) {
      throw new BadRequestException("productId es obligatorio");
    }
    if (dto.price == null || Number(dto.price) <= 0) {
      throw new BadRequestException("price es obligatorio y debe ser mayor a 0");
    }
    const validFrom = parseDate(dto.validFrom);
    const validToDto = dto.validTo ? parseDate(dto.validTo) : null;
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });
    if (!product) {
      throw new NotFoundException("Producto no encontrado");
    }
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });
      if (!supplier) {
        throw new NotFoundException("Proveedor no encontrado");
      }
    }
    if (dto.updatedById) {
      const user = await this.prisma.user.findUnique({
        where: { id: dto.updatedById },
      });
      if (!user) {
        throw new NotFoundException("Usuario no encontrado");
      }
    }
    await this.prisma.$transaction(async (tx) => {
      const closeDate = dayBefore(validFrom);
      const supplierIdFilter = dto.supplierId ?? null;
      const overlapping = await tx.productPrice.findMany({
        where: {
          productId: dto.productId,
          supplierId: supplierIdFilter,
          OR: [{ validTo: null }, { validTo: { gte: validFrom } }],
          validFrom: { lte: validToDto ?? new Date("9999-12-31") },
        },
      });
      for (const row of overlapping) {
        await tx.productPrice.update({
          where: { id: row.id },
          data: { validTo: closeDate },
        });
      }
      await tx.productPrice.create({
        data: {
          productId: dto.productId,
          supplierId: dto.supplierId ?? null,
          price: dto.price,
          cost: dto.cost ?? null,
          purchasePrice: dto.purchasePrice ?? null,
          currency: dto.currency?.trim() ?? "CLP",
          priceListType: dto.priceListType?.trim() ?? "BASE",
          validFrom,
          validTo: validToDto ?? null,
          lastQuoteReceivedAt: dto.lastQuoteReceivedAt
            ? parseDate(dto.lastQuoteReceivedAt)
            : null,
          lastUpdatedAt: dto.lastUpdatedAt
            ? parseDate(dto.lastUpdatedAt)
            : null,
          suggestedMarginPercent: dto.suggestedMarginPercent ?? null,
          supplierDiscountPercent: dto.supplierDiscountPercent ?? null,
          logisticCostEstimate: dto.logisticCostEstimate ?? null,
          customsCostEstimate: dto.customsCostEstimate ?? null,
          totalLandedCost: dto.totalLandedCost ?? null,
          moq: dto.moq?.trim() ?? null,
          warranty: dto.warranty?.trim() ?? null,
          quoteReference: dto.quoteReference?.trim() ?? null,
          quoteReceivedAt: dto.quoteReceivedAt
            ? parseDate(dto.quoteReceivedAt)
            : null,
          validityIndicator: dto.validityIndicator?.trim() ?? null,
          internalCommercialNotes: dto.internalCommercialNotes?.trim() ?? null,
          updatedById: dto.updatedById ?? null,
        },
      });
    });
    const created = await this.prisma.productPrice.findFirst({
      where: {
        productId: dto.productId,
        supplierId: dto.supplierId ?? null,
        validFrom,
      },
      orderBy: { createdAt: "desc" },
      include: { product: true, supplier: true, updatedBy: true },
    });
    return created;
  }

  /**
   * Cierra una fila de precio cuya vigencia sigue abierta (`validTo` null).
   * No borra el registro: mantiene histórico para cotizaciones y auditoría.
   */
  async closeOpenValidity(
    id: string,
    body: { validTo?: string } | undefined,
    currentUser: AuthUserPayload,
  ) {
    const price = await this.prisma.productPrice.findUnique({
      where: { id },
    });
    if (!price) {
      throw new NotFoundException(`Precio con id ${id} no encontrado`);
    }
    if (price.validTo != null) {
      throw new ConflictException(
        "Este precio ya tiene fin de vigencia; no se puede cerrar de nuevo.",
      );
    }
    const validTo = body?.validTo?.trim()
      ? parseDate(body.validTo.trim())
      : endOfUtcDay(new Date());
    const validFrom =
      price.validFrom instanceof Date
        ? price.validFrom
        : new Date(price.validFrom as string);
    if (validTo.getTime() < validFrom.getTime()) {
      throw new BadRequestException(
        "La fecha de fin de vigencia no puede ser anterior al inicio del precio.",
      );
    }
    await this.prisma.productPrice.update({
      where: { id },
      data: { validTo },
    });
    return this.findOne(id, currentUser);
  }
}

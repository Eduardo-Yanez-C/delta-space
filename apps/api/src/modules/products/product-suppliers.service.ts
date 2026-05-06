import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { ProductsService } from "./products.service";
import type { CreateProductSupplierDto } from "./dto/create-product-supplier.dto";
import type { UpdateProductSupplierDto } from "./dto/update-product-supplier.dto";

@Injectable()
export class ProductSuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  async findByProduct(productId: string) {
    await this.productsService.findOne(productId);
    return this.prisma.productSupplier.findMany({
      where: { productId },
      include: { supplier: true },
      orderBy: [{ isPrimary: "desc" }, { supplier: { name: "asc" } }],
    });
  }

  async add(productId: string, dto: CreateProductSupplierDto) {
    await this.productsService.findOne(productId);
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException("Proveedor no encontrado");
    }
    if (!supplier.active) {
      throw new ConflictException("El proveedor está inactivo");
    }
    const existing = await this.prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: { productId, supplierId: dto.supplierId },
      },
    });
    if (existing) {
      throw new ConflictException(
        "Este proveedor ya está asociado al producto",
      );
    }
    const rel = await this.prisma.productSupplier.create({
      data: {
        productId,
        supplierId: dto.supplierId,
        isPrimary: dto.isPrimary ?? false,
        isAlternative: dto.isAlternative ?? false,
        leadTimeDays: dto.leadTimeDays ?? null,
        moq: dto.moq?.trim() ?? null,
        warranty: dto.warranty?.trim() ?? null,
        notes: dto.notes?.trim() ?? null,
      },
      include: { supplier: true },
    });
    if (dto.isPrimary) {
      await this.productsService.setPrimarySupplier(productId, dto.supplierId, {
        leadTimeDays: dto.leadTimeDays,
        moq: dto.moq,
        warranty: dto.warranty,
        notes: dto.notes,
      });
      return this.prisma.productSupplier.findUnique({
        where: { id: rel.id },
        include: { supplier: true },
      });
    }
    return rel;
  }

  async update(
    productId: string,
    supplierId: string,
    dto: UpdateProductSupplierDto,
  ) {
    const rel = await this.prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: { productId, supplierId },
      },
      include: { supplier: true },
    });
    if (!rel) {
      throw new NotFoundException("Asociación producto–proveedor no encontrada");
    }
    if (dto.isPrimary === true) {
      await this.productsService.setPrimarySupplier(productId, supplierId, {
        leadTimeDays: dto.leadTimeDays,
        moq: dto.moq,
        warranty: dto.warranty,
        notes: dto.notes,
      });
    } else if (dto.isPrimary === false && rel.isPrimary) {
      await this.productsService.setPrimarySupplier(productId, null);
    }
    return this.prisma.productSupplier.update({
      where: { id: rel.id },
      data: {
        ...(dto.isPrimary !== undefined && { isPrimary: dto.isPrimary }),
        ...(dto.isAlternative !== undefined && {
          isAlternative: dto.isAlternative,
        }),
        ...(dto.leadTimeDays !== undefined && {
          leadTimeDays: dto.leadTimeDays ?? null,
        }),
        ...(dto.moq !== undefined && { moq: dto.moq?.trim() ?? null }),
        ...(dto.warranty !== undefined && {
          warranty: dto.warranty?.trim() ?? null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() ?? null }),
      },
      include: { supplier: true },
    });
  }

  async remove(productId: string, supplierId: string) {
    const rel = await this.prisma.productSupplier.findUnique({
      where: {
        productId_supplierId: { productId, supplierId },
      },
    });
    if (!rel) {
      throw new NotFoundException("Asociación producto–proveedor no encontrada");
    }
    const priceCount = await this.prisma.productPrice.count({
      where: { productId, supplierId },
    });
    if (priceCount > 0) {
      throw new ConflictException(
        "No se puede eliminar la asociación porque existe historial de precios vinculado a este producto y proveedor. La trazabilidad comercial debe conservarse.",
      );
    }
    const wasPrimary = rel.isPrimary;
    await this.prisma.productSupplier.delete({
      where: { id: rel.id },
    });
    if (wasPrimary) {
      await this.productsService.setPrimarySupplier(productId, null);
    }
    return { deleted: true };
  }
}

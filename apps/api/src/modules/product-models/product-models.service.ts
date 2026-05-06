import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { CreateProductModelDto } from "./dto/create-product-model.dto";
import type { UpdateProductModelDto } from "./dto/update-product-model.dto";

@Injectable()
export class ProductModelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(brandId: number | undefined) {
    return this.prisma.productModel.findMany({
      where: brandId != null ? { brandId } : undefined,
      orderBy: [{ brandId: "asc" }, { name: "asc" }],
      include: { brand: true },
    });
  }

  async findOne(id: number) {
    const model = await this.prisma.productModel.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!model) {
      throw new NotFoundException(`Modelo con id ${id} no encontrado`);
    }
    return model;
  }

  async create(dto: CreateProductModelDto) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: dto.brandId },
    });
    if (!brand) {
      throw new NotFoundException("Marca no encontrada");
    }
    const name = dto.name.trim();
    const clash = await this.prisma.productModel.findUnique({
      where: { brandId_name: { brandId: dto.brandId, name } },
    });
    if (clash) {
      throw new ConflictException(
        `Ya existe el modelo «${name}» para esta marca`,
      );
    }
    return this.prisma.productModel.create({
      data: { brandId: dto.brandId, name },
      include: { brand: true },
    });
  }

  async update(id: number, dto: UpdateProductModelDto) {
    const existing = await this.findOne(id);
    const brandId = dto.brandId ?? existing.brandId;
    if (dto.brandId != null) {
      const brand = await this.prisma.brand.findUnique({
        where: { id: dto.brandId },
      });
      if (!brand) {
        throw new NotFoundException("Marca no encontrada");
      }
    }
    const name =
      dto.name !== undefined ? dto.name.trim() : existing.name;
    if (dto.name !== undefined || dto.brandId !== undefined) {
      const clash = await this.prisma.productModel.findFirst({
        where: {
          brandId,
          name,
          NOT: { id },
        },
      });
      if (clash) {
        throw new ConflictException(
          `Ya existe el modelo «${name}» para la marca indicada`,
        );
      }
    }
    return this.prisma.productModel.update({
      where: { id },
      data: {
        ...(dto.brandId !== undefined && { brandId: dto.brandId }),
        ...(dto.name !== undefined && { name: dto.name.trim() }),
      },
      include: { brand: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    const counts = await this.prisma.productModel.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            products: true,
            quoteItems: true,
            quoteItemLines: true,
          },
        },
      },
    });
    const c = counts?._count;
    if (!c) {
      throw new NotFoundException(`Modelo con id ${id} no encontrado`);
    }
    if (c.products > 0 || c.quoteItems > 0 || c.quoteItemLines > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${c.products} producto(s), ` +
          `${c.quoteItems} ítem(es) y ${c.quoteItemLines} línea(s) de cotización vinculadas.`,
      );
    }
    return this.prisma.productModel.delete({ where: { id } });
  }
}

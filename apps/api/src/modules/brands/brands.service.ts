import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { CreateBrandDto } from "./dto/create-brand.dto";
import type { UpdateBrandDto } from "./dto/update-brand.dto";

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.brand.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: number) {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: { models: true },
    });
    if (!brand) {
      throw new NotFoundException(`Marca con id ${id} no encontrada`);
    }
    return brand;
  }

  async create(dto: CreateBrandDto) {
    const name = dto.name.trim();
    const clash = await this.prisma.brand.findUnique({ where: { name } });
    if (clash) {
      throw new ConflictException(`Ya existe la marca «${name}»`);
    }
    return this.prisma.brand.create({ data: { name } });
  }

  async update(id: number, dto: UpdateBrandDto) {
    await this.findOne(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.prisma.brand.findFirst({
        where: { name, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException(`Ya existe la marca «${name}»`);
      }
    }
    return this.prisma.brand.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    const counts = await this.prisma.brand.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            products: true,
            models: true,
            quoteItems: true,
            quoteItemLines: true,
          },
        },
      },
    });
    const c = counts?._count;
    if (!c) {
      throw new NotFoundException(`Marca con id ${id} no encontrada`);
    }
    if (c.models > 0) {
      throw new ConflictException(
        `No se puede eliminar: la marca tiene ${c.models} modelo(s). Elimine o reasigne modelos primero.`,
      );
    }
    if (c.products > 0 || c.quoteItems > 0 || c.quoteItemLines > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${c.products} producto(s), ` +
          `${c.quoteItems} ítem(es) y ${c.quoteItemLines} línea(s) de cotización vinculadas.`,
      );
    }
    return this.prisma.brand.delete({ where: { id } });
  }
}

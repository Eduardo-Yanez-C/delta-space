import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { CreateCategoryDto } from "./dto/create-category.dto";
import type { UpdateCategoryDto } from "./dto/update-category.dto";

function normalizeSlug(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeChildren = true) {
    return this.prisma.productCategory.findMany({
      orderBy: { name: "asc" },
      include: includeChildren ? { children: true } : undefined,
    });
  }

  async findOne(id: number) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });
    if (!category) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    const slug = normalizeSlug(dto.slug);
    if (!slug) {
      throw new BadRequestException("slug inválido tras normalizar");
    }
    const clash = await this.prisma.productCategory.findUnique({
      where: { slug },
    });
    if (clash) {
      throw new ConflictException(`Ya existe categoría con slug «${slug}»`);
    }
    if (dto.parentId != null) {
      const parent = await this.prisma.productCategory.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException("Categoría padre no encontrada");
      }
    }
    return this.prisma.productCategory.create({
      data: {
        name: dto.name.trim(),
        slug,
        parentId: dto.parentId ?? null,
      },
    });
  }

  private async assertNoParentCycle(categoryId: number, newParentId: number | null) {
    if (newParentId == null) return;
    let cur: number | null = newParentId;
    const seen = new Set<number>();
    while (cur != null) {
      if (cur === categoryId) {
        throw new BadRequestException(
          "La categoría padre genera un ciclo en la jerarquía",
        );
      }
      if (seen.has(cur)) break;
      seen.add(cur);
      const row = await this.prisma.productCategory.findUnique({
        where: { id: cur },
        select: { parentId: true },
      });
      cur = row?.parentId ?? null;
    }
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.findOne(id);
    let slug: string | undefined;
    if (dto.slug !== undefined) {
      slug = normalizeSlug(dto.slug);
      if (!slug) {
        throw new BadRequestException("slug inválido tras normalizar");
      }
      const clash = await this.prisma.productCategory.findFirst({
        where: { slug, NOT: { id } },
      });
      if (clash) {
        throw new ConflictException(`Ya existe categoría con slug «${slug}»`);
      }
    }
    if (dto.parentId !== undefined) {
      if (dto.parentId != null) {
        const parent = await this.prisma.productCategory.findUnique({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException("Categoría padre no encontrada");
        }
        await this.assertNoParentCycle(id, dto.parentId);
      }
    }
    return this.prisma.productCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(slug !== undefined && { slug }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    const counts = await this.prisma.productCategory.findUnique({
      where: { id },
      select: {
        _count: {
          select: {
            products: true,
            children: true,
            quoteItems: true,
            quoteItemLines: true,
          },
        },
      },
    });
    const c = counts?._count;
    if (!c) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    if (c.children > 0) {
      throw new ConflictException(
        `No se puede eliminar: la categoría tiene ${c.children} subcategoría(s).`,
      );
    }
    if (c.products > 0 || c.quoteItems > 0 || c.quoteItemLines > 0) {
      throw new ConflictException(
        `No se puede eliminar: hay ${c.products} producto(s), ` +
          `${c.quoteItems} ítem(es) de cotización y ${c.quoteItemLines} línea(s) vinculadas.`,
      );
    }
    return this.prisma.productCategory.delete({ where: { id } });
  }
}

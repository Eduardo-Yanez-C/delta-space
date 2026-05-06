import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { CreateSupplierDto } from "./dto/create-supplier.dto";
import type { UpdateSupplierDto } from "./dto/update-supplier.dto";

const SUPPLY_ORIGINS = ["NACIONAL", "INTERNACIONAL"] as const;
const ACTOR_TYPES = [
  "FABRICANTE",
  "DISTRIBUIDOR",
  "REPRESENTANTE",
  "IMPORTADOR",
  "INTEGRADOR",
  "TRANSPORTISTA",
] as const;

function validateSupplyOrigin(value: string) {
  if (!SUPPLY_ORIGINS.includes(value as (typeof SUPPLY_ORIGINS)[number])) {
    throw new BadRequestException(
      `supplyOrigin debe ser uno de: ${SUPPLY_ORIGINS.join(", ")}`,
    );
  }
}

function validateActorType(value: string) {
  if (!ACTOR_TYPES.includes(value as (typeof ACTOR_TYPES)[number])) {
    throw new BadRequestException(
      `actorType debe ser uno de: ${ACTOR_TYPES.join(", ")}`,
    );
  }
}

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: {
    supplyOrigin?: string;
    actorType?: string;
    active?: boolean;
  }) {
    const where: Record<string, unknown> = {};
    if (filters.supplyOrigin != null) {
      validateSupplyOrigin(filters.supplyOrigin);
      where.supplyOrigin = filters.supplyOrigin;
    }
    if (filters.actorType != null) {
      validateActorType(filters.actorType);
      where.actorType = filters.actorType;
    }
    if (filters.active !== undefined) {
      where.active = filters.active;
    }
    return this.prisma.supplier.findMany({
      where: where as never,
      orderBy: { name: "asc" },
    });
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
    });
    if (!supplier) {
      throw new NotFoundException(`Proveedor con id ${id} no encontrado`);
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto) {
    if (!dto.name?.trim()) {
      throw new BadRequestException("name es obligatorio");
    }
    validateSupplyOrigin(dto.supplyOrigin);
    validateActorType(dto.actorType);
    return this.prisma.supplier.create({
      data: {
        name: dto.name.trim(),
        legalName: dto.legalName?.trim() ?? null,
        taxId: dto.taxId?.trim() ?? null,
        giro: dto.giro?.trim() ?? null,
        commercialAddress: dto.commercialAddress?.trim() ?? null,
        contactName: dto.contactName?.trim() ?? null,
        email: dto.email?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        country: dto.country?.trim() ?? null,
        city: dto.city?.trim() ?? null,
        defaultCurrency: dto.defaultCurrency?.trim() ?? null,
        supplyOrigin: dto.supplyOrigin,
        actorType: dto.actorType,
        paymentTerms: dto.paymentTerms?.trim() ?? null,
        leadTimeDays: dto.leadTimeDays ?? null,
        notes: dto.notes?.trim() ?? null,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    if (dto.supplyOrigin != null) {
      validateSupplyOrigin(dto.supplyOrigin);
    }
    if (dto.actorType != null) {
      validateActorType(dto.actorType);
    }
    if (dto.name !== undefined && !dto.name?.trim()) {
      throw new BadRequestException("name no puede estar vacío");
    }
    return this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.legalName !== undefined && {
          legalName: dto.legalName?.trim() ?? null,
        }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId?.trim() ?? null }),
        ...(dto.giro !== undefined && { giro: dto.giro?.trim() ?? null }),
        ...(dto.commercialAddress !== undefined && {
          commercialAddress: dto.commercialAddress?.trim() ?? null,
        }),
        ...(dto.contactName !== undefined && {
          contactName: dto.contactName?.trim() ?? null,
        }),
        ...(dto.email !== undefined && {
          email: dto.email?.trim() ?? null,
        }),
        ...(dto.phone !== undefined && {
          phone: dto.phone?.trim() ?? null,
        }),
        ...(dto.country !== undefined && {
          country: dto.country?.trim() ?? null,
        }),
        ...(dto.city !== undefined && { city: dto.city?.trim() ?? null }),
        ...(dto.defaultCurrency !== undefined && {
          defaultCurrency: dto.defaultCurrency?.trim() ?? null,
        }),
        ...(dto.supplyOrigin !== undefined && {
          supplyOrigin: dto.supplyOrigin,
        }),
        ...(dto.actorType !== undefined && { actorType: dto.actorType }),
        ...(dto.paymentTerms !== undefined && {
          paymentTerms: dto.paymentTerms?.trim() ?? null,
        }),
        ...(dto.leadTimeDays !== undefined && {
          leadTimeDays: dto.leadTimeDays ?? null,
        }),
        ...(dto.notes !== undefined && {
          notes: dto.notes?.trim() ?? null,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { active: false },
    });
  }

  async activate(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { active: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.updateMany({
          where: { primarySupplierId: id },
          data: { primarySupplierId: null },
        });
        await tx.productSupplier.deleteMany({ where: { supplierId: id } });
        await tx.productPrice.deleteMany({ where: { supplierId: id } });
        await tx.supplier.delete({ where: { id } });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        throw new BadRequestException(
          "No se puede eliminar: el proveedor sigue referenciado en datos vinculados.",
        );
      }
      throw e;
    }
    return { deleted: true };
  }
}

import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { hasGlobalAdminPrivileges } from "../auth/role-constants";
import type { AuthUserPayload } from "../auth/auth.service";
import type { CreateClientDto } from "./dto/create-client.dto";
import type { UpdateClientDto } from "./dto/update-client.dto";

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: AuthUserPayload) {
    const where = hasGlobalAdminPrivileges(currentUser.roles) ? {} : { companyId: currentUser.companyId };
    return this.prisma.client.findMany({ where, orderBy: { name: "asc" } });
  }

  async findOne(id: string, currentUser: AuthUserPayload) {
    const client = await this.prisma.client.findUnique({
      where: { id },
    });
    if (!client) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }
    if (!hasGlobalAdminPrivileges(currentUser.roles) && client.companyId !== currentUser.companyId) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }
    return client;
  }

  async create(dto: CreateClientDto, currentUser: AuthUserPayload) {
    return this.prisma.client.create({
      data: {
        companyId: currentUser.companyId,
        type: dto.type,
        name: dto.name,
        taxId: dto.taxId ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        notes: dto.notes ?? null,
      },
    });
  }

  async update(id: string, dto: UpdateClientDto, currentUser: AuthUserPayload) {
    await this.findOne(id, currentUser);
    return this.prisma.client.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(id: string, currentUser: AuthUserPayload) {
    await this.findOne(id, currentUser);
    const counts = await this.prisma.client.findUnique({
      where: { id },
      select: {
        _count: {
          select: { quotes: true, fvStudies: true },
        },
      },
    });
    const q = counts?._count.quotes ?? 0;
    const s = counts?._count.fvStudies ?? 0;
    if (q > 0 || s > 0) {
      throw new ConflictException(
        `No se puede eliminar el cliente: tiene ${q} cotización(es) y ${s} estudio(s) FV vinculados. ` +
          "Elimine o reasigne esas entidades antes, o deje el registro y use solo edición de datos.",
      );
    }
    return this.prisma.client.delete({
      where: { id },
    });
  }
}

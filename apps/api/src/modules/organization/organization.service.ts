import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateOrgCustomEdgeDto } from "./dto/create-org-custom-edge.dto";
import { CreateOrgNodeDto } from "./dto/create-org-node.dto";
import { UpdateOrgCustomEdgeDto } from "./dto/update-org-custom-edge.dto";
import { UpdateOrgNodeDto } from "./dto/update-org-node.dto";

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  findTree() {
    return this.prisma.organizationNode.findMany({
      orderBy: [{ parentId: "asc" }, { order: "asc" }, { name: "asc" }],
    });
  }

  findCustomEdges() {
    return this.prisma.organizationCustomEdge.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async createCustomEdge(dto: CreateOrgCustomEdgeDto) {
    if (dto.fromNodeId === dto.toNodeId) {
      throw new BadRequestException("No se puede conectar un cargo consigo mismo");
    }
    await this.ensureNode(dto.fromNodeId);
    await this.ensureNode(dto.toNodeId);
    const rawColor = dto.color?.trim();
    const color = rawColor && /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? rawColor : "#64748b";
    try {
      return await this.prisma.organizationCustomEdge.create({
        data: {
          fromNodeId: dto.fromNodeId,
          toNodeId: dto.toNodeId,
          color,
          strokeWidth: dto.strokeWidth ?? 2,
          dashPattern: dto.dashPattern?.trim() || null,
          midOffsetX: dto.midOffsetX ?? 0,
          midOffsetY: dto.midOffsetY ?? 0,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new BadRequestException("Ya existe una conexión libre entre esos dos cargos");
      }
      throw e;
    }
  }

  async updateCustomEdge(id: string, dto: UpdateOrgCustomEdgeDto) {
    const data: {
      color?: string;
      strokeWidth?: number;
      dashPattern?: string | null;
      midOffsetX?: number;
      midOffsetY?: number;
    } = {};
    if (dto.color !== undefined) {
      const raw = dto.color?.trim() ?? "";
      data.color = raw && /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : "#64748b";
    }
    if (dto.strokeWidth !== undefined) data.strokeWidth = dto.strokeWidth;
    if (dto.dashPattern !== undefined) data.dashPattern = dto.dashPattern?.trim() || null;
    if (dto.midOffsetX !== undefined) data.midOffsetX = dto.midOffsetX;
    if (dto.midOffsetY !== undefined) data.midOffsetY = dto.midOffsetY;
    try {
      if (Object.keys(data).length === 0) {
        const row = await this.prisma.organizationCustomEdge.findUnique({ where: { id } });
        if (!row) throw new NotFoundException("Conexión no encontrada");
        return row;
      }
      return await this.prisma.organizationCustomEdge.update({ where: { id }, data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundException("Conexión no encontrada");
      }
      throw e;
    }
  }

  async removeCustomEdge(id: string) {
    try {
      await this.prisma.organizationCustomEdge.delete({ where: { id } });
      return { deleted: true };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        throw new NotFoundException("Conexión no encontrada");
      }
      throw e;
    }
  }

  async create(dto: CreateOrgNodeDto) {
    if (dto.parentId) {
      await this.ensureNode(dto.parentId);
    }
    if (dto.linkToId) {
      await this.ensureNode(dto.linkToId);
    }
    return this.prisma.organizationNode.create({
      data: {
        name: dto.name,
        role: dto.role,
        category: dto.category?.trim() || null,
        parentId: dto.parentId ?? null,
        linkToId: dto.linkToId ?? null,
        photoUrl: dto.photoUrl ?? null,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        order: dto.order ?? 0,
        active: dto.active ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateOrgNodeDto) {
    await this.ensureNode(id);
    if (dto.parentId === id) throw new BadRequestException("Un nodo no puede ser padre de sí mismo");
    if (dto.parentId) {
      await this.ensureNode(dto.parentId);
      const wouldCycle = await this.wouldCreateCycle(id, dto.parentId);
      if (wouldCycle) throw new BadRequestException("No se permite un ciclo en el organigrama");
    }
    if (dto.linkToId !== undefined && dto.linkToId) {
      if (dto.linkToId === id) throw new BadRequestException("El enlace de consultoría no puede apuntar al mismo nodo");
      await this.ensureNode(dto.linkToId);
    }
    const data: {
      name?: string;
      role?: string;
      category?: string | null;
      parentId?: string | null;
      linkToId?: string | null;
      photoUrl?: string | null;
      email?: string | null;
      phone?: string | null;
      order?: number;
      active?: boolean;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.category !== undefined) data.category = dto.category?.trim() || null;
    if (dto.parentId !== undefined) data.parentId = dto.parentId || null;
    if (dto.linkToId !== undefined) data.linkToId = dto.linkToId || null;
    if (dto.photoUrl !== undefined) data.photoUrl = dto.photoUrl || null;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.phone !== undefined) data.phone = dto.phone || null;
    if (dto.order !== undefined) data.order = dto.order;
    if (dto.active !== undefined) data.active = dto.active;
    return this.prisma.organizationNode.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.ensureNode(id);
    const children = await this.prisma.organizationNode.count({ where: { parentId: id } });
    if (children > 0) {
      throw new BadRequestException("Elimine o reasigne los nodos hijos primero");
    }
    await this.prisma.organizationNode.delete({ where: { id } });
    return { deleted: true };
  }

  private async ensureNode(id: string) {
    const n = await this.prisma.organizationNode.count({ where: { id } });
    if (!n) throw new NotFoundException("Nodo no encontrado");
  }

  private async wouldCreateCycle(nodeId: string, parentId: string): Promise<boolean> {
    let current: string | null = parentId;
    const seen = new Set<string>();
    while (current) {
      if (current === nodeId) return true;
      if (seen.has(current)) break;
      seen.add(current);
      const row: { parentId: string | null } | null = await this.prisma.organizationNode.findUnique({
        where: { id: current },
        select: { parentId: true },
      });
      current = row?.parentId ?? null;
    }
    return false;
  }
}

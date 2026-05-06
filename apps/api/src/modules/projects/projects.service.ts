import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { buildProjectWorkspacePayload } from "./project-workspace.builder";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.project.findMany({ orderBy: [{ updatedAt: "desc" }] });
  }

  getWorkspace(id: string) {
    return buildProjectWorkspacePayload(this.prisma, id);
  }

  async findOne(id: string) {
    const p = await this.prisma.project.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            risks: true,
            tasks: true,
            documents: true,
            commitments: true,
            resources: true,
          },
        },
        commercialLinks: { orderBy: { createdAt: "desc" } },
        milestones: { orderBy: { plannedDate: "asc" } },
        decisions: { orderBy: { decisionDate: "desc" }, take: 50 },
        locations: { orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }] },
      },
    });
    if (!p) throw new NotFoundException("Proyecto no encontrado");
    const { _count, commercialLinks, milestones, decisions, locations, ...rest } = p;
    let taskStatusConfig: unknown = null;
    if (rest.taskStatusConfig && typeof rest.taskStatusConfig === "string") {
      try {
        taskStatusConfig = JSON.parse(rest.taskStatusConfig) as unknown;
      } catch {
        taskStatusConfig = null;
      }
    }
    let logisticsTransportStatusConfig: unknown = null;
    if (rest.logisticsTransportStatusConfig && typeof rest.logisticsTransportStatusConfig === "string") {
      try {
        logisticsTransportStatusConfig = JSON.parse(rest.logisticsTransportStatusConfig) as unknown;
      } catch {
        logisticsTransportStatusConfig = null;
      }
    }
    const { taskStatusConfig: _raw, logisticsTransportStatusConfig: _rawL, ...restNoCfg } = rest;
    return {
      ...restNoCfg,
      taskStatusConfig,
      logisticsTransportStatusConfig,
      commercialLinks,
      milestones,
      decisions,
      locations,
      _count: {
        tasks: _count.tasks,
        documents: _count.documents,
        risks: _count.risks,
        resources: _count.resources,
        commitments: _count.commitments,
      },
    };
  }

  async replaceLocations(id: string, locations: Array<{
    kind: string;
    label: string;
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    notes?: string | null;
    isPrimary?: boolean | null;
  }>) {
    const exists = await this.prisma.project.count({ where: { id } });
    if (!exists) throw new NotFoundException("Proyecto no encontrado");
    if (!Array.isArray(locations)) throw new BadRequestException("locations inválido");

    const clean = locations
      .map((x) => ({
        kind: String(x.kind ?? "SITE").trim() || "SITE",
        label: String(x.label ?? "").trim(),
        address: x.address != null ? String(x.address).trim() || null : null,
        latitude: x.latitude != null && Number.isFinite(Number(x.latitude)) ? Number(x.latitude) : null,
        longitude: x.longitude != null && Number.isFinite(Number(x.longitude)) ? Number(x.longitude) : null,
        notes: x.notes != null ? String(x.notes).trim() || null : null,
        isPrimary: Boolean(x.isPrimary),
      }))
      .filter((x) => x.label);

    if (clean.length === 0) throw new BadRequestException("Debe indicar al menos una ubicación con label");

    // Normalizar: solo una primaria
    let primarySet = false;
    const normalized = clean.map((x) => {
      if (x.isPrimary && !primarySet) {
        primarySet = true;
        return x;
      }
      return { ...x, isPrimary: false };
    });
    if (!primarySet) normalized[0] = { ...normalized[0]!, isPrimary: true };

    await this.prisma.$transaction(async (tx) => {
      await tx.projectLocation.deleteMany({ where: { projectId: id } });
      await tx.projectLocation.createMany({
        data: normalized.map((x) => ({
          projectId: id,
          kind: x.kind,
          label: x.label,
          address: x.address,
          latitude: x.latitude,
          longitude: x.longitude,
          notes: x.notes,
          isPrimary: x.isPrimary,
        })),
      });
    });

    return this.prisma.projectLocation.findMany({
      where: { projectId: id },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
    });
  }

  async create(dto: CreateProjectDto) {
    const code = dto.code.trim();
    const name = dto.name.trim();
    if (!code) throw new BadRequestException("code es requerido");
    if (!name) throw new BadRequestException("name es requerido");
    const client = dto.client?.trim() || "—";
    const status = dto.status?.trim() || "ACTIVE";
    const location = dto.location?.trim() || null;
    const description = dto.description?.trim() || null;
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.endDate ? new Date(dto.endDate) : null;
    const progress = dto.progress != null && Number.isFinite(Number(dto.progress)) ? Number(dto.progress) : 0;

    try {
      return await this.prisma.project.create({
        data: {
          code,
          name,
          client,
          status,
          location,
          description,
          startDate,
          endDate,
          progress,
        },
      });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        throw new BadRequestException("Ya existe un proyecto con ese code");
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateProjectDto) {
    const exists = await this.prisma.project.count({ where: { id } });
    if (!exists) throw new NotFoundException("Proyecto no encontrado");
    const data: {
      code?: string;
      name?: string;
      client?: string;
      status?: string;
      location?: string | null;
      description?: string | null;
      startDate?: Date;
      endDate?: Date | null;
      progress?: number;
      taskStatusConfig?: string;
      logisticsTransportStatusConfig?: string;
      transportVariableProfileId?: string | null;
    } = {};

    if (dto.code !== undefined) {
      const c = dto.code.trim();
      if (!c) throw new BadRequestException("code no puede quedar vacío");
      data.code = c;
    }
    if (dto.name !== undefined) {
      const n = dto.name.trim();
      if (!n) throw new BadRequestException("name no puede quedar vacío");
      data.name = n;
    }
    if (dto.client !== undefined) data.client = dto.client.trim() || "—";
    if (dto.status !== undefined) data.status = dto.status.trim() || "ACTIVE";
    if (dto.location !== undefined) data.location = dto.location?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = dto.endDate ? new Date(dto.endDate) : null;
    if (dto.progress !== undefined) {
      const p = Number(dto.progress);
      if (!Number.isFinite(p)) throw new BadRequestException("progress inválido");
      data.progress = p;
    }
    if (dto.taskStatusConfig !== undefined) {
      data.taskStatusConfig = JSON.stringify(dto.taskStatusConfig);
    }
    if (dto.logisticsTransportStatusConfig !== undefined) {
      data.logisticsTransportStatusConfig = JSON.stringify(dto.logisticsTransportStatusConfig);
    }
    if (dto.transportVariableProfileId !== undefined) {
      const raw = dto.transportVariableProfileId?.trim() ?? "";
      if (!raw) {
        data.transportVariableProfileId = null;
      } else {
        const p = await this.prisma.transportVariableProfile.count({ where: { id: raw } });
        if (!p) throw new BadRequestException("Perfil de variables no existe.");
        data.transportVariableProfileId = raw;
      }
    }

    try {
      return await this.prisma.project.update({ where: { id }, data });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        throw new BadRequestException("Ya existe un proyecto con ese code");
      }
      throw e;
    }
  }
}

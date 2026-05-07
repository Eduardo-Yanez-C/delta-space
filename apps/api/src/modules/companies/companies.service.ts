import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { AuditLogService } from "../audit-log/audit-log.service";
import type { AuthUserPayload } from "../auth/auth.service";
import type { CreateCompanyDto } from "./dto/create-company.dto";
import type { UpdateCompanyDto } from "./dto/update-company.dto";

function normalizeSlug(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  const clean = s
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
  return clean;
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll() {
    return this.prisma.company.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.company.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Empresa no encontrada");
    return row;
  }

  async create(dto: CreateCompanyDto, actor: AuthUserPayload) {
    const name = String(dto.name ?? "").trim();
    if (!name) throw new BadRequestException("name es obligatorio");
    const slug = normalizeSlug(dto.slug);
    if (!slug) throw new BadRequestException("slug es obligatorio");
    const exists = await this.prisma.company.findUnique({ where: { slug } });
    if (exists) throw new ConflictException("Ya existe una empresa con ese slug");
    const created = await this.prisma.company.create({
      data: { name, slug, active: dto.active ?? true },
    });
    await this.audit.write(actor, {
      action: "CREATE",
      entityType: "Company",
      entityId: created.id,
      entityCompanyId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateCompanyDto, actor: AuthUserPayload) {
    const before = await this.findOne(id);
    const patch: { name?: string; slug?: string; active?: boolean } = {};
    if (dto.name !== undefined) {
      const name = String(dto.name ?? "").trim();
      if (!name) throw new BadRequestException("name no puede ser vacío");
      patch.name = name;
    }
    if (dto.slug !== undefined) {
      const slug = normalizeSlug(dto.slug);
      if (!slug) throw new BadRequestException("slug no puede ser vacío");
      const exists = await this.prisma.company.findUnique({ where: { slug } });
      if (exists && exists.id !== id) throw new ConflictException("Ya existe una empresa con ese slug");
      patch.slug = slug;
    }
    if (dto.active !== undefined) {
      patch.active = !!dto.active;
    }
    const updated = await this.prisma.company.update({ where: { id }, data: patch });
    await this.audit.write(actor, {
      action: "UPDATE",
      entityType: "Company",
      entityId: id,
      entityCompanyId: updated.id,
      before,
      after: updated,
    });
    return updated;
  }
}


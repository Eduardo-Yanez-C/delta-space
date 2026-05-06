import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TransportVariableValue } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateTransportVariableDto } from "./dto/create-transport-variable.dto";
import { CreateTransportVariableProfileDto } from "./dto/create-transport-variable-profile.dto";
import { CreateTransportVariableValueDto } from "./dto/create-transport-variable-value.dto";
import { UpdateTransportVariableDto } from "./dto/update-transport-variable.dto";
import { UpdateTransportVariableProfileDto } from "./dto/update-transport-variable-profile.dto";
import { UpdateTransportVariableValueDto } from "./dto/update-transport-variable-value.dto";

const SOURCES = new Set(["MANUAL", "API", "IMPORT"]);

function normStr(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t || null;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new BadRequestException("Fecha inválida.");
  return d;
}

function parseDateRequired(s: string): Date {
  const d = parseDate(s);
  if (!d) throw new BadRequestException("Fecha requerida.");
  return d;
}

/** Normaliza clave tipo DIESEL_SANTIAGO. */
export function normalizeVariableKey(raw: string): string {
  const t = raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "");
  if (t.length < 2) throw new BadRequestException("La clave debe tener al menos 2 caracteres (A–Z, 0–9, _).");
  if (t.length > 64) throw new BadRequestException("Clave demasiado larga.");
  return t;
}

function assertSource(s: string | undefined): string {
  const x = (s ?? "MANUAL").trim().toUpperCase();
  if (!SOURCES.has(x)) throw new BadRequestException(`source debe ser: ${[...SOURCES].join(", ")}`);
  return x;
}

function inValidityWindow(row: { validFrom: Date; validTo: Date | null }, at: Date): boolean {
  if (row.validFrom.getTime() > at.getTime()) return false;
  if (row.validTo && row.validTo.getTime() < at.getTime()) return false;
  return true;
}

function pickNewestValid(rows: TransportVariableValue[], at: Date, profileId: string | null): TransportVariableValue | null {
  const inWin = rows.filter((r) => inValidityWindow(r, at));
  if (profileId) {
    const scoped = inWin.filter((r) => r.profileId === profileId);
    if (scoped.length) {
      scoped.sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
      return scoped[0] ?? null;
    }
  }
  const global = inWin.filter((r) => r.profileId === null);
  if (!global.length) return null;
  global.sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime());
  return global[0] ?? null;
}

@Injectable()
export class TransportVariablesService {
  constructor(private readonly prisma: PrismaService) {}

  async listProfiles() {
    return this.prisma.transportVariableProfile.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { values: true, contracts: true, projects: true } },
      },
    });
  }

  async createProfile(dto: CreateTransportVariableProfileDto) {
    return this.prisma.transportVariableProfile.create({
      data: {
        name: dto.name.trim(),
        notes: normStr(dto.notes),
      },
    });
  }

  async updateProfile(id: string, dto: UpdateTransportVariableProfileDto) {
    const exists = await this.prisma.transportVariableProfile.count({ where: { id } });
    if (!exists) throw new NotFoundException("Perfil no encontrado.");
    return this.prisma.transportVariableProfile.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        notes: dto.notes !== undefined ? normStr(dto.notes) : undefined,
      },
    });
  }

  async deleteProfile(id: string) {
    const exists = await this.prisma.transportVariableProfile.findUnique({
      where: { id },
      include: { _count: { select: { values: true } } },
    });
    if (!exists) throw new NotFoundException("Perfil no encontrado.");
    await this.prisma.transportVariableProfile.delete({ where: { id } });
    return { ok: true as const };
  }

  async listVariables() {
    return this.prisma.transportVariable.findMany({
      orderBy: [{ active: "desc" }, { key: "asc" }],
      include: { _count: { select: { values: true } } },
    });
  }

  async getVariable(id: string) {
    const v = await this.prisma.transportVariable.findUnique({
      where: { id },
      include: {
        values: { orderBy: { validFrom: "desc" }, include: { profile: { select: { id: true, name: true } } } },
      },
    });
    if (!v) throw new NotFoundException("Variable no encontrada.");
    const { values, ...rest } = v;
    return { ...rest, _count: { values: values.length }, values };
  }

  async createVariable(dto: CreateTransportVariableDto) {
    const key = normalizeVariableKey(dto.key);
    const v = await this.prisma.transportVariable.create({
      data: {
        key,
        label: dto.label.trim(),
        description: normStr(dto.description),
        defaultUnit: normStr(dto.defaultUnit),
        active: dto.active !== false,
      },
    });
    return { ...v, _count: { values: 0 } };
  }

  async updateVariable(id: string, dto: UpdateTransportVariableDto) {
    const exists = await this.prisma.transportVariable.count({ where: { id } });
    if (!exists) throw new NotFoundException("Variable no encontrada.");
    const v = await this.prisma.transportVariable.update({
      where: { id },
      data: {
        label: dto.label !== undefined ? dto.label.trim() : undefined,
        description: dto.description !== undefined ? normStr(dto.description) : undefined,
        defaultUnit: dto.defaultUnit !== undefined ? normStr(dto.defaultUnit) : undefined,
        active: dto.active !== undefined ? dto.active : undefined,
      },
    });
    const cnt = await this.prisma.transportVariableValue.count({ where: { variableId: id } });
    return { ...v, _count: { values: cnt } };
  }

  async deleteVariable(id: string) {
    const exists = await this.prisma.transportVariable.count({ where: { id } });
    if (!exists) throw new NotFoundException("Variable no encontrada.");
    await this.prisma.transportVariable.update({ where: { id }, data: { active: false } });
    return { ok: true as const };
  }

  async listValues(variableId: string, profileId?: string | null) {
    await this.getVariable(variableId);
    const where: Prisma.TransportVariableValueWhereInput = { variableId };
    if (profileId === "") {
      where.profileId = null;
    } else if (profileId?.trim()) {
      where.profileId = profileId.trim();
    }
    return this.prisma.transportVariableValue.findMany({
      where,
      orderBy: { validFrom: "desc" },
      include: { profile: { select: { id: true, name: true } } },
    });
  }

  async createValue(variableId: string, dto: CreateTransportVariableValueDto) {
    await this.getVariable(variableId);
    const profileId = normStr(dto.profileId);
    if (profileId) {
      const p = await this.prisma.transportVariableProfile.count({ where: { id: profileId } });
      if (!p) throw new BadRequestException("Perfil no existe.");
    }
    const source = assertSource(dto.source);
    const validFrom = parseDateRequired(dto.validFrom);
    const validTo = parseDate(dto.validTo ?? null);
    return this.prisma.transportVariableValue.create({
      data: {
        variableId,
        profileId,
        value: dto.value,
        unit: normStr(dto.unit),
        validFrom,
        validTo,
        source,
        note: normStr(dto.note),
      },
      include: { profile: { select: { id: true, name: true } } },
    });
  }

  async updateValue(variableId: string, valueId: string, dto: UpdateTransportVariableValueDto) {
    const row = await this.prisma.transportVariableValue.findFirst({
      where: { id: valueId, variableId },
    });
    if (!row) throw new NotFoundException("Valor no encontrado.");
    if (dto.profileId !== undefined) {
      const pid = normStr(dto.profileId);
      if (pid) {
        const p = await this.prisma.transportVariableProfile.count({ where: { id: pid } });
        if (!p) throw new BadRequestException("Perfil no existe.");
      }
    }
    return this.prisma.transportVariableValue.update({
      where: { id: valueId },
      data: {
        value: dto.value !== undefined ? dto.value : undefined,
        unit: dto.unit !== undefined ? normStr(dto.unit) : undefined,
        validFrom: dto.validFrom !== undefined ? parseDateRequired(dto.validFrom) : undefined,
        validTo: dto.validTo !== undefined ? parseDate(dto.validTo ?? null) : undefined,
        profileId: dto.profileId !== undefined ? normStr(dto.profileId) : undefined,
        source: dto.source !== undefined ? assertSource(dto.source) : undefined,
        note: dto.note !== undefined ? normStr(dto.note) : undefined,
      },
      include: { profile: { select: { id: true, name: true } } },
    });
  }

  async deleteValue(variableId: string, valueId: string) {
    const row = await this.prisma.transportVariableValue.findFirst({
      where: { id: valueId, variableId },
    });
    if (!row) throw new NotFoundException("Valor no encontrado.");
    await this.prisma.transportVariableValue.delete({ where: { id: valueId } });
    return { ok: true as const };
  }

  /**
   * Resuelve valores vigentes a una fecha. Si `profileId` es null, solo filas globales (profileId null).
   * Si tiene perfil: primero filas de ese perfil; si no hay, cae a global.
   */
  async resolveAt(at: Date, profileId: string | null, keys?: string[] | null) {
    const whereVar: Prisma.TransportVariableWhereInput = { active: true };
    if (keys?.length) {
      const normKeys = keys.map((k) => normalizeVariableKey(k));
      whereVar.key = { in: normKeys };
    }
    const variables = await this.prisma.transportVariable.findMany({
      where: whereVar,
      include: { values: true },
    });
    return variables.map((v) => {
      const picked = pickNewestValid(v.values, at, profileId);
      const unit = picked?.unit?.trim() || v.defaultUnit?.trim() || null;
      return {
        variableId: v.id,
        key: v.key,
        label: v.label,
        defaultUnit: v.defaultUnit,
        resolved: picked
          ? {
              valueId: picked.id,
              value: picked.value,
              unit,
              validFrom: picked.validFrom.toISOString(),
              validTo: picked.validTo?.toISOString() ?? null,
              source: picked.source,
              profileId: picked.profileId,
            }
          : null,
      };
    });
  }
}

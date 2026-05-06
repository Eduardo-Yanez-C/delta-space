import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { buildMrbMatrixV1, mrbMatrixToLegacyFields } from "../../common/mrb-matrix";
import { CreateRiskDto } from "./dto/create-risk.dto";
import { UpdateRiskDto } from "./dto/update-risk.dto";
import { normalizeMatrixKind, normalizeRiskCategory, type RiskCategoryCode } from "./risk-category.constants";
import { isHighInherentSeverity, isRiskOpen, riskInherentFromRow } from "./risk-inherent.util";

function csvEscape(val: string): string {
  const v = String(val ?? "");
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function csvRow(cols: string[]): string {
  return `${cols.map(csvEscape).join(",")}\n`;
}

@Injectable()
export class RisksService {
  constructor(private readonly prisma: PrismaService) {}

  private parseMrbMatrix(mrbMatrix: string | null): Record<string, unknown> | null {
    if (!mrbMatrix) return null;
    try {
      const j = JSON.parse(mrbMatrix) as unknown;
      if (j && typeof j === "object") return j as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  }

  private withParsedMatrix<T extends { mrbMatrix?: string | null }>(
    row: T,
  ): Omit<T, "mrbMatrix"> & { mrbMatrix?: Record<string, unknown> | null } {
    const { mrbMatrix, ...rest } = row;
    return { ...(rest as Omit<T, "mrbMatrix">), mrbMatrix: this.parseMrbMatrix(mrbMatrix ?? null) };
  }

  async listByProject(projectId: string, filters?: { matrixKind?: string }) {
    await this.ensureProject(projectId);
    const where: string[] = ["projectId = ?"];
    const args: unknown[] = [projectId];
    if (filters?.matrixKind?.trim()) {
      where.push("matrixKind = ?");
      args.push(normalizeMatrixKind(filters.matrixKind));
    }
    const sql =
      "SELECT id, description, severity, probability, mitigation, status, owner, ownerUserId, dueDate, mrbMatrix, riskCategory, matrixKind, createdAt, updatedAt " +
      `FROM Risk WHERE ${where.join(" AND ")} ORDER BY updatedAt DESC`;
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, any>>>(sql, ...args);
    return rows.map((r) => this.withParsedMatrix(r as { mrbMatrix?: string | null }));
  }

  async exportCsv(projectId: string): Promise<{ filename: string; content: string }> {
    const proj = await this.prisma.$queryRawUnsafe<Array<{ code: string }>>("SELECT code FROM Project WHERE id = ?", projectId);
    if (!proj[0]?.code) throw new NotFoundException("Proyecto no encontrado");
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, any>>>("SELECT * FROM Risk WHERE projectId = ? ORDER BY updatedAt DESC", projectId);
    const body =
      csvRow([
        "project_code",
        "project_id",
        "risk_id",
        "description",
        "severity",
        "probability",
        "status",
        "owner",
        "due_date",
        "mitigation",
        "created_at",
        "updated_at",
      ]) +
      rows
        .map((r) =>
          csvRow([
            proj[0]!.code,
            String(r.projectId ?? ""),
            String(r.id ?? ""),
            String(r.description ?? ""),
            String(r.severity ?? ""),
            String(r.probability ?? ""),
            String(r.status ?? ""),
            String(r.owner ?? ""),
            r.dueDate ? String(r.dueDate).slice(0, 10) : "",
            String(r.mitigation ?? ""),
            String(r.createdAt ?? ""),
            String(r.updatedAt ?? ""),
          ]),
        )
        .join("");
    return { filename: `risks-${proj[0]!.code}.csv`, content: body };
  }

  async listAll(filters?: { projectId?: string; riskCategory?: string; matrixKind?: string }) {
    const wh: string[] = [];
    const args: unknown[] = [];
    if (filters?.projectId) {
      wh.push("r.projectId = ?");
      args.push(filters.projectId);
    }
    if (filters?.riskCategory) {
      wh.push("r.riskCategory = ?");
      args.push(normalizeRiskCategory(filters.riskCategory));
    }
    if (filters?.matrixKind?.trim()) {
      wh.push("r.matrixKind = ?");
      args.push(normalizeMatrixKind(filters.matrixKind));
    }
    const whereSql = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
    const sql =
      "SELECT r.id, r.description, r.severity, r.probability, r.mitigation, r.status, r.owner, r.ownerUserId, r.dueDate, r.mrbMatrix, r.riskCategory, r.matrixKind, r.createdAt, r.updatedAt, r.projectId, p.id as p_id, p.code as p_code, p.name as p_name " +
      "FROM Risk r INNER JOIN Project p ON p.id = r.projectId " +
      whereSql +
      " ORDER BY r.updatedAt DESC";
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, any>>>(sql, ...args);
    return rows.map((r) => {
      const base = this.withParsedMatrix(r as { mrbMatrix?: string | null }) as any;
      base.project = { id: r.p_id, code: r.p_code, name: r.p_name };
      delete base.p_id;
      delete base.p_code;
      delete base.p_name;
      return base;
    });
  }

  async listExecutive(opts?: { projectId?: string }) {
    const pid = opts?.projectId?.trim();
    const projects = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; code: string; name: string; status: string; client: string }>
    >(
      pid ? "SELECT id, code, name, status, client FROM Project WHERE id = ? ORDER BY code ASC" : "SELECT id, code, name, status, client FROM Project ORDER BY code ASC",
      ...(pid ? [pid] : []),
    );
    const ids = projects.map((p) => p.id);
    const zc = (): Record<RiskCategoryCode, number> => ({
      OPERATIONAL: 0,
      STRATEGIC: 0,
      FINANCIAL: 0,
      COMPLIANCE_LEGAL: 0,
      REPUTATIONAL: 0,
    });

    if (!ids.length) {
      return {
        totals: { projectCount: 0, totalRisks: 0, openRisks: 0, highInherentRisks: 0, byCategory: zc() },
        projects: [],
      };
    }

    const placeholders = ids.map(() => "?").join(",");
    const risks = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; projectId: string; status: string; severity: string; probability: string; description: string; riskCategory: string; mrbMatrix: string | null }>
    >(
      `SELECT id, projectId, status, severity, probability, description, riskCategory, mrbMatrix FROM Risk WHERE projectId IN (${placeholders})`,
      ...ids,
    );

    const totalsByCat = zc();
    let totalRisks = 0;
    let openRisks = 0;
    let highInherentRisks = 0;

    const byProject = new Map<string, { riskCount: number; openCount: number; highInherentCount: number; byCategory: Record<RiskCategoryCode, number> }>();
    for (const p of projects) byProject.set(p.id, { riskCount: 0, openCount: 0, highInherentCount: 0, byCategory: zc() });

    for (const r of risks) {
      totalRisks += 1;
      const cat = normalizeRiskCategory(r.riskCategory);
      totalsByCat[cat] += 1;
      if (isRiskOpen(r.status)) openRisks += 1;
      const inh = riskInherentFromRow({
        description: r.description,
        severity: r.severity,
        probability: r.probability,
        mrbMatrix: r.mrbMatrix,
      });
      if (isHighInherentSeverity(inh.severity)) highInherentRisks += 1;
      const agg = byProject.get(r.projectId);
      if (!agg) continue;
      agg.riskCount += 1;
      agg.byCategory[cat] += 1;
      if (isRiskOpen(r.status)) agg.openCount += 1;
      if (isHighInherentSeverity(inh.severity)) agg.highInherentCount += 1;
    }

    return {
      totals: { projectCount: projects.length, totalRisks, openRisks, highInherentRisks, byCategory: totalsByCat },
      projects: projects.map((p) => {
        const a = byProject.get(p.id)!;
        return { ...p, riskCount: a.riskCount, openCount: a.openCount, highInherentCount: a.highInherentCount, byCategory: a.byCategory as Record<string, number> };
      }),
    };
  }

  async create(projectId: string, dto: CreateRiskDto) {
    await this.ensureProject(projectId);
    const ownerUserId = dto.ownerUserId?.trim() || null;
    const owner = dto.owner?.trim() || null;
    let description = dto.description.trim();
    let severity = dto.severity;
    let probability = dto.probability;
    let mrbMatrix: string | null = null;

    if (dto.mrbMatrix && typeof dto.mrbMatrix === "object") {
      const raw = dto.mrbMatrix as Record<string, unknown>;
      try {
        const built = buildMrbMatrixV1({
          version: 1,
          event: String(raw.event ?? ""),
          cause: String(raw.cause ?? ""),
          consequence: String(raw.consequence ?? ""),
          criticalRiskText: raw.criticalRiskText != null ? String(raw.criticalRiskText) : undefined,
          probabilityLabel: String(raw.probabilityLabel ?? "Moderado"),
          impactLabel: String(raw.impactLabel ?? "Moderados"),
          keyControl: String(raw.keyControl ?? ""),
          controlPeriodicity: String(raw.controlPeriodicity ?? "Permanente"),
          controlOpportunity: String(raw.controlOpportunity ?? "Preventivo"),
          controlAutomation: String(raw.controlAutomation ?? "Manual"),
          genericStrategy: String(raw.genericStrategy ?? ""),
          validationDate: raw.validationDate != null ? String(raw.validationDate) : null,
          validator: String(raw.validator ?? ""),
          treatmentRisk: raw.treatmentRisk != null ? String(raw.treatmentRisk) : undefined,
          treatmentStrategy: raw.treatmentStrategy != null ? String(raw.treatmentStrategy) : undefined,
          treatmentObjective: String(raw.treatmentObjective ?? ""),
          treatmentActions: String(raw.treatmentActions ?? ""),
          treatmentResponsible: String(raw.treatmentResponsible ?? ""),
          treatmentDeadline: raw.treatmentDeadline != null ? String(raw.treatmentDeadline) : null,
          treatmentProgressPct: typeof raw.treatmentProgressPct === "number" ? raw.treatmentProgressPct : null,
          treatmentEvidence: String(raw.treatmentEvidence ?? ""),
        });
        mrbMatrix = JSON.stringify(built);
        const leg = mrbMatrixToLegacyFields(built);
        description = leg.description;
        severity = leg.severity;
        probability = leg.probability;
      } catch {
        throw new BadRequestException("mrbMatrix inválido o incompleto");
      }
    }

    const riskCategory = normalizeRiskCategory(dto.riskCategory);
    const matrixKind = normalizeMatrixKind(dto.matrixKind);
    const id = randomUUID();
    const now = new Date().toISOString();

    await this.prisma.$executeRawUnsafe(
      "INSERT INTO Risk (id, projectId, description, severity, probability, mitigation, status, owner, ownerUserId, dueDate, mrbMatrix, riskCategory, matrixKind, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      projectId,
      description,
      severity,
      probability,
      dto.mitigation ?? null,
      dto.status ?? "OPEN",
      owner,
      ownerUserId,
      dto.dueDate ? new Date(dto.dueDate).toISOString() : null,
      mrbMatrix,
      riskCategory,
      matrixKind,
      now,
      now,
    );

    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, any>>>("SELECT * FROM Risk WHERE id = ?", id);
    return this.withParsedMatrix(rows[0] as { mrbMatrix?: string | null });
  }

  async update(projectId: string, riskId: string, dto: UpdateRiskDto) {
    const hits = await this.prisma.$queryRawUnsafe<Array<Record<string, any>>>("SELECT * FROM Risk WHERE id = ? AND projectId = ? LIMIT 1", riskId, projectId);
    const existing = hits[0];
    if (!existing) throw new NotFoundException("Riesgo no encontrado");

    const data: Record<string, unknown> = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.severity !== undefined) data.severity = dto.severity;
    if (dto.probability !== undefined) data.probability = dto.probability;
    if (dto.mitigation !== undefined) data.mitigation = dto.mitigation;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate).toISOString() : null;
    if (dto.riskCategory !== undefined) data.riskCategory = normalizeRiskCategory(dto.riskCategory);
    if (dto.matrixKind !== undefined) data.matrixKind = normalizeMatrixKind(dto.matrixKind);

    if (dto.mrbMatrix !== undefined) {
      if (dto.mrbMatrix === null) {
        data.mrbMatrix = null;
      } else if (typeof dto.mrbMatrix === "object") {
        const prev = this.parseMrbMatrix(String(existing.mrbMatrix ?? "")) ?? {};
        const incoming = dto.mrbMatrix as Record<string, unknown>;
        const raw = { ...prev, ...incoming };
        try {
          const built = buildMrbMatrixV1({
            version: 1,
            event: String(raw.event ?? ""),
            cause: String(raw.cause ?? ""),
            consequence: String(raw.consequence ?? ""),
            criticalRiskText: raw.criticalRiskText != null ? String(raw.criticalRiskText) : undefined,
            probabilityLabel: String(raw.probabilityLabel ?? "Moderado"),
            impactLabel: String(raw.impactLabel ?? "Moderados"),
            keyControl: String(raw.keyControl ?? ""),
            controlPeriodicity: String(raw.controlPeriodicity ?? "Permanente"),
            controlOpportunity: String(raw.controlOpportunity ?? "Preventivo"),
            controlAutomation: String(raw.controlAutomation ?? "Manual"),
            genericStrategy: String(raw.genericStrategy ?? ""),
            validationDate: raw.validationDate != null ? String(raw.validationDate) : null,
            validator: String(raw.validator ?? ""),
            treatmentRisk: raw.treatmentRisk != null ? String(raw.treatmentRisk) : undefined,
            treatmentStrategy: raw.treatmentStrategy != null ? String(raw.treatmentStrategy) : undefined,
            treatmentObjective: String(raw.treatmentObjective ?? ""),
            treatmentActions: String(raw.treatmentActions ?? ""),
            treatmentResponsible: String(raw.treatmentResponsible ?? ""),
            treatmentDeadline: raw.treatmentDeadline != null ? String(raw.treatmentDeadline) : null,
            treatmentProgressPct: typeof raw.treatmentProgressPct === "number" ? raw.treatmentProgressPct : null,
            treatmentEvidence: String(raw.treatmentEvidence ?? ""),
          });
          data.mrbMatrix = JSON.stringify(built);
          const leg = mrbMatrixToLegacyFields(built);
          data.description = leg.description;
          data.severity = leg.severity;
          data.probability = leg.probability;
        } catch {
          throw new BadRequestException("mrbMatrix inválido o incompleto");
        }
      }
    }

    if (dto.ownerUserId !== undefined) {
      const raw = dto.ownerUserId?.trim();
      if (!raw) {
        data.ownerUserId = null;
        if (dto.owner !== undefined) data.owner = dto.owner?.trim() || null;
      } else {
        data.ownerUserId = raw;
        if (dto.owner !== undefined) data.owner = dto.owner?.trim() || null;
      }
    } else if (dto.owner !== undefined) {
      data.owner = dto.owner?.trim() || null;
    }

    data.updatedAt = new Date().toISOString();
    const fields = Object.keys(data);
    if (fields.length) {
      const setSql = fields.map((k) => `${k} = ?`).join(", ");
      const args = fields.map((k) => data[k]);
      await this.prisma.$executeRawUnsafe(`UPDATE Risk SET ${setSql} WHERE id = ? AND projectId = ?`, ...args, riskId, projectId);
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, any>>>("SELECT * FROM Risk WHERE id = ?", riskId);
    return this.withParsedMatrix(rows[0] as { mrbMatrix?: string | null });
  }

  async remove(projectId: string, riskId: string) {
    const hits = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>("SELECT id FROM Risk WHERE id = ? AND projectId = ? LIMIT 1", riskId, projectId);
    if (!hits[0]?.id) throw new NotFoundException("Riesgo no encontrado");
    await this.prisma.$executeRawUnsafe("DELETE FROM Risk WHERE id = ? AND projectId = ?", riskId, projectId);
    return { deleted: true };
  }

  private async ensureProject(projectId: string) {
    const r = await this.prisma.$queryRawUnsafe<Array<{ n: number }>>("SELECT COUNT(1) as n FROM Project WHERE id = ?", projectId);
    if ((r[0]?.n ?? 0) <= 0) throw new NotFoundException("Proyecto no encontrado");
  }
}


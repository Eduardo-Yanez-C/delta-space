import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Task as PrismaTask } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { ScheduleImportRow } from "../../common/schedule-tsv-import";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import {
  assertRequiredCustomFieldsFilled,
  mergeContextNoteIntoFields,
  normalizeCustomFieldsInput,
  parseStoredCustomFields,
  serializeCustomFieldsForDb,
  SUITE_FIELD_CONTEXT_ID,
} from "./task-custom-fields";
import {
  mergeActivityAppend,
  normalizeAppendInput,
  parseStoredActivityLog,
  serializeActivityLog,
} from "./task-activity-log";

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProject(projectId: string) {
    const n = await this.prisma.project.count({ where: { id: projectId } });
    if (!n) throw new NotFoundException("Proyecto no encontrado");
  }

  /** Lista tareas + deps (misma forma útil que Software de Mejora para Gantt / tablas). */
  async listByProject(projectId: string) {
    await this.ensureProject(projectId);
    const where: Prisma.TaskWhereInput = { projectId };
    const [rows, deps] = await Promise.all([
      this.prisma.task.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { startDate: "asc" }, { name: "asc" }],
        include: {
          assigneeUser: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.taskDependency.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } }),
    ]);

    const taskById = new Map<string, PrismaTask>(
      rows.map((r) => {
        const { assigneeUser, ...rest } = r;
        return [rest.id, rest as PrismaTask];
      }),
    );

    const predecessorIdsFor = (taskId: string): string[] => {
      const s = new Set<string>();
      const row = taskById.get(taskId);
      if (row?.dependencyTaskId) s.add(row.dependencyTaskId);
      for (const d of deps) {
        if (d.successorTaskId === taskId) s.add(d.predecessorTaskId);
      }
      return [...s];
    };

    const successorIdsFor = (taskId: string): string[] => {
      const s = new Set<string>();
      for (const x of taskById.values()) {
        if (x.dependencyTaskId === taskId) s.add(x.id);
      }
      for (const d of deps) {
        if (d.predecessorTaskId === taskId) s.add(d.successorTaskId);
      }
      return [...s];
    };

    return rows.map((r) => {
      const { assigneeUser, ...rest } = r;
      const t = rest as PrismaTask;
      const preds = predecessorIdsFor(t.id);
      const blocked = preds.some((pid) => String(taskById.get(pid)?.status).toUpperCase() !== "DONE");
      return {
        ...t,
        activityLog: parseStoredActivityLog(t.activityLog as string | null | undefined),
        assigneeUser: assigneeUser ?? null,
        lastComment: null as null,
        checklists: [] as unknown[],
        checklistTotals: { total: 0, done: 0 },
        predecessorIds: preds,
        successorIds: successorIdsFor(t.id),
        blocked,
      };
    });
  }

  async update(projectId: string, taskId: string, dto: UpdateTaskDto) {
    await this.ensureProject(projectId);
    const exists = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!exists) throw new NotFoundException("Tarea no encontrada");
    const data: Prisma.TaskUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = (dto.status == null ? "" : String(dto.status)).trim() || exists.status;
    }
    if (dto.progress !== undefined) data.progress = dto.progress;
    if (dto.name !== undefined) {
      data.name = (dto.name == null ? "" : String(dto.name)).trim() || exists.name;
    }
    if (dto.priority !== undefined) {
      data.priority = (dto.priority == null ? "" : String(dto.priority)).trim() || exists.priority;
    }
    if (dto.description !== undefined) {
      data.description =
        dto.description === null || dto.description === undefined
          ? null
          : String(dto.description).trim() || null;
    }

    if (dto.customFields !== undefined) {
      const normRaw = normalizeCustomFieldsInput(dto.customFields);
      const withoutBuiltin = normRaw.filter((f) => f.id !== SUITE_FIELD_CONTEXT_ID);
      const prevB = normRaw.find((f) => f.id === SUITE_FIELD_CONTEXT_ID);
      let value: string;
      if (dto.contextNote !== undefined) {
        value = dto.contextNote === null ? "" : String(dto.contextNote);
      } else {
        value = prevB?.value ?? exists.contextNote ?? "";
      }
      const required = Boolean(prevB?.required);
      const norm = [
        {
          id: SUITE_FIELD_CONTEXT_ID,
          type: "textarea",
          label: "Comentario",
          value,
          required,
        },
        ...withoutBuiltin,
      ];
      assertRequiredCustomFieldsFilled(norm);
      data.customFields = serializeCustomFieldsForDb(norm);
      data.contextNote = value.trim() ? value.trim() : null;
    } else if (dto.contextNote !== undefined) {
      const cn =
        dto.contextNote === null || dto.contextNote === undefined
          ? null
          : String(dto.contextNote).trim() || null;
      data.contextNote = cn;
      const parsed = parseStoredCustomFields(exists.customFields as unknown);
      if (parsed.length > 0) {
        data.customFields = serializeCustomFieldsForDb(mergeContextNoteIntoFields(parsed, cn === null ? "" : cn ?? ""));
      }
    }

    let start = exists.startDate;
    let end = exists.endDate;
    if (dto.startDate !== undefined) start = new Date(dto.startDate);
    if (dto.endDate !== undefined) end = new Date(dto.endDate);
    if (dto.startDate !== undefined || dto.endDate !== undefined) {
      if (!(end.getTime() > start.getTime())) {
        throw new BadRequestException("endDate debe ser posterior a startDate");
      }
      data.startDate = start;
      data.endDate = end;
      data.duration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    }

    if (dto.assigneeUserId !== undefined) {
      const raw = dto.assigneeUserId;
      if (raw === null || raw === "") {
        data.assigneeUser = { disconnect: true };
        data.assignedTo = null;
      } else {
        const uid = String(raw).trim();
        const u = await this.prisma.user.findFirst({
          where: { id: uid, active: true },
          select: { id: true, name: true, email: true },
        });
        if (!u) throw new BadRequestException("Usuario asignado no válido o inactivo");
        data.assigneeUser = { connect: { id: uid } };
        data.assignedTo = (u.name?.trim() || u.email || "").slice(0, 200);
      }
    }

    if (dto.dependencyTaskId !== undefined) {
      const raw = dto.dependencyTaskId;
      if (raw === null || raw === "") {
        data.dependsOn = { disconnect: true };
      } else {
        const depId = String(raw).trim();
        if (depId === taskId) throw new BadRequestException("La tarea no puede depender de sí misma");
        const dep = await this.prisma.task.findFirst({ where: { id: depId, projectId } });
        if (!dep) throw new BadRequestException("Tarea relacionada no encontrada en el proyecto");
        data.dependsOn = { connect: { id: depId } };
      }
    }

    const appendActs = normalizeAppendInput(dto.appendActivityEntries);
    if (appendActs.length > 0) {
      const prevLog = parseStoredActivityLog(exists.activityLog as string | null | undefined);
      data.activityLog = serializeActivityLog(mergeActivityAppend(prevLog, appendActs));
    }

    await this.prisma.task.update({
      where: { id: taskId },
      data,
    });
    const rows = await this.listByProject(projectId);
    const row = rows.find((r) => r.id === taskId);
    if (!row) throw new NotFoundException("Tarea no encontrada tras actualizar");
    return row;
  }

  async remove(projectId: string, taskId: string) {
    await this.ensureProject(projectId);
    const exists = await this.prisma.task.findFirst({ where: { id: taskId, projectId } });
    if (!exists) throw new NotFoundException("Tarea no encontrada");
    await this.prisma.taskDependency.deleteMany({
      where: { OR: [{ predecessorTaskId: taskId }, { successorTaskId: taskId }] },
    });
    await this.prisma.task.delete({ where: { id: taskId } });
    return { ok: true as const, id: taskId };
  }

  async create(projectId: string, dto: CreateTaskDto) {
    await this.ensureProject(projectId);
    const max = await this.prisma.task.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    const sortOrder = (max._max.sortOrder ?? 0) + 10;
    const start = dto.startDate ? new Date(dto.startDate) : new Date();
    const end = dto.endDate ? new Date(dto.endDate) : new Date(start.getTime() + 86400000 * 7);
    if (end <= start) throw new BadRequestException("endDate debe ser posterior a startDate");
    let parentTaskId: string | null = dto.parentTaskId?.trim() || null;
    if (parentTaskId) {
      const p = await this.prisma.task.findFirst({ where: { id: parentTaskId, projectId } });
      if (!p) throw new BadRequestException("parentTaskId inválido");
    }
    const status = dto.status?.trim() || "TODO";
    const priority = dto.priority?.trim() || "NORMAL";
    const duration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const created = await this.prisma.task.create({
      data: {
        projectId,
        name: dto.name.trim(),
        startDate: start,
        endDate: end,
        duration,
        status,
        priority,
        sortOrder,
        parentTaskId,
        progress: 0,
        weight: 1,
        isCritical: false,
        isMilestone: false,
        taskKind: "STANDARD",
        baselineStartDate: start,
        baselineEndDate: end,
        baselineDurationDays: duration,
      },
    });
    const rows = await this.listByProject(projectId);
    return rows.find((r) => r.id === created.id) ?? created;
  }

  /** Importa muchas tareas (cronograma / Gantt exportado como TSV o CSV). Máx. 300 filas efectivas. */
  async bulkImportSchedule(projectId: string, rows: ScheduleImportRow[], extraWarnings: string[] = []) {
    await this.ensureProject(projectId);
    const MAX = 300;
    const warnings = [...extraWarnings];
    const input = rows.slice(0, MAX);
    if (rows.length > MAX) {
      warnings.push(`Solo se importaron ${MAX} tareas de ${rows.length} enviadas.`);
    }

    const maxAgg = await this.prisma.task.aggregate({
      where: { projectId },
      _max: { sortOrder: true },
    });
    let sortOrder = (maxAgg._max.sortOrder ?? 0) + 10;

    let created = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const r of input) {
        const name = (r.name ?? "").trim();
        if (!name) continue;
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          warnings.push(`Omitida "${name.slice(0, 48)}": fechas inválidas`);
          continue;
        }
        if (end.getTime() <= start.getTime()) {
          warnings.push(`Omitida "${name.slice(0, 48)}": la fecha fin debe ser posterior al inicio`);
          continue;
        }
        const duration = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
        sortOrder += 10;
        const wbs = r.wbsCode != null && String(r.wbsCode).trim() ? String(r.wbsCode).trim().slice(0, 64) : null;
        await tx.task.create({
          data: {
            projectId,
            name: name.slice(0, 500),
            wbsCode: wbs,
            startDate: start,
            endDate: end,
            duration,
            status: "TODO",
            priority: "NORMAL",
            sortOrder,
            progress: 0,
            weight: 1,
            isCritical: false,
            isMilestone: false,
            taskKind: "STANDARD",
            baselineStartDate: start,
            baselineEndDate: end,
            baselineDurationDays: duration,
          },
        });
        created += 1;
      }
    });

    return { ok: true as const, created, warnings };
  }
}

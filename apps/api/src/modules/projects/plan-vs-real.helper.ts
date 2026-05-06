/** Tareas mínimas para plan vs real (sin depender de Prisma en el cómputo puro). Alineado a Software de Mejora. */
export type TaskPlanSlice = {
  startDate: Date;
  endDate: Date;
  baselineStartDate?: Date | null;
  baselineEndDate?: Date | null;
  progress: number;
  weight: number | null;
  isCritical: boolean;
};

function effectiveWeight(weight: number | null | undefined, isCritical: boolean): number {
  const w = weight != null && weight > 0 ? weight : 1;
  return w * (isCritical ? 1.5 : 1);
}

export function linearProgressAlongWindow(start: Date, end: Date, now: Date): number {
  const s = start.getTime();
  const e = end.getTime();
  const n = now.getTime();
  if (e <= s) return n >= e ? 100 : 0;
  if (n <= s) return 0;
  if (n >= e) return 100;
  return Math.round(((n - s) / (e - s)) * 1000) / 10;
}

export function weightedRealProgress(tasks: TaskPlanSlice[]): number {
  if (tasks.length === 0) return 0;
  let sumW = 0;
  let sumP = 0;
  for (const t of tasks) {
    const w = effectiveWeight(t.weight, t.isCritical);
    sumW += w;
    sumP += (t.progress ?? 0) * w;
  }
  return Math.round((sumP / sumW) * 10) / 10;
}

function planWindowForSlice(t: TaskPlanSlice): { start: Date; end: Date } {
  if (t.baselineStartDate && t.baselineEndDate) {
    return { start: t.baselineStartDate, end: t.baselineEndDate };
  }
  return { start: t.startDate, end: t.endDate };
}

export function weightedPlannedProgress(tasks: TaskPlanSlice[], now: Date): number {
  if (tasks.length === 0) return 0;
  let sumW = 0;
  let sumP = 0;
  for (const t of tasks) {
    const w = effectiveWeight(t.weight, t.isCritical);
    const { start, end } = planWindowForSlice(t);
    const planned = linearProgressAlongWindow(start, end, now);
    sumW += w;
    sumP += planned * w;
  }
  return Math.round((sumP / sumW) * 10) / 10;
}

export function resolveProjectEnd(projectEnd: Date | null, projectStart: Date, taskEnds: Date[]): Date {
  if (projectEnd) return projectEnd;
  if (taskEnds.length === 0) return projectStart;
  return new Date(Math.max(...taskEnds.map((d) => d.getTime())));
}

export type PlanVsRealResult = {
  progressReal: number;
  progressPlannedWeighted: number;
  progressPlannedCalendar: number;
  deviationPctVsWeighted: number;
  deviationPctVsCalendar: number;
  scheduleSlipDays: number;
  baselineEnd: string;
};

export function computePlanVsRealFromSlices(
  projectStart: Date,
  projectEnd: Date | null,
  tasks: TaskPlanSlice[],
  now: Date,
): PlanVsRealResult {
  const progressReal = weightedRealProgress(tasks);
  const progressPlannedWeighted = weightedPlannedProgress(tasks, now);
  const end = resolveProjectEnd(projectEnd, projectStart, tasks.map((t) => t.endDate));
  const progressPlannedCalendar = linearProgressAlongWindow(projectStart, end, now);
  const deviationPctVsWeighted = Math.round((progressReal - progressPlannedWeighted) * 10) / 10;
  const deviationPctVsCalendar = Math.round((progressReal - progressPlannedCalendar) * 10) / 10;
  const totalDays = Math.max(0.01, (end.getTime() - projectStart.getTime()) / 86400000);
  const scheduleSlipDays =
    Math.round(((progressPlannedCalendar - progressReal) / 100) * totalDays * 10) / 10;
  return {
    progressReal,
    progressPlannedWeighted,
    progressPlannedCalendar,
    deviationPctVsWeighted,
    deviationPctVsCalendar,
    scheduleSlipDays,
    baselineEnd: end.toISOString(),
  };
}

export type TaskHierarchyProgressRow = {
  id: string;
  parentTaskId: string | null;
  progress: number;
  weight: number | null;
  isCritical: boolean;
};

export type TaskHierarchyPlanRow = TaskHierarchyProgressRow & {
  startDate: Date;
  endDate: Date;
  baselineStartDate?: Date | null;
  baselineEndDate?: Date | null;
};

function groupTasksByParentId<T extends { id: string; parentTaskId: string | null }>(
  tasks: T[],
): Map<string | null, T[]> {
  const m = new Map<string | null, T[]>();
  for (const t of tasks) {
    const k = t.parentTaskId;
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
  }
  return m;
}

function rolledProgressForTask(
  taskId: string,
  byParent: Map<string | null, TaskHierarchyProgressRow[]>,
  byId: Map<string, TaskHierarchyProgressRow>,
  memo: Map<string, number>,
): number {
  if (memo.has(taskId)) return memo.get(taskId)!;
  const children = byParent.get(taskId) ?? [];
  if (children.length === 0) {
    const p = byId.get(taskId)?.progress ?? 0;
    memo.set(taskId, p);
    return p;
  }
  let cw = 0;
  let cp = 0;
  for (const ch of children) {
    const w = effectiveWeight(ch.weight, ch.isCritical);
    cw += w;
    cp += rolledProgressForTask(ch.id, byParent, byId, memo) * w;
  }
  const r = cw === 0 ? 0 : cp / cw;
  memo.set(taskId, r);
  return r;
}

function hierarchyRoots<T extends { parentTaskId: string | null }>(
  tasks: T[],
  byParent: Map<string | null, T[]>,
): T[] {
  const roots = byParent.get(null) ?? [];
  if (roots.length === 0 && tasks.length > 0) return tasks;
  return roots;
}

export function weightedRealProgressWithHierarchy(tasks: TaskHierarchyProgressRow[]): number {
  if (tasks.length === 0) return 0;
  const byParent = groupTasksByParentId(tasks);
  const roots = hierarchyRoots(tasks, byParent);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, number>();
  let sumW = 0;
  let sumP = 0;
  for (const r of roots) {
    const w = effectiveWeight(r.weight, r.isCritical);
    sumW += w;
    sumP += rolledProgressForTask(r.id, byParent, byId, memo) * w;
  }
  if (sumW === 0) return 0;
  return Math.round((sumP / sumW) * 10) / 10;
}

export function planVsRealRootSlicesFromTasks(tasks: TaskHierarchyPlanRow[]): TaskPlanSlice[] {
  if (tasks.length === 0) return [];
  const byParent = groupTasksByParentId(tasks);
  const roots = hierarchyRoots(tasks, byParent);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const memo = new Map<string, number>();
  return roots.map((r) => ({
    startDate: r.startDate,
    endDate: r.endDate,
    baselineStartDate: r.baselineStartDate,
    baselineEndDate: r.baselineEndDate,
    progress: rolledProgressForTask(r.id, byParent, byId, memo),
    weight: r.weight,
    isCritical: r.isCritical,
  }));
}

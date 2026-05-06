"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Gantt, Task, ViewMode } from "gantt-task-react";
import "gantt-task-react/dist/index.css";
import type { GanttListColumnId } from "../../lib/suite-planning-persisted-view";
import {
  GanttWbsTaskListHeader,
  GanttWbsTaskListTable,
  type GanttRowMeta,
} from "./GanttWbsTaskList";

export type SuiteProjectGanttApiTask = {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  parentTaskId?: string | null;
  dependencyTaskId?: string | null;
  predecessorIds?: string[];
  wbsCode?: string | null;
  sortOrder?: number | null;
  isMilestone?: boolean | null;
  duration?: number | null;
  baselineStartDate?: string | null;
  baselineEndDate?: string | null;
  baselineDurationDays?: number | null;
  isCritical?: boolean | null;
};

const VIEW_MODES = [
  { mode: ViewMode.Day, label: "Día" },
  { mode: ViewMode.Week, label: "Semana" },
  { mode: ViewMode.Month, label: "Mes" },
] as const;

const CHART_LOCALE = "es";

function daysInclusiveIso(startIso: string, endIso: string): number {
  const s = new Date(startIso.slice(0, 10) + "T12:00:00").getTime();
  const e = new Date(endIso.slice(0, 10) + "T12:00:00").getTime();
  const d = Math.round((e - s) / 86400000) + 1;
  return Math.max(0, d);
}

function orderedTasksForGantt(tasks: SuiteProjectGanttApiTask[]): SuiteProjectGanttApiTask[] {
  const byParent = new Map<string | null, SuiteProjectGanttApiTask[]>();
  for (const t of tasks) {
    const p = t.parentTaskId ?? null;
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(t);
  }
  for (const arr of Array.from(byParent.values())) {
    arr.sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      const w = String(a.wbsCode ?? "").localeCompare(String(b.wbsCode ?? ""));
      if (w !== 0) return w;
      return a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name);
    });
  }
  const out: SuiteProjectGanttApiTask[] = [];
  function walk(pid: string | null) {
    for (const c of byParent.get(pid) ?? []) {
      out.push(c);
      walk(c.id);
    }
  }
  walk(null);
  return out;
}

function buildChildCount(tasks: SuiteProjectGanttApiTask[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tasks) {
    const p = t.parentTaskId;
    if (!p) continue;
    m.set(p, (m.get(p) ?? 0) + 1);
  }
  return m;
}

export function SuiteProjectGantt({
  tasks,
  emptyMessage,
  onTaskClick,
  selectedTaskId,
  expandSummaryIds,
  ganttListCols,
}: {
  tasks: SuiteProjectGanttApiTask[];
  emptyMessage: string;
  onTaskClick?: (taskId: string) => void;
  selectedTaskId?: string | null;
  expandSummaryIds?: string[];
  ganttListCols?: Record<GanttListColumnId, boolean>;
}) {
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [collapsedSummaryIds, setCollapsedSummaryIds] = useState<Set<string>>(() => new Set());

  const childCount = useMemo(() => buildChildCount(tasks), [tasks]);
  const ordered = useMemo(() => orderedTasksForGantt(tasks), [tasks]);

  const depthByTaskId = useMemo(() => {
    const m = new Map<string, number>();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    for (const t of ordered) {
      let d = 0;
      let p: string | null | undefined = t.parentTaskId;
      while (p) {
        d += 1;
        p = byId.get(p)?.parentTaskId ?? null;
      }
      m.set(t.id, d);
    }
    return m;
  }, [ordered, tasks]);

  const expandKey = expandSummaryIds?.length ? expandSummaryIds.join(",") : "";

  const rowMetaByTaskId = useMemo(() => {
    const m = new Map<string, GanttRowMeta>();
    for (const t of ordered) {
      const isMilestone = !!t.isMilestone;
      const dur =
        t.duration != null && t.duration >= 0
          ? t.duration
          : isMilestone
            ? 0
            : daysInclusiveIso(t.startDate, t.endDate);
      m.set(t.id, {
        wbs: t.wbsCode?.trim() || "—",
        durationDays: dur,
        startIso: t.startDate,
        endIso: t.endDate,
        progress: t.progress ?? 0,
        isMilestone,
        isCritical: !!t.isCritical,
        baselineEndIso: t.baselineEndDate,
      });
    }
    return m;
  }, [ordered]);

  const parentIsSummary = useCallback(
    (parentId: string | null | undefined) => !!(parentId && (childCount.get(parentId) ?? 0) > 0),
    [childCount],
  );

  const ganttTasks: Task[] = useMemo(() => {
    const barStyles = (sel: boolean, crit: boolean): NonNullable<Task["styles"]> => {
      if (crit) {
        return {
          progressColor: sel ? "#fecaca" : "#fff1f2",
          progressSelectedColor: "#fecaca",
          backgroundColor: sel ? "#9f1239" : "#be123c",
          backgroundSelectedColor: sel ? "#881337" : "#9f1239",
        };
      }
      return {
        progressColor: sel ? "#0369a1" : "#0f172a",
        progressSelectedColor: "#0284c7",
        backgroundColor: sel ? "#475569" : "#94a3b8",
        backgroundSelectedColor: sel ? "#334155" : "#64748b",
      };
    };

    return ordered.map((t, idx) => {
      const sel = selectedTaskId === t.id;
      const hasChildren = (childCount.get(t.id) ?? 0) > 0;
      const isMilestone = !!t.isMilestone;
      const crit = !!t.isCritical;
      const start = new Date(t.startDate.slice(0, 10) + "T12:00:00");
      const endDay = isMilestone ? start : new Date(t.endDate.slice(0, 10) + "T12:00:00");
      let type: Task["type"] = "task";
      if (isMilestone) type = "milestone";
      else if (hasChildren) type = "project";

      const hideChildren = hasChildren ? collapsedSummaryIds.has(t.id) : undefined;

      return {
        id: t.id,
        name: t.name,
        type,
        start,
        end: endDay,
        progress: Math.round(t.progress ?? 0),
        displayOrder: (t.sortOrder ?? 0) + idx / 100000,
        project: parentIsSummary(t.parentTaskId) ? (t.parentTaskId as string) : undefined,
        dependencies:
          t.predecessorIds && t.predecessorIds.length > 0
            ? [t.predecessorIds[0]]
            : t.dependencyTaskId
              ? [t.dependencyTaskId]
              : [],
        hideChildren,
        styles: barStyles(sel, crit),
      };
    });
  }, [ordered, childCount, collapsedSummaryIds, selectedTaskId, parentIsSummary]);

  useEffect(() => {
    setCollapsedSummaryIds(new Set());
  }, [tasks]);

  useEffect(() => {
    if (!expandSummaryIds?.length) return;
    setCollapsedSummaryIds((prev) => {
      const next = new Set(prev);
      for (const id of expandSummaryIds) next.delete(id);
      return next;
    });
  }, [expandKey, expandSummaryIds]);

  useEffect(() => {
    if (!selectedTaskId) return;
    const id = selectedTaskId;
    const t = window.setTimeout(() => {
      const shell = document.querySelector(".suite-gantt-sync-root");
      const row = shell?.querySelector(`[data-gantt-row-id="${CSS.escape(id)}"]`);
      if (row instanceof HTMLElement) row.click();
    }, 48);
    return () => window.clearTimeout(t);
  }, [selectedTaskId, expandKey, tasks.length]);

  const handleExpanderClick = useCallback((task: Task) => {
    setCollapsedSummaryIds((prev) => {
      const next = new Set(prev);
      if (task.hideChildren) next.add(task.id);
      else next.delete(task.id);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (task: Task, isSelected: boolean) => {
      if (isSelected) onTaskClick?.(task.id);
    },
    [onTaskClick],
  );

  if (ganttTasks.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  const colWidth = viewMode === ViewMode.Day ? 34 : viewMode === ViewMode.Week ? 46 : 58;
  const listWidth = "680px";

  const listColVisible = useMemo((): Record<GanttListColumnId, boolean> => {
    const g: Partial<Record<GanttListColumnId, boolean>> = ganttListCols ?? {};
    return {
      wbs: g.wbs !== false,
      name: true,
      duration: g.duration !== false,
      start: g.start !== false,
      end: g.end !== false,
      pct: g.pct !== false,
    };
  }, [ganttListCols]);

  const listLabels = {
    wbs: "WBS",
    name: "Nombre",
    duration: "Dur.",
    start: "Inicio",
    end: "Fin",
    pct: "%",
    milestone: "Hito",
    criticalBadge: "Crit.",
  };

  return (
    <div className={`suite-gantt-shell suite-gantt-sync-root ${selectedTaskId ? "suite-gantt-has-selection" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
        <div className="min-w-0 flex-1 pr-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Cronograma (Carta Gantt)
          </p>
          <p className="mt-0.5 max-w-[56rem] text-[9px] leading-snug text-slate-500 dark:text-slate-500">
            Ruta crítica según flags en datos (cartilla PMO); no es CPM automático tipo MS Project.
          </p>
        </div>
        <div className="flex rounded-md border border-slate-200 bg-white p-0.5 shadow-sm dark:border-slate-600 dark:bg-slate-950">
          {VIEW_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === mode
                  ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto bg-white px-1 pb-1 pt-0.5 dark:bg-slate-950">
        <Gantt
          tasks={ganttTasks}
          viewMode={viewMode}
          locale={CHART_LOCALE}
          listCellWidth={listWidth}
          columnWidth={colWidth}
          rowHeight={36}
          headerHeight={48}
          fontSize="11px"
          barCornerRadius={4}
          barFill={58}
          arrowIndent={14}
          barBackgroundColor="#94a3b8"
          barBackgroundSelectedColor="#475569"
          projectBackgroundColor="#cbd5e1"
          projectBackgroundSelectedColor="#94a3b8"
          projectProgressColor="#0f172a"
          projectProgressSelectedColor="#0369a1"
          milestoneBackgroundColor="#ea580c"
          milestoneBackgroundSelectedColor="#c2410c"
          todayColor="rgba(245, 158, 11, 0.35)"
          onClick={(task) => {
            onTaskClick?.(task.id);
          }}
          onSelect={handleSelect}
          onExpanderClick={handleExpanderClick}
          TaskListHeader={(p) => (
            <GanttWbsTaskListHeader
              headerHeight={p.headerHeight}
              listColVisible={listColVisible}
              labels={{
                wbs: listLabels.wbs,
                name: listLabels.name,
                duration: listLabels.duration,
                start: listLabels.start,
                end: listLabels.end,
                pct: listLabels.pct,
              }}
            />
          )}
          TaskListTable={(p) => (
            <GanttWbsTaskListTable
              {...p}
              listColVisible={listColVisible}
              rowMetaByTaskId={rowMetaByTaskId}
              labels={{ milestone: listLabels.milestone, criticalBadge: listLabels.criticalBadge }}
              externalSelectedTaskId={selectedTaskId ?? null}
              depthByTaskId={depthByTaskId}
            />
          )}
        />
      </div>
    </div>
  );
}

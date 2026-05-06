"use client";

import { useMemo } from "react";
import type { Task } from "gantt-task-react";
import type { GanttListColumnId } from "../../lib/suite-planning-persisted-view";
import { formatIsoDateDDMMAAAA } from "../../lib/suite-format-plan-date";

export type GanttRowMeta = {
  wbs: string;
  durationDays: number;
  startIso: string;
  endIso: string;
  progress: number;
  isMilestone: boolean;
  isCritical: boolean;
  baselineEndIso?: string | null;
};

function buildGridTemplate(visible: Record<GanttListColumnId, boolean>): string {
  const parts: string[] = [];
  if (visible.wbs) parts.push("minmax(48px,56px)");
  if (visible.name) parts.push("minmax(140px,1fr)");
  if (visible.duration) parts.push("42px");
  if (visible.start) parts.push("78px");
  if (visible.end) parts.push("78px");
  if (visible.pct) parts.push("42px");
  return parts.join(" ");
}

export function GanttWbsTaskListHeader({
  headerHeight,
  labels,
  listColVisible,
}: {
  headerHeight: number;
  labels: { wbs: string; name: string; duration: string; start: string; end: string; pct: string };
  listColVisible: Record<GanttListColumnId, boolean>;
}) {
  const grid = useMemo(() => buildGridTemplate(listColVisible), [listColVisible]);

  return (
    <div
      className="border-b border-slate-200 bg-slate-100 font-semibold text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
      style={{ height: headerHeight }}
    >
      <div
        className="grid h-full items-center gap-x-1.5 px-2 text-[10px] uppercase tracking-wide"
        style={{ gridTemplateColumns: grid }}
      >
        {listColVisible.wbs ? <span className="truncate pl-1">{labels.wbs}</span> : null}
        {listColVisible.name ? <span className="truncate">{labels.name}</span> : null}
        {listColVisible.duration ? <span className="text-center">{labels.duration}</span> : null}
        {listColVisible.start ? <span className="truncate">{labels.start}</span> : null}
        {listColVisible.end ? <span className="truncate">{labels.end}</span> : null}
        {listColVisible.pct ? <span className="text-center">{labels.pct}</span> : null}
      </div>
    </div>
  );
}

export function GanttWbsTaskListTable({
  rowHeight,
  tasks,
  selectedTaskId,
  setSelectedTask,
  onExpanderClick,
  rowMetaByTaskId,
  labels,
  externalSelectedTaskId,
  depthByTaskId,
  listColVisible,
}: {
  rowHeight: number;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
  rowMetaByTaskId: Map<string, GanttRowMeta>;
  labels: { milestone: string; criticalBadge: string };
  externalSelectedTaskId?: string | null;
  depthByTaskId?: Map<string, number>;
  listColVisible: Record<GanttListColumnId, boolean>;
}) {
  const effectiveSelected = (externalSelectedTaskId && externalSelectedTaskId.trim()) || selectedTaskId;
  const grid = useMemo(() => buildGridTemplate(listColVisible), [listColVisible]);

  return (
    <div className="bg-white text-[11px] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {tasks.map((task) => {
        const meta = rowMetaByTaskId.get(task.id);
        const wbs = meta?.wbs ?? "—";
        const dur = meta?.isMilestone ? "0" : String(meta?.durationDays ?? "—");
        const sel = task.id === effectiveSelected;
        const depth = Math.min(6, depthByTaskId?.get(task.id) ?? 0);
        const indentPx = depth * 12;
        const isPackage = task.type === "project";
        const isMilestone = task.type === "milestone" || meta?.isMilestone;
        const isCritical = !!meta?.isCritical;
        const expander =
          task.type === "project" && task.hideChildren !== undefined ? (task.hideChildren ? "▶" : "▼") : "";
        return (
          <div
            key={`${task.id}-row`}
            data-gantt-row-id={task.id}
            className={`cursor-pointer border-b border-slate-200 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/80 ${
              sel ? "bg-sky-50 ring-1 ring-inset ring-sky-300 dark:bg-sky-950/50 dark:ring-sky-700" : ""
            } ${isPackage ? "bg-slate-50/90 dark:bg-slate-900/80" : ""}`}
            style={{ height: rowHeight }}
            role="row"
            onClick={() => setSelectedTask(task.id)}
          >
            <div
              className="grid h-full items-center gap-x-1.5 px-2"
              style={{ gridTemplateColumns: grid }}
            >
              {listColVisible.wbs ? (
                <div className="flex min-w-0 items-center gap-0.5 pl-0.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-transparent text-[11px] font-bold text-slate-500 hover:border-slate-300 hover:bg-white dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900 ${
                      expander ? "" : "pointer-events-none invisible"
                    }`}
                    aria-label={expander === "▼" ? "Contraer" : expander === "▶" ? "Expandir" : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExpanderClick(task);
                    }}
                  >
                    {expander}
                  </button>
                  <span className="truncate font-mono text-[10px] font-semibold tracking-tight" title={wbs}>
                    {wbs}
                  </span>
                </div>
              ) : null}
              {listColVisible.name ? (
                <div className="flex min-w-0 items-center gap-1.5 pr-1" style={{ paddingLeft: listColVisible.wbs ? indentPx : indentPx }} title={task.name}>
                  {!listColVisible.wbs ? (
                    <>
                      <button
                        type="button"
                        tabIndex={-1}
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-transparent text-[11px] font-bold text-slate-500 hover:border-slate-300 hover:bg-white dark:text-slate-400 dark:hover:border-slate-600 dark:hover:bg-slate-900 ${
                          expander ? "" : "pointer-events-none invisible"
                        }`}
                        aria-label={expander === "▼" ? "Contraer" : expander === "▶" ? "Expandir" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          onExpanderClick(task);
                        }}
                      >
                        {expander}
                      </button>
                      <span className="shrink-0 font-mono text-[10px] font-semibold text-slate-500" title={wbs}>
                        {wbs}
                      </span>
                    </>
                  ) : null}
                  {isMilestone ? (
                    <span
                      className="inline-flex h-4 w-4 shrink-0 rotate-45 rounded-sm border border-amber-700 bg-amber-400 shadow-sm dark:border-amber-500 dark:bg-amber-600"
                      title={labels.milestone}
                      aria-hidden
                    />
                  ) : null}
                  {isCritical ? (
                    <span
                      className="shrink-0 rounded border border-rose-300 bg-rose-50 px-1 py-0 text-[7px] font-bold uppercase tracking-wide text-rose-900 dark:border-rose-800 dark:bg-rose-950/80 dark:text-rose-100"
                      title={labels.criticalBadge}
                    >
                      {labels.criticalBadge}
                    </span>
                  ) : null}
                  {!isMilestone && isPackage ? (
                    <span className="shrink-0 rounded border border-slate-300 bg-slate-100 px-1 py-0 text-[7px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                      Σ
                    </span>
                  ) : null}
                  <span className={`min-w-0 truncate ${isPackage ? "font-bold" : "font-medium"}`}>{task.name}</span>
                </div>
              ) : null}
              {listColVisible.duration ? (
                <div className="text-center tabular-nums text-slate-600 dark:text-slate-400">{dur}</div>
              ) : null}
              {listColVisible.start ? (
                <div className="truncate tabular-nums text-slate-600 dark:text-slate-400">
                  {formatIsoDateDDMMAAAA(meta?.startIso)}
                </div>
              ) : null}
              {listColVisible.end ? (
                <div className="truncate tabular-nums text-slate-600 dark:text-slate-400">
                  {formatIsoDateDDMMAAAA(meta?.endIso)}
                </div>
              ) : null}
              {listColVisible.pct ? (
                <div className="text-center tabular-nums font-semibold">{Math.round(task.progress)}%</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

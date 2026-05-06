"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useRef, useState } from "react";
import {
  ALL_COLUMN_IDS,
  type PlanningColumnId,
  type PlanningViewOpts,
  type SavedPlanningView,
} from "../../lib/suite-planning-persisted-view";

const COL_LABELS: Record<PlanningColumnId, string> = {
  name: "Nombre",
  status: "Estado",
  priority: "Prioridad",
  assignee: "Asignado",
  start: "Inicio",
  end: "Fin",
  progress: "% avance",
  checklist: "Checklist",
  deps: "Dependencias",
  context: "Contexto",
  subs: "Subtareas",
};

export function PlanningViewControlsSuite({
  colVisible,
  setColVisible,
  viewOpts,
  setViewOpts,
  savedViews,
  onSaveView,
  onApplyView,
  onDeleteView,
  mineOnly,
  setMineOnly,
  ganttListCols,
  setGanttCol,
  showGanttListToggles,
}: {
  colVisible: Record<PlanningColumnId, boolean>;
  setColVisible: Dispatch<SetStateAction<Record<PlanningColumnId, boolean>>>;
  viewOpts: PlanningViewOpts;
  setViewOpts: Dispatch<SetStateAction<PlanningViewOpts>>;
  savedViews: SavedPlanningView[];
  onSaveView: (name: string) => void;
  onApplyView: (v: SavedPlanningView) => void;
  onDeleteView: (id: string) => void;
  mineOnly: boolean;
  setMineOnly: (v: boolean) => void;
  ganttListCols?: Record<"wbs" | "name" | "duration" | "start" | "end" | "pct", boolean>;
  setGanttCol?: (id: "wbs" | "name" | "duration" | "start" | "end" | "pct", v: boolean) => void;
  showGanttListToggles?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  const ganttLabels = useMemo(
    () =>
      ({
        wbs: "WBS",
        name: "Nombre",
        duration: "Duración",
        start: "Inicio",
        end: "Fin",
        pct: "%",
      }) as const,
    [],
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700 shadow-sm hover:bg-slate-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text)] dark:hover:bg-[var(--suite-surface-input)]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        Columnas y vista
      </button>
      {open && (
        <>
          <button type="button" className="fixed inset-0 z-[25]" aria-label="Cerrar" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-[35] mt-1 w-[min(100vw-16px,400px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface)] dark:text-[var(--suite-text)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
              Columnas (lista)
            </p>
            <div className="mt-2 grid max-h-40 grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto text-[11px]">
              {ALL_COLUMN_IDS.map((id) => (
                <label key={id} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={colVisible[id]}
                    onChange={(e) => setColVisible((o) => ({ ...o, [id]: e.target.checked }))}
                  />
                  <span>{COL_LABELS[id]}</span>
                </label>
              ))}
            </div>

            {showGanttListToggles && ganttListCols && setGanttCol ? (
              <>
                <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
                  Columnas (panel Gantt)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                  {(Object.keys(ganttLabels) as Array<keyof typeof ganttLabels>).map((id) => (
                    <label key={id} className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={ganttListCols[id] !== false}
                        onChange={(e) => setGanttCol(id, e.target.checked)}
                      />
                      <span>{ganttLabels[id]}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}

            <p className="mt-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
              Diseño
            </p>
            <div className="mt-2 space-y-2 text-[11px]">
              <label className="flex cursor-pointer items-center gap-2">
                <span className="w-28 shrink-0 text-slate-500 dark:text-[var(--suite-text-muted)]">Densidad</span>
                <select
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                  value={viewOpts.rowDensity}
                  onChange={(e) =>
                    setViewOpts((o) => ({ ...o, rowDensity: e.target.value as PlanningViewOpts["rowDensity"] }))
                  }
                >
                  <option value="compact">Compacta</option>
                  <option value="comfortable">Cómoda</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <span className="w-28 shrink-0 text-slate-500 dark:text-[var(--suite-text-muted)]">Orden</span>
                <select
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                  value={viewOpts.sortBy}
                  onChange={(e) => setViewOpts((o) => ({ ...o, sortBy: e.target.value as PlanningViewOpts["sortBy"] }))}
                >
                  <option value="tree">Árbol WBS</option>
                  <option value="name">Nombre</option>
                  <option value="endDate">Fecha fin</option>
                  <option value="priority">Prioridad</option>
                </select>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={viewOpts.filterOverdue}
                  onChange={(e) => setViewOpts((o) => ({ ...o, filterOverdue: e.target.checked }))}
                />
                Solo vencidas
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={viewOpts.filterBlocked}
                  onChange={(e) => setViewOpts((o) => ({ ...o, filterBlocked: e.target.checked }))}
                />
                Solo bloqueadas
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                Solo lo mío (sincronizado con la barra de filtros)
              </label>
            </div>

            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-[var(--suite-border)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
                Vistas guardadas
              </p>
              <div className="mt-2 flex gap-1">
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Nombre de la vista"
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
                />
                <button
                  type="button"
                  className="shrink-0 rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white dark:bg-[var(--suite-accent)] dark:text-white"
                  onClick={() => {
                    const n = saveName.trim();
                    if (!n) return;
                    onSaveView(n);
                    setSaveName("");
                  }}
                >
                  Guardar
                </button>
              </div>
              <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-[11px]">
                {savedViews.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)]"
                  >
                    <button
                      type="button"
                      className="min-w-0 truncate text-left font-medium hover:underline"
                      onClick={() => onApplyView(v)}
                    >
                      {v.name}
                    </button>
                    <button
                      type="button"
                      className="shrink-0 text-[10px] text-rose-600 hover:underline"
                      onClick={() => onDeleteView(v.id)}
                    >
                      Borrar
                    </button>
                  </li>
                ))}
                {savedViews.length === 0 ? (
                  <li className="text-slate-400 dark:text-[var(--suite-text-muted)]">Ninguna vista guardada.</li>
                ) : null}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function buildSaveSnapshot(
  colWidths: Record<PlanningColumnId, number>,
  colVisible: Record<PlanningColumnId, boolean>,
  viewOpts: PlanningViewOpts,
  mineOnly: boolean,
  filters: {
    statusFilter: string;
    priorityFilter: string;
    rootsOnly: boolean;
    criticalOnly: boolean;
    q: string;
  },
): Omit<SavedPlanningView, "id" | "name" | "createdAt"> {
  return {
    colWidths,
    colVisible,
    viewOpts,
    mineOnly,
    tableStatusFilter: filters.statusFilter,
    tablePriorityFilter: filters.priorityFilter,
    tableRootsOnly: filters.rootsOnly,
    tableCriticalOnly: filters.criticalOnly,
    tableSearch: filters.q,
  };
}

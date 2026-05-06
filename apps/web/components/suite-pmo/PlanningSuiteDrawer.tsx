"use client";

import type { Dispatch, SetStateAction } from "react";
import { useMemo, useState } from "react";
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

export function PlanningSuiteDrawer({
  open,
  onClose,
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
  open: boolean;
  onClose: () => void;
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
  const [fieldQ, setFieldQ] = useState("");
  const [saveName, setSaveName] = useState("");

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

  const filteredColIds = useMemo(() => {
    const q = fieldQ.trim().toLowerCase();
    if (!q) return ALL_COLUMN_IDS;
    return ALL_COLUMN_IDS.filter((id) => COL_LABELS[id].toLowerCase().includes(q));
  }, [fieldQ]);

  const shownCols = useMemo(() => filteredColIds.filter((id) => colVisible[id]), [filteredColIds, colVisible]);
  const hiddenCols = useMemo(() => filteredColIds.filter((id) => !colVisible[id]), [filteredColIds, colVisible]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-[2px] dark:bg-black/60"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <aside className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface)] dark:text-[var(--suite-text)]">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-[var(--suite-border)]">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
              Campos y vista
            </p>
            <p className="text-sm font-semibold text-slate-900 dark:text-[var(--suite-text)]">Columnas y preferencias</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
          >
            Cerrar
          </button>
        </div>

        <div className="suite-scroll flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <label className="text-[11px] font-medium text-slate-600 dark:text-[var(--suite-text-muted)]">Buscar campos</label>
            <input
              value={fieldQ}
              onChange={(e) => setFieldQ(e.target.value)}
              placeholder="Nombre de columna…"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
            />
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-400">Se muestran</p>
            <ul className="mt-2 space-y-1.5">
              {shownCols.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-[var(--suite-border-subtle)] dark:bg-[var(--suite-surface-raised)]"
                >
                  <span className="text-[13px] text-slate-800 dark:text-[var(--suite-text)]">{COL_LABELS[id]}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked="true"
                    className="relative h-6 w-11 rounded-full bg-sky-600 transition dark:bg-sky-500"
                    onClick={() => setColVisible((o) => ({ ...o, [id]: false }))}
                  >
                    <span className="absolute right-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                </li>
              ))}
              {shownCols.length === 0 ? <li className="text-xs text-slate-500">Ninguna coincidencia visible.</li> : null}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Oculto</p>
            <ul className="mt-2 space-y-1.5">
              {hiddenCols.map((id) => (
                <li
                  key={id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-2 py-1.5 dark:border-[var(--suite-border-subtle)]"
                >
                  <span className="text-[13px] text-slate-600 dark:text-[var(--suite-text-muted)]">{COL_LABELS[id]}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked="false"
                    className="relative h-6 w-11 rounded-full bg-slate-300 transition dark:bg-slate-600"
                    onClick={() => setColVisible((o) => ({ ...o, [id]: true }))}
                  >
                    <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" />
                  </button>
                </li>
              ))}
              {hiddenCols.length === 0 ? <li className="text-xs text-slate-500">Todo visible.</li> : null}
            </ul>
          </div>

          {showGanttListToggles && ganttListCols && setGanttCol ? (
            <div className="border-t border-slate-200 pt-4 dark:border-[var(--suite-border)]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
                Panel listado Gantt
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                {(Object.keys(ganttLabels) as Array<keyof typeof ganttLabels>).map((id) => (
                  <label key={id} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ganttListCols[id] !== false}
                      onChange={(e) => setGanttCol(id, e.target.checked)}
                    />
                    {ganttLabels[id]}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-4 dark:border-[var(--suite-border)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
              Diseño
            </p>
            <div className="mt-2 space-y-2 text-[12px]">
              <label className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-500 dark:text-[var(--suite-text-muted)]">Densidad</span>
                <select
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                  value={viewOpts.rowDensity}
                  onChange={(e) =>
                    setViewOpts((o) => ({ ...o, rowDensity: e.target.value as PlanningViewOpts["rowDensity"] }))
                  }
                >
                  <option value="compact">Compacta</option>
                  <option value="comfortable">Cómoda</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-slate-500 dark:text-[var(--suite-text-muted)]">Orden</span>
                <select
                  className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                  value={viewOpts.sortBy}
                  onChange={(e) => setViewOpts((o) => ({ ...o, sortBy: e.target.value as PlanningViewOpts["sortBy"] }))}
                >
                  <option value="tree">Árbol WBS</option>
                  <option value="name">Nombre</option>
                  <option value="endDate">Fecha fin</option>
                  <option value="priority">Prioridad</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={viewOpts.filterOverdue}
                  onChange={(e) => setViewOpts((o) => ({ ...o, filterOverdue: e.target.checked }))}
                />
                Solo vencidas
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={viewOpts.filterBlocked}
                  onChange={(e) => setViewOpts((o) => ({ ...o, filterBlocked: e.target.checked }))}
                />
                Solo bloqueadas
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={mineOnly} onChange={(e) => setMineOnly(e.target.checked)} />
                Solo lo mío
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 dark:border-[var(--suite-border)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-[var(--suite-text-muted)]">
              Vistas guardadas
            </p>
            <div className="mt-2 flex gap-1">
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Nombre de la vista"
                className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-[12px] dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
              />
              <button
                type="button"
                className="shrink-0 rounded bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white dark:bg-[var(--suite-accent)] dark:text-white"
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
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[12px]">
              {savedViews.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)]"
                >
                  <button type="button" className="min-w-0 truncate text-left font-medium hover:underline" onClick={() => onApplyView(v)}>
                    {v.name}
                  </button>
                  <button type="button" className="shrink-0 text-rose-600 hover:underline" onClick={() => onDeleteView(v.id)}>
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
      </aside>
    </>
  );
}

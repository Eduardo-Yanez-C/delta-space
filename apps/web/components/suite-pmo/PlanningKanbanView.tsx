"use client";

import { useCallback, useMemo, useState } from "react";
import type { SuiteTaskRow } from "../../lib/api";
import type { TaskStatusConfig } from "../../lib/suite-task-status-config";
import { sortStatusDefs } from "../../lib/suite-task-status-config";
import { formatIsoDateDDMMAAAA } from "../../lib/suite-format-plan-date";

function toneForCategory(_category: string, i: number): string {
  const palettes = [
    "border-slate-200/80 bg-slate-50/50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)]/80",
    "border-sky-200/80 bg-sky-50/40 dark:border-sky-900 dark:bg-sky-950/25",
    "border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20",
    "border-violet-200/80 bg-violet-50/35 dark:border-violet-900 dark:bg-violet-950/20",
    "border-amber-200/80 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/15",
  ];
  return palettes[i % palettes.length]!;
}

function KanbanColumnAdd({
  colId,
  onAdd,
  busy,
}: {
  colId: string;
  onAdd: (name: string, status: string) => Promise<void>;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 w-full rounded-md border border-dashed border-slate-300 py-1.5 text-[11px] font-semibold text-slate-500 hover:border-slate-400 hover:bg-white/60 dark:border-[var(--suite-border)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
      >
        + Añadir tarea
      </button>
    );
  }

  return (
    <form
      className="mt-1 flex flex-col gap-1"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = v.trim();
        if (!n || busy) return;
        await onAdd(n, colId);
        setV("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Título…"
        className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-[12px] dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
      />
      <div className="flex gap-1">
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-md bg-slate-900 py-1 text-[11px] font-semibold text-white disabled:opacity-50 dark:bg-[var(--suite-accent)] dark:text-white"
        >
          Crear
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[11px] text-slate-500 dark:text-[var(--suite-text-muted)]"
        >
          ✕
        </button>
      </div>
    </form>
  );
}

export function PlanningKanbanView({
  tasks,
  statusConfig,
  onMove,
  onCreateInColumn,
  busyId,
}: {
  tasks: SuiteTaskRow[];
  statusConfig: TaskStatusConfig;
  onMove: (taskId: string, newStatus: string) => Promise<void>;
  onCreateInColumn: (name: string, status: string) => Promise<void>;
  busyId: string | null;
}) {
  const [dragId, setDragId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const sorted = sortStatusDefs(statusConfig.statuses);
    return sorted.map((s, i) => ({
      id: s.id,
      label: s.label,
      tone: toneForCategory(s.category, i),
    }));
  }, [statusConfig.statuses]);

  const knownIds = useMemo(() => new Set(columns.map((c) => c.id)), [columns]);

  const byColumn = useMemo(() => {
    const m = new Map<string, SuiteTaskRow[]>();
    for (const c of columns) m.set(c.id, []);
    const other: SuiteTaskRow[] = [];
    for (const t of tasks) {
      if (knownIds.has(t.status)) m.get(t.status)!.push(t);
      else other.push(t);
    }
    if (other.length) {
      m.set("__OTHER__", other);
    }
    return m;
  }, [tasks, columns, knownIds]);

  const displayCols = useMemo(() => {
    const base = [...columns];
    if (byColumn.has("__OTHER__")) {
      base.push({
        id: "__OTHER__",
        label: "Otros estados",
        tone: "border-amber-200/80 bg-amber-50/30 dark:border-amber-900 dark:bg-amber-950/15",
      });
    }
    return base;
  }, [columns, byColumn]);

  const onDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.setData("text/task-id", id);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const onDragEnd = useCallback(() => setDragId(null), []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDropCol = useCallback(
    async (e: React.DragEvent, colId: string) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/task-id") || dragId;
      if (!id || colId === "__OTHER__") return;
      const next = colId;
      const t = tasks.find((x) => x.id === id);
      if (t && t.status === next) return;
      await onMove(id, next);
    },
    [dragId, onMove, tasks],
  );

  return (
    <div className="suite-scroll grid max-h-[min(72vh,calc(100vh-240px))] grid-cols-1 gap-2 overflow-x-auto sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {displayCols.map((col) => (
        <div
          key={col.id}
          className={`flex min-h-0 min-w-[220px] flex-1 flex-col rounded-lg border p-1.5 ${col.tone}`}
          onDragOver={onDragOver}
          onDrop={(e) => onDropCol(e, col.id)}
        >
          <div className="sticky top-0 z-[1] flex shrink-0 items-center justify-between rounded-md bg-inherit px-1.5 py-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-[var(--suite-text)]">
              {col.label}
            </span>
            <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-[var(--suite-text-muted)]">
              {byColumn.get(col.id)?.length ?? 0}
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-0.5 pb-1 pt-0.5">
            {(byColumn.get(col.id) ?? []).map((t) => (
              <button
                key={t.id}
                type="button"
                draggable={col.id !== "__OTHER__"}
                onDragStart={col.id !== "__OTHER__" ? (e) => onDragStart(e, t.id) : undefined}
                onDragEnd={onDragEnd}
                disabled={busyId === t.id || col.id === "__OTHER__"}
                className={`w-full cursor-grab rounded-md border border-slate-200/90 bg-white/95 px-2 py-1.5 text-left text-[12px] shadow-sm transition active:cursor-grabbing dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface)] ${
                  dragId === t.id ? "opacity-60 ring-2 ring-sky-400 dark:ring-[var(--suite-accent)]" : "hover:border-slate-300 dark:hover:border-[var(--suite-border)]"
                } ${busyId === t.id ? "opacity-50" : ""}`}
              >
                <div className="font-medium leading-snug text-slate-900 dark:text-[var(--suite-text)]">
                  {t.wbsCode ? (
                    <span className="mr-1 font-mono text-[10px] text-slate-500 dark:text-[var(--suite-text-muted)]">
                      {t.wbsCode}
                    </span>
                  ) : null}
                  {t.name}
                </div>
                <div className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-slate-500 dark:text-[var(--suite-text-muted)]">
                  <span>
                    {formatIsoDateDDMMAAAA(t.startDate)} → {formatIsoDateDDMMAAAA(t.endDate)}
                  </span>
                  {t.isCritical ? (
                    <span className="rounded bg-red-100 px-1 font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
                      CRIT.
                    </span>
                  ) : null}
                  {t.blocked ? (
                    <span className="rounded bg-amber-100 px-1 font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                      Bloq.
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
          {col.id !== "__OTHER__" ? (
            <KanbanColumnAdd colId={col.id} onAdd={onCreateInColumn} busy={busyId === "new"} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Fragment, useMemo, useState } from "react";
import type { SuiteTaskRow } from "../../lib/api";
import {
  ALL_COLUMN_IDS,
  COL_WIDTH_MAX,
  COL_WIDTH_MIN,
  type PlanningColumnId,
  type PlanningViewOpts,
} from "../../lib/suite-planning-persisted-view";
import {
  type TaskStatusConfig,
  type TaskStatusDef,
  isTerminalDoneStatus,
  sortStatusDefs,
  statusPillFromConfig,
} from "../../lib/suite-task-status-config";
import { formatIsoDateDDMMAAAA } from "../../lib/suite-format-plan-date";
import { orderProjectTasksForDisplay } from "./planning-task-order";
import { ResizableThSuite } from "./ResizableThSuite";

function priorityPill(p: string) {
  const u = p.toUpperCase();
  if (u === "HIGH" || u === "ALTA")
    return { text: "ALTA", className: "text-red-700 dark:text-red-300" };
  if (u === "LOW" || u === "BAJA")
    return { text: "BAJA", className: "text-slate-500 dark:text-[var(--suite-text-muted)]" };
  return { text: "NORMAL", className: "text-slate-600 dark:text-[var(--suite-text-muted)]" };
}

function isOverdue(t: SuiteTaskRow, cfg: TaskStatusConfig): boolean {
  if (isTerminalDoneStatus(t.status, cfg)) return false;
  const end = new Date(t.endDate.slice(0, 10) + "T12:00:00");
  return end < new Date();
}

function priorityRank(p: string): number {
  const u = p.toUpperCase();
  if (u === "HIGH" || u === "ALTA") return 0;
  if (u === "NORMAL") return 1;
  return 2;
}

/** Flecha izquierda: abre/cierra la fila de composición de subtarea debajo. */
function RowExpandChevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden
      className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-90 text-[var(--suite-accent)]" : "text-[var(--suite-text-muted)]"}`}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

/** Sangría horizontal por nivel (misma escala que filas de subtarea). */
const TREE_INDENT_PX = 28;

function InlineSubtaskComposer({
  depth,
  busy,
  onCancel,
  onSave,
}: {
  depth: number;
  busy: boolean;
  onCancel: () => void;
  onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  /* Alinear con una fila hija: borde + sangría del siguiente nivel */
  const pad = 16 + (depth + 1) * TREE_INDENT_PX;
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2 py-1" style={{ paddingLeft: pad }}>
      <label className="min-w-[200px] flex-1 text-[11px] text-[var(--suite-text-muted)]">
        Nueva subtarea
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
            if (e.key === "Enter") {
              e.preventDefault();
              void onSave(name);
            }
          }}
          autoFocus
          disabled={busy}
          placeholder='Nombre de la tarea…'
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
        />
      </label>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text)] dark:hover:bg-[var(--suite-surface-input)]"
      >
        Cancelar
      </button>
      <button
        type="button"
        disabled={busy || !name.trim()}
        onClick={() => void onSave(name.trim())}
        className="rounded-lg bg-[var(--suite-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--suite-accent-hover)] disabled:opacity-50"
      >
        Guardar
      </button>
    </div>
  );
}

function RowHoverActions({
  onSubtask,
  onEdit,
  busyCreate,
}: {
  onSubtask: () => void;
  onEdit: () => void;
  busyCreate: boolean;
}) {
  const btn =
    "pointer-events-auto flex h-6 w-6 items-center justify-center rounded border border-slate-300/90 bg-slate-100 text-slate-700 shadow-sm hover:bg-slate-200 disabled:opacity-40 " +
    "dark:border-[#3d3d3d] dark:bg-[#2a2a2a] dark:text-[#c8c8c8] dark:hover:bg-[#383838] dark:hover:text-white dark:disabled:opacity-40";
  return (
    <div
      className="pointer-events-none absolute right-0 top-1/2 z-[6] flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover/row:pointer-events-auto group-hover/row:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <button type="button" title="Agregar subtarea" className={btn} disabled={busyCreate} onClick={(e) => { e.stopPropagation(); onSubtask(); }}>
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        title="Etiquetas (pronto)"
        className={btn}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18M3 12h12M3 18h8" strokeLinecap="round" />
        </svg>
      </button>
      <button type="button" title="Editar" className={btn} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4 12.5-12.5z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

function RingPct({ pct, compact }: { pct: number; compact: boolean }) {
  const p = Math.min(100, Math.max(0, pct));
  const r = compact ? 21 : 26;
  const c = 2 * Math.PI * r;
  const off = c * (1 - p / 100);
  const sz = compact ? 58 : 72;
  const cx = sz / 2;
  const cy = sz / 2;
  const fs = compact ? 12 : 15;
  const sw = compact ? 4 : 4.5;
  return (
    <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`} className="shrink-0">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-slate-200 dark:stroke-[var(--suite-ring-track)]"
        strokeWidth={sw}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        className="stroke-zinc-800 dark:stroke-[var(--suite-accent)]"
        strokeWidth={sw}
        strokeDasharray={c}
        strokeDashoffset={off}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text
        x={cx}
        y={cy + fs * 0.35}
        textAnchor="middle"
        className="fill-zinc-800 dark:fill-[var(--suite-text)]"
        style={{ fontSize: `${fs}px` }}
        fontWeight="700"
      >
        {Math.round(p)}
      </text>
    </svg>
  );
}

export type PlanningListFiltersState = {
  mine: boolean;
  statusFilter: string;
  priorityFilter: string;
  q: string;
  rootsOnly: boolean;
  criticalOnly: boolean;
};

function sortInGroup(rows: SuiteTaskRow[], sortBy: PlanningViewOpts["sortBy"]): SuiteTaskRow[] {
  if (sortBy === "tree") return rows;
  const copy = [...rows];
  if (sortBy === "name") {
    copy.sort((a, b) => a.name.localeCompare(b.name, "es"));
  } else if (sortBy === "endDate") {
    copy.sort((a, b) => a.endDate.localeCompare(b.endDate) || a.name.localeCompare(b.name, "es"));
  } else if (sortBy === "priority") {
    copy.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || a.name.localeCompare(b.name, "es"));
  }
  return copy;
}

function InlineQuickAdd({
  placeholder,
  status,
  parentTaskId,
  onCreate,
  busy,
}: {
  placeholder: string;
  status: string;
  parentTaskId: string | null;
  onCreate: (name: string, status: string, parentTaskId: string | null) => Promise<void>;
  busy: boolean;
}) {
  const [v, setV] = useState("");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-sky-700 hover:underline dark:text-sky-400"
      >
        + {placeholder}
      </button>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        const n = v.trim();
        if (!n || busy) return;
        await onCreate(n, status, parentTaskId);
        setV("");
        setOpen(false);
      }}
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Nombre de la tarea"
        className="min-w-[160px] flex-1 rounded border border-slate-200 px-2 py-1 text-[12px] dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        Crear
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[11px] text-slate-500 hover:underline dark:text-[var(--suite-text-muted)]"
      >
        Cancelar
      </button>
    </form>
  );
}

export function PlanningListView({
  tasks,
  userId,
  filters,
  statusConfig,
  colWidths,
  colVisible,
  viewOpts,
  onWidthChange,
  onOpenTask,
  onCreateTask,
  busyCreate,
}: {
  tasks: SuiteTaskRow[];
  userId: string | null;
  filters: PlanningListFiltersState;
  statusConfig: TaskStatusConfig;
  colWidths: Record<PlanningColumnId, number>;
  colVisible: Record<PlanningColumnId, boolean>;
  viewOpts: PlanningViewOpts;
  onWidthChange: (id: PlanningColumnId, w: number) => void;
  onOpenTask: (t: SuiteTaskRow) => void;
  onCreateTask: (input: { name: string; status: string; parentTaskId?: string | null }) => Promise<void>;
  busyCreate: boolean;
}) {
  const { mine, statusFilter, priorityFilter, q, rootsOnly, criticalOnly } = filters;
  const [inlineComposerFor, setInlineComposerFor] = useState<string | null>(null);

  const sortedDefs = useMemo(() => sortStatusDefs(statusConfig.statuses), [statusConfig.statuses]);

  const directChildCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks) {
      const p = t.parentTaskId;
      if (!p) continue;
      m.set(p, (m.get(p) ?? 0) + 1);
    }
    return m;
  }, [tasks]);

  const depthMap = useMemo(() => {
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const m = new Map<string, number>();
    for (const t of tasks) {
      let d = 0;
      let p: string | null | undefined = t.parentTaskId;
      while (p) {
        d += 1;
        p = byId.get(p)?.parentTaskId ?? null;
      }
      m.set(t.id, d);
    }
    return m;
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (mine && userId) {
        if (t.assigneeUserId !== userId) return false;
      } else if (mine && !userId) {
        return false;
      }
      if (viewOpts.filterAssigneeId && t.assigneeUserId !== viewOpts.filterAssigneeId) return false;
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority.toUpperCase() !== priorityFilter.toUpperCase()) return false;
      if (q.trim()) {
        const n = `${t.wbsCode ?? ""} ${t.name}`.toLowerCase();
        if (!n.includes(q.trim().toLowerCase())) return false;
      }
      if (rootsOnly && t.parentTaskId) return false;
      if (criticalOnly && !t.isCritical) return false;
      if (viewOpts.filterOverdue && !isOverdue(t, statusConfig)) return false;
      if (viewOpts.filterBlocked && !t.blocked) return false;
      return true;
    });
  }, [tasks, mine, userId, statusFilter, priorityFilter, q, rootsOnly, criticalOnly, viewOpts, statusConfig]);

  const orderedVisible = useMemo(() => orderProjectTasksForDisplay(filtered), [filtered]);

  const groups = useMemo(() => {
    const buckets: { def: TaskStatusDef; rows: SuiteTaskRow[] }[] = sortedDefs.map((def) => ({ def, rows: [] }));
    const idToIdx = new Map(sortedDefs.map((d, i) => [d.id, i]));
    const rest: SuiteTaskRow[] = [];
    for (const t of orderedVisible) {
      const idx = idToIdx.get(t.status);
      if (idx !== undefined) buckets[idx].rows.push(t);
      else rest.push(t);
    }
    return { buckets, rest };
  }, [orderedVisible, sortedDefs]);

  const restDefaultStatus = useMemo(() => {
    const open = sortedDefs.find((d) => d.category !== "done");
    return open?.id ?? sortedDefs[0]?.id ?? "TODO";
  }, [sortedDefs]);

  const visibleColIds = useMemo(() => ALL_COLUMN_IDS.filter((id) => colVisible[id]), [colVisible]);

  const rowPad = viewOpts.rowDensity === "compact" ? "py-1" : "py-2.5";
  const compactRing = viewOpts.rowDensity === "compact";

  return (
    <div className="space-y-6">
      {groups.buckets.map(({ def, rows: rawRows }) => {
        if (rawRows.length === 0) return null;
        const rows = sortInGroup(rawRows, viewOpts.sortBy);
        return (
          <section key={def.id}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-[var(--suite-border)]">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-[var(--suite-text)]">
                {def.label} · {rows.length}
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <InlineQuickAdd
                  placeholder="Rápida"
                  status={def.id}
                  parentTaskId={null}
                  onCreate={(name, status, parent) => onCreateTask({ name, status, parentTaskId: parent ?? undefined })}
                  busy={busyCreate}
                />
              </div>
            </div>
            <ListTable
              rows={rows}
              statusConfig={statusConfig}
              depthMap={depthMap}
              directChildCount={directChildCount}
              visibleColIds={visibleColIds}
              colWidths={colWidths}
              onWidthChange={onWidthChange}
              rowPad={rowPad}
              compactRing={compactRing}
              onOpenTask={onOpenTask}
              onCreateSubtask={(parentId) =>
                onCreateTask({ name: "Nueva subtarea", status: def.id, parentTaskId: parentId })
              }
              busyCreate={busyCreate}
              inlineComposerFor={inlineComposerFor}
              setInlineComposerFor={setInlineComposerFor}
              onInlineSubtaskCreate={async (parent, name) => {
                await onCreateTask({
                  name: name.trim() || "Nueva subtarea",
                  status: parent.status,
                  parentTaskId: parent.id,
                });
                setInlineComposerFor(null);
              }}
            />
          </section>
        );
      })}
      {groups.rest.length > 0 ? (
        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 dark:border-[var(--suite-border)]">
            <h3 className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200/95">
              Otros estados · {groups.rest.length}
            </h3>
            <InlineQuickAdd
              placeholder="Tarea"
              status={restDefaultStatus}
              parentTaskId={null}
              onCreate={(name, status, parent) => onCreateTask({ name, status, parentTaskId: parent ?? undefined })}
              busy={busyCreate}
            />
          </div>
          <ListTable
            rows={sortInGroup(groups.rest, viewOpts.sortBy)}
            statusConfig={statusConfig}
            depthMap={depthMap}
            directChildCount={directChildCount}
            visibleColIds={visibleColIds}
            colWidths={colWidths}
            onWidthChange={onWidthChange}
            rowPad={rowPad}
            compactRing={compactRing}
            onOpenTask={onOpenTask}
            onCreateSubtask={(parentId) =>
              onCreateTask({ name: "Nueva subtarea", status: restDefaultStatus, parentTaskId: parentId })
            }
            busyCreate={busyCreate}
            inlineComposerFor={inlineComposerFor}
            setInlineComposerFor={setInlineComposerFor}
            onInlineSubtaskCreate={async (parent, name) => {
              await onCreateTask({
                name: name.trim() || "Nueva subtarea",
                status: parent.status,
                parentTaskId: parent.id,
              });
              setInlineComposerFor(null);
            }}
          />
        </section>
      ) : null}
    </div>
  );
}

function ListTable({
  rows,
  statusConfig,
  depthMap,
  directChildCount,
  visibleColIds,
  colWidths,
  onWidthChange,
  rowPad,
  compactRing,
  onOpenTask,
  onCreateSubtask,
  busyCreate,
  inlineComposerFor,
  setInlineComposerFor,
  onInlineSubtaskCreate,
}: {
  rows: SuiteTaskRow[];
  statusConfig: TaskStatusConfig;
  depthMap: Map<string, number>;
  directChildCount: Map<string, number>;
  visibleColIds: PlanningColumnId[];
  colWidths: Record<PlanningColumnId, number>;
  onWidthChange: (id: PlanningColumnId, w: number) => void;
  rowPad: string;
  compactRing: boolean;
  onOpenTask: (t: SuiteTaskRow) => void;
  onCreateSubtask: (parentId: string) => void;
  busyCreate: boolean;
  inlineComposerFor: string | null;
  setInlineComposerFor: Dispatch<SetStateAction<string | null>>;
  onInlineSubtaskCreate: (parent: SuiteTaskRow, name: string) => Promise<void>;
}) {
  const alignFor = (id: PlanningColumnId): "left" | "center" | "right" => {
    if (id === "progress") return "center";
    return "left";
  };

  return (
    <div className="suite-scroll overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface)] dark:shadow-[inset_0_1px_0_var(--suite-border-subtle)]">
      <table className="w-max min-w-full border-collapse text-left text-[13px] table-fixed">
        <thead>
          <tr>
            {visibleColIds.map((id) => (
              <ResizableThSuite
                key={id}
                colId={id}
                label={
                  id === "name"
                    ? "Nombre"
                    : id === "status"
                      ? "Estado"
                      : id === "priority"
                        ? "Prior."
                        : id === "assignee"
                          ? "Asignado"
                          : id === "start"
                            ? "Inicio"
                            : id === "end"
                              ? "Fin"
                              : id === "progress"
                                ? "%"
                                : id === "checklist"
                                  ? "Chk."
                                  : id === "deps"
                                    ? "Dep."
                                    : id === "context"
                                      ? "Contexto"
                                      : id === "subs"
                                        ? "Sub."
                                        : String(id)
                }
                width={colWidths[id]}
                minW={COL_WIDTH_MIN[id]}
                maxW={COL_WIDTH_MAX[id]}
                align={alignFor(id)}
                onWidthChange={onWidthChange}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const depth = depthMap.get(t.id) ?? 0;
            const st = statusPillFromConfig(t.status, statusConfig);
            const pr = priorityPill(t.priority);
            const overdue = isOverdue(t, statusConfig);
            const assignee = t.assigneeUser?.name || t.assignedTo || "—";
            const deps =
              t.predecessorIds.length > 0 ? `${t.predecessorIds.length}` : t.dependencyTaskId ? "1" : "—";
            const subs = directChildCount.get(t.id) ?? 0;
            const inlineOpen = inlineComposerFor === t.id;

            const cells: Record<PlanningColumnId, ReactNode> = {
              name: (
                <div
                  className="relative flex min-w-0 items-start gap-1"
                  style={{ paddingLeft: depth * TREE_INDENT_PX }}
                >
                  <button
                    type="button"
                    tabIndex={0}
                    className="mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-black/[0.06] dark:hover:bg-white/10"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInlineComposerFor((cur) => (cur === t.id ? null : t.id));
                    }}
                    aria-expanded={inlineOpen}
                    aria-label={inlineOpen ? "Cerrar fila de nueva subtarea" : "Abrir fila para nueva subtarea debajo"}
                  >
                    <RowExpandChevron open={inlineOpen} />
                  </button>
                  <div className="relative min-w-0 flex-1">
                    <div className="min-w-0 rounded px-0.5 text-left">
                      <span className="font-mono text-[11px] text-slate-500 dark:text-[var(--suite-text-muted)]">
                        {t.wbsCode ?? "—"}
                      </span>
                      <div
                        className={`break-words group-hover/row:text-sky-600 dark:group-hover/row:text-[var(--suite-accent)] ${
                          depth > 0
                            ? "font-normal text-slate-700 dark:font-medium dark:text-[var(--suite-text-secondary)]"
                            : "font-semibold text-slate-900 dark:text-[var(--suite-text)]"
                        }`}
                      >
                        {t.name}
                      </div>
                      {t.isCritical ? (
                        <span className="mt-0.5 inline-block rounded bg-red-100 px-1 text-[10px] font-bold text-red-800 dark:bg-red-950 dark:text-red-200">
                          CRIT.
                        </span>
                      ) : null}
                    </div>
                    <RowHoverActions
                      busyCreate={busyCreate}
                      onSubtask={() => onCreateSubtask(t.id)}
                      onEdit={() => onOpenTask(t)}
                    />
                  </div>
                </div>
              ),
              status: (
                <div className="flex flex-wrap items-center gap-1">
                  <span className={st.className}>{st.text}</span>
                  {overdue ? (
                    <span className="rounded bg-red-100 px-1 text-[9px] font-bold text-red-800 dark:bg-red-950 dark:text-red-200">
                      VENC.
                    </span>
                  ) : null}
                </div>
              ),
              priority: <span className={`text-[11px] font-medium ${pr.className}`}>{pr.text}</span>,
              assignee: <span className="text-slate-600 dark:text-[var(--suite-text-muted)]">{assignee}</span>,
              start: (
                <span className="tabular-nums text-slate-600 dark:text-[var(--suite-text-muted)]">
                  {formatIsoDateDDMMAAAA(t.startDate)}
                </span>
              ),
              end: (
                <span
                  className={`tabular-nums ${overdue ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-[var(--suite-text-muted)]"}`}
                >
                  {formatIsoDateDDMMAAAA(t.endDate)}
                </span>
              ),
              progress: (
                <div className="flex justify-center">
                  <RingPct pct={t.progress} compact={compactRing} />
                </div>
              ),
              checklist: (
                <span className="text-center text-[11px] text-slate-400 dark:text-[var(--suite-text-muted)]">—</span>
              ),
              deps: (
                <span className="text-center font-mono text-[11px] text-slate-500 dark:text-[var(--suite-text-muted)]">
                  {deps}
                </span>
              ),
              context: (
                <span className="line-clamp-2 text-[11px] text-slate-600 dark:text-[var(--suite-text-muted)]">
                  {t.contextNote || t.description || "—"}
                </span>
              ),
              subs: (
                <span className="text-center tabular-nums text-[11px] text-slate-500 dark:text-[var(--suite-text-muted)]">
                  {subs > 0 ? subs : "—"}
                </span>
              ),
            };

            return (
              <Fragment key={t.id}>
                <tr
                  className={`group/row cursor-pointer border-b border-slate-100 hover:bg-slate-50/90 dark:border-[var(--suite-border-subtle)] dark:hover:bg-white/[0.04] ${
                    depth > 0 ? "align-top pt-1.5" : "align-top"
                  }`}
                  onClick={() => onOpenTask(t)}
                >
                  {visibleColIds.map((id) => (
                    <td
                      key={id}
                      className={`align-top text-[13px] pl-1 pr-1 ${rowPad} ${id === "name" ? "max-w-0" : ""} ${
                        depth > 0 && id === "name"
                          ? "border-l-[3px] border-[var(--suite-accent)]/55 pl-1 dark:bg-[var(--suite-surface-input)]/35"
                          : ""
                      }`}
                      style={{ width: colWidths[id], maxWidth: colWidths[id] }}
                    >
                      <div className="min-w-0">{cells[id]}</div>
                    </td>
                  ))}
                </tr>
                {inlineOpen ? (
                  <tr
                    className="border-b border-slate-100 dark:border-[var(--suite-border-subtle)] dark:bg-[var(--suite-surface-input)]/55"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <td colSpan={visibleColIds.length} className="px-2 py-2">
                      <InlineSubtaskComposer
                        depth={depth}
                        busy={busyCreate}
                        onCancel={() => setInlineComposerFor(null)}
                        onSave={async (name) => {
                          await onInlineSubtaskCreate(t, name);
                        }}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PlanningListFiltersBar({
  filters,
  setFilters,
  userId,
  statusOptions,
}: {
  filters: PlanningListFiltersState;
  setFilters: Dispatch<SetStateAction<PlanningListFiltersState>>;
  userId: string | null;
  statusOptions: { id: string; label: string }[];
}) {
  const patch = (p: Partial<PlanningListFiltersState>) => setFilters((f) => ({ ...f, ...p }));
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
        <input
          type="checkbox"
          checked={filters.mine}
          onChange={(e) => patch({ mine: e.target.checked })}
          disabled={!userId}
          className="rounded border-slate-300"
        />
        Solo lo mío
      </label>
      <label className="text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
        Estado
        <select
          value={filters.statusFilter}
          onChange={(e) => patch({ statusFilter: e.target.value })}
          className="mt-0.5 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
        >
          <option value="">Todos los estados</option>
          {statusOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
        Prioridad
        <select
          value={filters.priorityFilter}
          onChange={(e) => patch({ priorityFilter: e.target.value })}
          className="mt-0.5 block rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
        >
          <option value="">Todas</option>
          <option value="NORMAL">Normal</option>
          <option value="HIGH">Alta</option>
          <option value="LOW">Baja</option>
        </select>
      </label>
      <label className="min-w-[160px] flex-1 text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
        Buscar
        <input
          value={filters.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Nombre o WBS…"
          className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
        />
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-600 dark:text-[var(--suite-text-muted)]">
        <input
          type="checkbox"
          checked={filters.rootsOnly}
          onChange={(e) => patch({ rootsOnly: e.target.checked })}
          className="rounded"
        />
        Solo raíces
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold uppercase text-red-700 dark:text-red-400">
        <input
          type="checkbox"
          checked={filters.criticalOnly}
          onChange={(e) => patch({ criticalOnly: e.target.checked })}
          className="rounded"
        />
        Solo críticas
      </label>
    </div>
  );
}

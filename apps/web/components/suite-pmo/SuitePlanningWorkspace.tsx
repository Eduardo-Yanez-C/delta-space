"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createSuiteTask,
  deleteSuiteTask,
  fetchSuiteProject,
  fetchSuiteProjectTasks,
  patchSuiteTask,
  type SuiteProjectDetail,
  type SuiteTaskRow,
} from "../../lib/api";
import { SUITE_AGENT_TASKS_MUTATED_EVENT } from "../../lib/suite-agent-chat";
import { normalizeTaskStatusConfig, sortStatusDefs } from "../../lib/suite-task-status-config";
import { buildSaveSnapshot } from "./PlanningViewControlsSuite";
import { PlanningKanbanView } from "./PlanningKanbanView";
import { PlanningSuiteDrawer } from "./PlanningSuiteDrawer";
import { ProjectStatusesModal } from "./ProjectStatusesModal";
import { PlanningMindMapView } from "./PlanningMindMapView";
import {
  PlanningListFiltersBar,
  PlanningListView,
  type PlanningListFiltersState,
} from "./PlanningListView";
import { SuiteTaskDetailSheet, type SuitePlanningPeerTask } from "./SuiteTaskDetailSheet";
import { useSuitePlanningPrefs } from "./use-suite-planning-prefs";
import type { SavedPlanningView } from "../../lib/suite-planning-persisted-view";
import { useSuiteAgentRuntime } from "../suite-agent/SuiteAgentRuntimeProvider";

const SuiteProjectGantt = dynamic(
  () => import("./SuiteProjectGantt").then((m) => ({ default: m.SuiteProjectGantt })),
  { ssr: false, loading: () => <p className="p-4 text-sm text-slate-500">Cargando Gantt…</p> },
);

export type PlanViewMode = "list" | "kanban" | "gantt" | "mind";

const VIEW_TABS: { id: PlanViewMode; label: string }[] = [
  { id: "list", label: "Vista lista" },
  { id: "kanban", label: "Tablero por estado" },
  { id: "gantt", label: "Vista Gantt" },
  { id: "mind", label: "Mapa mental" },
];

/** TSV para que un LLM interprete el cronograma cargado (lista/Kanban/Gantt). */
function planningTasksAgentTsv(rows: SuiteTaskRow[]): string {
  const hdr = ["wbs", "nombre", "inicio", "fin", "estado", "prioridad", "progreso_pct"].join("\t");
  const body = rows.map((r) =>
    [
      (r.wbsCode ?? "").replace(/\t/g, " "),
      String(r.name ?? "").replace(/\t|\r|\n/g, " "),
      r.startDate,
      r.endDate,
      r.status,
      r.priority,
      String(Math.round(r.progress ?? 0)),
    ].join("\t"),
  );
  return [hdr, ...body].join("\n");
}

function toGanttTasks(rows: SuiteTaskRow[]) {
  return rows.map((t) => ({
    id: t.id,
    projectId: t.projectId,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    progress: t.progress,
    parentTaskId: t.parentTaskId,
    dependencyTaskId: t.dependencyTaskId,
    predecessorIds: t.predecessorIds,
    wbsCode: t.wbsCode,
    sortOrder: t.sortOrder,
    isMilestone: t.isMilestone,
    duration: t.duration,
    baselineStartDate: t.baselineStartDate,
    baselineEndDate: t.baselineEndDate,
    baselineDurationDays: t.baselineDurationDays,
    isCritical: t.isCritical,
  }));
}

export function SuitePlanningWorkspace({
  projectId,
  projectName,
  userId,
  activityActorName,
}: {
  projectId: string;
  projectName: string;
  userId: string | null;
  /** Nombre mostrado en el historial de actividad de la ficha de tarea. */
  activityActorName?: string;
}) {
  const [rows, setRows] = useState<SuiteTaskRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<PlanViewMode>("list");
  const [showQuick, setShowQuick] = useState(false);
  const [showQuickExpanded, setShowQuickExpanded] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [projectDetail, setProjectDetail] = useState<SuiteProjectDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [statusesModalOpen, setStatusesModalOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const quickRef = useRef<HTMLDivElement | null>(null);
  const { mergeRuntime, addAttachment } = useSuiteAgentRuntime();

  const {
    colWidths,
    colVisible,
    setColVisible,
    viewOpts,
    setViewOpts,
    savedViews,
    saveView,
    applyView: applyViewPrefs,
    deleteView,
    onWidthChange,
    ganttListCols,
    setGanttCol,
  } = useSuitePlanningPrefs();

  const [listFilters, setListFilters] = useState<PlanningListFiltersState>({
    mine: false,
    statusFilter: "",
    priorityFilter: "",
    q: "",
    rootsOnly: false,
    criticalOnly: false,
  });

  const [qaName, setQaName] = useState("");
  const [qaStatus, setQaStatus] = useState("TODO");
  const [qaPriority, setQaPriority] = useState("NORMAL");
  const [qaStart, setQaStart] = useState("");
  const [qaEnd, setQaEnd] = useState("");

  const load = useCallback(() => {
    return fetchSuiteProjectTasks(projectId)
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error");
        setRows([]);
      });
  }, [projectId]);

  const handleTaskSheetSaved = useCallback(
    async (updated?: SuiteTaskRow) => {
      if (updated?.id) {
        setRows((prev) => {
          if (!prev) return prev;
          const i = prev.findIndex((t) => t.id === updated.id);
          if (i < 0) return prev;
          const next = [...prev];
          next[i] = { ...next[i], ...updated };
          return next;
        });
      }
      await load();
    },
    [load],
  );

  useEffect(() => {
    setError(null);
    load();
  }, [load]);

  useEffect(() => {
    const onAgentTasks = () => {
      void load();
    };
    window.addEventListener(SUITE_AGENT_TASKS_MUTATED_EVENT, onAgentTasks);
    return () => window.removeEventListener(SUITE_AGENT_TASKS_MUTATED_EVENT, onAgentTasks);
  }, [load]);

  const loadProject = useCallback(() => {
    return fetchSuiteProject(projectId)
      .then(setProjectDetail)
      .catch(() => setProjectDetail(null));
  }, [projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  const statusConfig = useMemo(
    () => normalizeTaskStatusConfig(projectDetail?.taskStatusConfig ?? null),
    [projectDetail?.taskStatusConfig],
  );

  const statusOptions = useMemo(
    () => sortStatusDefs(statusConfig.statuses).map((s) => ({ id: s.id, label: s.label })),
    [statusConfig.statuses],
  );

  useEffect(() => {
    if (statusOptions.length === 0) return;
    setQaStatus((prev) => (statusOptions.some((o) => o.id === prev) ? prev : statusOptions[0]!.id));
  }, [statusOptions]);

  const ganttTasks = useMemo(() => (rows ? toGanttTasks(rows) : []), [rows]);
  const detailTask = useMemo(() => rows?.find((t) => t.id === detailTaskId) ?? null, [rows, detailTaskId]);
  const detailPeerTasks = useMemo((): SuitePlanningPeerTask[] => {
    if (!rows || !detailTaskId) return [];
    return rows
      .filter((t) => t.id !== detailTaskId)
      .map((t) => ({ id: t.id, name: t.name, wbsCode: t.wbsCode }));
  }, [rows, detailTaskId]);

  useEffect(() => {
    if (!rows) return;
    const summaryLines = [
      `Vista: ${view}.`,
      `Tareas cargadas: ${rows.length}.`,
      rows.length
        ? `Muestra: ${rows
            .slice(0, 8)
            .map((t) => `${t.wbsCode ? `${t.wbsCode} ` : ""}${t.name}`)
            .join(" | ")}`
        : "",
    ].filter(Boolean);
    mergeRuntime({
      projectId,
      projectName,
      summary: summaryLines.join("\n"),
    });
  }, [rows, view, projectId, projectName, mergeRuntime]);

  const onMoveKanban = useCallback(
    async (taskId: string, newStatus: string) => {
      setBusyId(taskId);
      try {
        await patchSuiteTask(projectId, taskId, { status: newStatus });
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error al mover");
      } finally {
        setBusyId(null);
      }
    },
    [projectId, load],
  );

  const createTask = useCallback(
    async (input: { name: string; status?: string; priority?: string; startDate?: string; endDate?: string; parentTaskId?: string | null }) => {
      const name = input.name.trim();
      if (!name) return;
      setBusyId("new");
      try {
        await createSuiteTask(projectId, {
          name,
          status: input.status ?? "TODO",
          priority: input.priority ?? "NORMAL",
          startDate: input.startDate || undefined,
          endDate: input.endDate || undefined,
          parentTaskId: input.parentTaskId ?? undefined,
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al crear");
      } finally {
        setBusyId(null);
      }
    },
    [projectId, load],
  );

  const onQuickCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      await createTask({
        name: qaName,
        status: qaStatus,
        priority: qaPriority,
        startDate: qaStart || undefined,
        endDate: qaEnd || undefined,
      });
      setQaName("");
    },
    [createTask, qaName, qaStatus, qaPriority, qaStart, qaEnd],
  );

  const onCreateInKanban = useCallback(
    async (name: string, status: string) => {
      await createTask({ name, status });
    },
    [createTask],
  );

  const handleApplySavedView = useCallback(
    (v: SavedPlanningView) => {
      applyViewPrefs(v);
      setListFilters({
        mine: v.mineOnly,
        statusFilter: v.tableStatusFilter ?? "",
        priorityFilter: v.tablePriorityFilter ?? "",
        rootsOnly: v.tableRootsOnly,
        criticalOnly: v.tableCriticalOnly,
        q: v.tableSearch ?? "",
      });
    },
    [applyViewPrefs],
  );

  const handleSaveNamedView = useCallback(
    (name: string) => {
      saveView(
        name,
        buildSaveSnapshot(colWidths, colVisible, viewOpts, listFilters.mine, {
          statusFilter: listFilters.statusFilter,
          priorityFilter: listFilters.priorityFilter,
          rootsOnly: listFilters.rootsOnly,
          criticalOnly: listFilters.criticalOnly,
          q: listFilters.q,
        }),
      );
    },
    [saveView, colWidths, colVisible, viewOpts, listFilters],
  );

  const focusQuickAdd = useCallback(() => {
    setShowQuick(true);
    setView("list");
    requestAnimationFrame(() => {
      quickRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const el = quickRef.current?.querySelector("input");
      if (el instanceof HTMLInputElement) el.focus();
    });
  }, []);

  if (error && !rows) {
    return <p className="p-4 text-sm text-red-600">{error}</p>;
  }
  if (!rows) {
    return <p className="p-4 text-sm text-slate-500">Cargando planificación…</p>;
  }

  return (
    <div className="suite-app-scope space-y-0">
      <div className="sticky top-[7.5rem] z-20 space-y-0 border-b border-slate-200/90 bg-white/95 shadow-[0_4px_24px_-6px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-neutral-800/90 dark:bg-black/80 dark:shadow-[0_12px_40px_-8px_rgba(0,0,0,0.55)] dark:backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 md:px-5">
          <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-[var(--suite-text)]">Planificación</h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              title="Columnas y vista"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setStatusesModalOpen(true)}
              title="Estados del proyecto"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={focusQuickAdd}
              title="Alta rápida (nombre de tarea)"
              className={`flex h-9 w-9 items-center justify-center rounded-lg border text-slate-600 dark:text-[var(--suite-text-muted)] ${
                showQuick
                  ? "border-sky-500/50 bg-sky-50 dark:border-[var(--suite-accent)]/50 dark:bg-[var(--suite-accent-soft)]"
                  : "border-slate-200 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:hover:bg-[var(--suite-surface-input)]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
            <Link
              href={`/vista-previa-suite/proyectos/${encodeURIComponent(projectId)}`}
              title="Ir al resumen del proyecto"
              className="flex h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
            >
              Resumen
            </Link>
            <button
              type="button"
              title="Adjuntar cronograma actual (TSV) al contexto de SAM"
              onClick={() => {
                const tsv = planningTasksAgentTsv(rows);
                addAttachment({
                  id: `gantt-${Date.now()}`,
                  kind: "gantt_snapshot",
                  title: `Cronograma (${view}) — ${projectName}`,
                  body: `Proyecto: ${projectName}\nID: ${projectId}\nVista: ${view}\nFilas: ${rows.length}\n\n${tsv}`,
                });
              }}
              className="flex h-9 items-center gap-1 rounded-lg border border-violet-300/50 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-2.5 text-xs font-semibold text-violet-900 hover:opacity-95 dark:border-violet-500/35 dark:from-violet-950/50 dark:to-fuchsia-950/40 dark:text-violet-100"
            >
              <span aria-hidden>✦</span>
              IA · Gantt
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200/80 px-3 py-2 dark:border-[var(--suite-border-subtle)] md:px-5">
          {view === "list" ? (
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              title="Filtros y búsqueda"
              className={`flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium ${
                filtersOpen
                  ? "border-sky-500/40 bg-sky-50 text-sky-900 dark:border-sky-500/40 dark:bg-sky-950/50 dark:text-sky-100"
                  : "border-slate-200 text-slate-600 dark:border-[#3d3d3d] dark:text-[#9b9b9b]"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
              Filtros
            </button>
          ) : null}
          {VIEW_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setView(t.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                view === t.id
                  ? "bg-slate-900 text-white shadow-sm dark:bg-[var(--suite-accent)] dark:text-white dark:shadow-[0_0_0_1px_rgba(91,140,255,0.35)]"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-raised)] dark:text-[var(--suite-text-muted)] dark:hover:bg-[var(--suite-surface-input)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {showQuick ? (
          <div ref={quickRef} className="border-t border-slate-200/80 px-3 py-2 dark:border-[var(--suite-border)] md:px-5">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#8f8f8f]">Alta rápida</p>
              <button
                type="button"
                onClick={() => setShowQuick(false)}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-[#8f8f8f] dark:hover:text-[#ececec]"
              >
                Ocultar
              </button>
            </div>
            <form onSubmit={onQuickCreate} className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <label className="min-w-[200px] flex-1 text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
                  Nombre
                  <input
                    value={qaName}
                    onChange={(e) => setQaName(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)] dark:placeholder:text-[var(--suite-text-muted)]"
                    placeholder="Nueva tarea"
                  />
                </label>
                <button
                  type="submit"
                  disabled={busyId === "new"}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
                >
                  Crear
                </button>
                <button
                  type="button"
                  onClick={() => setShowQuickExpanded((x) => !x)}
                  className="text-xs font-medium text-sky-700 underline dark:text-sky-400"
                >
                  {showQuickExpanded ? "Menos opciones" : "Más opciones"}
                </button>
              </div>
              {showQuickExpanded ? (
                <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3 dark:border-[var(--suite-border)]">
                  <label className="text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
                    Estado
                    <select
                      value={qaStatus}
                      onChange={(e) => setQaStatus(e.target.value)}
                      className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                    >
                      {statusOptions.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
                    Prioridad
                    <select
                      value={qaPriority}
                      onChange={(e) => setQaPriority(e.target.value)}
                      className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">Alta</option>
                      <option value="LOW">Baja</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
                    Inicio
                    <input
                      type="date"
                      value={qaStart}
                      onChange={(e) => setQaStart(e.target.value)}
                      className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                    />
                  </label>
                  <label className="text-xs text-slate-600 dark:text-[var(--suite-text-muted)]">
                    Fin
                    <input
                      type="date"
                      value={qaEnd}
                      onChange={(e) => setQaEnd(e.target.value)}
                      className="mt-0.5 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface-input)] dark:text-[var(--suite-text)]"
                    />
                  </label>
                </div>
              ) : null}
            </form>
          </div>
        ) : null}

        {view === "list" && filtersOpen ? (
          <div className="border-t border-slate-200/80 px-3 py-3 dark:border-[var(--suite-border)] md:px-5">
            <PlanningListFiltersBar
              filters={listFilters}
              setFilters={setListFilters}
              userId={userId}
              statusOptions={statusOptions}
            />
          </div>
        ) : null}
      </div>

      {error ? <p className="px-4 py-2 text-sm text-amber-800 dark:text-amber-200 md:px-6">{error}</p> : null}

      <div className="px-2 py-4 md:px-4 dark:bg-[var(--suite-page-bg)]">
        {view === "list" ? (
          <PlanningListView
            tasks={rows}
            userId={userId}
            filters={listFilters}
            statusConfig={statusConfig}
            colWidths={colWidths}
            colVisible={colVisible}
            viewOpts={viewOpts}
            onWidthChange={onWidthChange}
            onOpenTask={(t) => setDetailTaskId(t.id)}
            onCreateTask={createTask}
            busyCreate={busyId === "new"}
          />
        ) : null}
        {view === "kanban" ? (
          <PlanningKanbanView
            tasks={rows}
            statusConfig={statusConfig}
            onMove={onMoveKanban}
            onCreateInColumn={onCreateInKanban}
            busyId={busyId}
          />
        ) : null}
        {view === "gantt" ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-[var(--suite-border)] dark:bg-[var(--suite-surface)] dark:shadow-lg dark:shadow-black/20">
            <SuiteProjectGantt
              tasks={ganttTasks}
              emptyMessage="No hay tareas en este proyecto."
              selectedTaskId={detailTaskId}
              onTaskClick={(id) => setDetailTaskId(id)}
              ganttListCols={ganttListCols}
            />
          </div>
        ) : null}
        {view === "mind" ? <PlanningMindMapView tasks={rows} projectName={projectName} /> : null}
      </div>

      <PlanningSuiteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        colVisible={colVisible}
        setColVisible={setColVisible}
        viewOpts={viewOpts}
        setViewOpts={setViewOpts}
        savedViews={savedViews}
        onSaveView={handleSaveNamedView}
        onApplyView={handleApplySavedView}
        onDeleteView={deleteView}
        mineOnly={listFilters.mine}
        setMineOnly={(v) => setListFilters((f) => ({ ...f, mine: v }))}
        ganttListCols={ganttListCols}
        setGanttCol={setGanttCol}
        showGanttListToggles={view === "gantt"}
      />

      <ProjectStatusesModal
        open={statusesModalOpen}
        onClose={() => setStatusesModalOpen(false)}
        projectId={projectId}
        initialRaw={projectDetail?.taskStatusConfig ?? null}
        onSaved={() => {
          void load();
          void loadProject();
        }}
      />

      <SuiteTaskDetailSheet
        projectId={projectId}
        projectName={projectName}
        task={detailTask}
        statusConfig={statusConfig}
        open={detailTaskId !== null}
        onClose={() => setDetailTaskId(null)}
        onSaved={handleTaskSheetSaved}
        statusOptions={statusOptions}
        activityActorName={activityActorName}
        peerTasks={detailPeerTasks}
        onAddSubtask={async (parentTaskId) => {
          await createTask({ name: "Nueva subtarea", parentTaskId });
          setDetailTaskId(null);
        }}
        onDeleteTask={async (taskId) => {
          await deleteSuiteTask(projectId, taskId);
          void load();
        }}
      />
    </div>
  );
}

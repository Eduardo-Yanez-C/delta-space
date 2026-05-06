"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { replaceProjectLocations, type ProjectLocation, type SuiteWorkspacePayload } from "../../lib/api";
import { hasSuiteNavGrant } from "../../lib/suite-nav-grants";
import { ProjectLocationsModal } from "../projects/ProjectLocationsModal";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

function healthLabel(health: string): { text: string; className: string } {
  const h = String(health || "").toUpperCase();
  if (h === "RED")
    return { text: "Rojo · requiere decisión", className: "bg-red-600 text-white hover:bg-red-700" };
  if (h === "YELLOW")
    return { text: "Amarillo · seguimiento cercano", className: "bg-amber-500 text-white hover:bg-amber-600" };
  return { text: "Verde · en curso", className: "bg-emerald-600 text-white hover:bg-emerald-700" };
}

function planVsRealBadge(ws: SuiteWorkspacePayload): { label: string; tone: "red" | "amber" | "slate" } {
  const { deviationPctVsWeighted, deviationPctVsCalendar } = ws.planVsReal;
  if (deviationPctVsWeighted < -3 || deviationPctVsCalendar < -3)
    return { label: "Atrasado al plan", tone: "red" };
  if (deviationPctVsWeighted < 0 || deviationPctVsCalendar < 0)
    return { label: "Ligero desvío", tone: "amber" };
  return { label: "Alineado / adelantado", tone: "slate" };
}

function workloadTone(ws: SuiteWorkspacePayload): "red" | "amber" | "slate" {
  const w = String(ws.workloadBrief?.worstSignal || "").toLowerCase();
  if (w === "danger" || w === "critical") return "red";
  if (w === "warning") return "amber";
  return "slate";
}

type Props = { ws: SuiteWorkspacePayload; projectId: string };

export function SuiteProjectWorkspaceDashboard({ ws, projectId }: Props) {
  const { user } = useAuth();
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);
  const canSeeLogistica = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const [locationsModalOpen, setLocationsModalOpen] = useState(false);
  const [locationsDraft, setLocationsDraft] = useState<ProjectLocation[]>(() => {
    const existing = ws.project.locations ?? [];
    if (existing.length) return existing;
    if (ws.project.location?.trim()) {
      return [
        {
          kind: "SITE",
          label: "Obra principal",
          address: ws.project.location.trim(),
          latitude: null,
          longitude: null,
          notes: "",
          isPrimary: true,
        },
      ];
    }
    return [
      {
        kind: "SITE",
        label: "Obra principal",
        address: "",
        latitude: null,
        longitude: null,
        notes: "",
        isPrimary: true,
      },
    ];
  });
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [savingLocations, setSavingLocations] = useState(false);
  const base = `/vista-previa-suite/proyectos/${encodeURIComponent(projectId)}`;
  const planningHref = `${base}/planning`;
  const inventarioHref = `/vista-previa-suite/logistica/inventario?projectId=${encodeURIComponent(projectId)}`;
  const operacionIntlHref = `/vista-previa-suite/logistica/operacion-internacional?projectId=${encodeURIComponent(projectId)}`;
  const m = (slug: string) => `${base}/modulo/${slug}`;
  const hl = healthLabel(ws.executive.health);
  const pvr = planVsRealBadge(ws);
  const loadTone = workloadTone(ws);
  const pendingApprox =
    ws.kpis.overdueTasks +
    ws.commitmentsSummary.openOverdue +
    ws.milestonesExecutive.counts.overdue +
    ws.kpis.criticalRisks;

  const openLocations = useCallback(() => {
    setLocationsError(null);
    setLocationsDraft(ws.project.locations?.length ? ws.project.locations : locationsDraft);
    setLocationsModalOpen(true);
  }, [ws.project.locations, locationsDraft]);

  const saveLocations = useCallback(
    async (next: ProjectLocation[]) => {
      if (!canWrite) return;
      setLocationsError(null);
      setSavingLocations(true);
      try {
        const saved = await replaceProjectLocations(projectId, next);
        setLocationsDraft(saved);
      } catch (e) {
        setLocationsError(e instanceof Error ? e.message : "No se pudieron guardar las ubicaciones");
      } finally {
        setSavingLocations(false);
      }
    },
    [projectId, canWrite],
  );

  const locationsForView = (ws.project.locations?.length ? ws.project.locations : locationsDraft) ?? [];
  const primaryLoc = locationsForView.find((l) => l.isPrimary) ?? locationsForView[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa suite · Proyecto</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {ws.project.name}{" "}
            <span className="font-mono text-base font-normal text-slate-500 dark:text-slate-400">
              ({ws.project.code})
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">{ws.project.client}</span>
            {ws.project.endDate ? (
              <>
                {" "}
                · Fin planificado <span className="tabular-nums">{formatDate(ws.project.endDate)}</span>
              </>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs uppercase text-slate-500">Estado proyecto: {ws.project.status}</p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <div className="flex flex-wrap justify-end gap-2">
            <Link
              href={planningHref}
              className="rounded-lg border border-slate-200 bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Planificación (Gantt)
            </Link>
            {canSeeLogistica ? (
              <>
                <Link
                  href={inventarioHref}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Inventario logístico
                </Link>
                <Link
                  href={operacionIntlHref}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  Operación internacional
                </Link>
              </>
            ) : null}
            <Link
              href={m("riesgos")}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              Riesgos del proyecto
            </Link>
            <Link
              href="/vista-previa-suite/proyectos"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Volver
            </Link>
          </div>
          <button
            type="button"
            className={`rounded-lg px-4 py-2 text-left text-sm font-semibold shadow-sm ${hl.className}`}
            title={ws.executive.reasons.join(", ")}
          >
            {hl.text}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {[
          { k: "Salud", v: ws.executive.health, sub: `${ws.executive.reasons.length} factor(es)` },
          { k: "Avance real", v: `${ws.kpis.progressFromTasks}%`, sub: "ponderado tareas" },
          {
            k: "Plan vs real",
            v: `${ws.planVsReal.progressReal}% / ${ws.planVsReal.progressPlannedWeighted}%`,
            sub: "real vs plan tareas",
          },
          { k: "Vencidas", v: String(ws.kpis.overdueTasks), sub: "tareas" },
          { k: "Riesgos crít.", v: String(ws.kpis.criticalRisks), sub: `de ${ws.kpis.activeRisks} activos` },
          { k: "Comprom. venc.", v: String(ws.commitmentsSummary.openOverdue), sub: "abiertos" },
          {
            k: "Carga",
            v: ws.workloadBrief.assigneeBuckets ? `${ws.workloadBrief.assigneeBuckets} resp.` : "—",
            sub:
              ws.workloadBrief.assigneesWithOverdue > 0
                ? `${ws.workloadBrief.assigneesWithOverdue} con vencidas · ${ws.workloadBrief.worstSignal}`
                : `señal ${ws.workloadBrief.worstSignal}`,
          },
        ].map((card) => (
          <div
            key={card.k}
            className={`rounded-xl border p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${
              card.k === "Carga" && loadTone === "red"
                ? "border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30"
                : card.k === "Carga" && loadTone === "amber"
                  ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25"
                  : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{card.k}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{card.v}</p>
            <p className="mt-0.5 text-xs text-slate-500">{card.sub}</p>
          </div>
        ))}
      </section>

      {pendingApprox > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <span>
            Aprox. <strong>{pendingApprox}</strong> ítem(s) que requieren atención (vencidas, hitos, riesgos críticos,
            compromisos).
          </span>
          <Link href={planningHref} className="font-semibold text-amber-900 underline dark:text-amber-200">
            Ir al cronograma
          </Link>
        </div>
      ) : null}

      {/* Módulos integrados */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Operaciones PMO integradas</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Link
            href={planningHref}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Planificación</p>
            <p className="mt-1 text-xs text-slate-500">Tareas + cronograma Gantt</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums">{ws.kpis.tasksDone}</span> /{" "}
              <span className="tabular-nums">{ws.kpis.tasksTotal}</span> hechas ·{" "}
              <span className="tabular-nums">{ws.kpis.tasksInProgress}</span> en curso
            </p>
          </Link>
          <Link
            href={m("carga")}
            className={`block rounded-xl border p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 ${
              loadTone === "red"
                ? "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
                : loadTone === "amber"
                  ? "border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/25"
                  : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Carga operativa</p>
            <p className="mt-1 text-xs text-slate-500">Responsables, atrasos y bloqueos</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums">{ws.workloadBrief.assigneeBuckets}</span> responsable(s) ·
              <span className="tabular-nums"> {ws.workloadBrief.assigneesWithOverdue}</span> con vencidas ·
              <span className="tabular-nums"> {ws.workloadBrief.assigneesWithBlocked}</span> con bloqueos ·
              <span className="tabular-nums"> {ws.taskDependencies.blockedTaskCount}</span> tareas bloqueadas
            </p>
          </Link>
          <Link
            href={m("documentos")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Documentos</p>
            <p className="mt-1 text-xs text-slate-500">Ingeniería, HSEC, contratos</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums">{ws.kpis.documentsTotal}</span> en proyecto
            </p>
          </Link>
          <Link
            href={m("riesgos")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Riesgos del proyecto</p>
            <p className="mt-1 text-xs text-slate-500">Matriz + lista PMO</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums">{ws.kpis.activeRisks}</span> activos ·{" "}
              <span className="tabular-nums">{ws.kpis.criticalRisks}</span> críticos
            </p>
          </Link>
          <Link
            href={m("recursos")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recursos</p>
            <p className="mt-1 text-xs text-slate-500">Asignación a la obra</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums">{ws.kpis.resourcesAssigned}</span> asignados ·{" "}
              <span className="tabular-nums">{ws.kpis.resourceOperational}</span> operativos
            </p>
          </Link>
          <Link
            href={m("ia-pmo")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm opacity-90 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">IA</p>
            <p className="mt-1 text-xs text-slate-500">Resúmenes y alertas (vista previa)</p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Generado <span className="tabular-nums text-slate-800 dark:text-slate-200">{formatDate(ws.generatedAt)}</span>
            </p>
          </Link>
          <Link
            href={m("hitos")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hitos ejecutivos</p>
            <p className="mt-1 text-xs text-slate-500">Fechas plan, criticidad</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums text-red-700 dark:text-red-400">
                {ws.milestonesExecutive.counts.overdue}
              </span>{" "}
              atrasados ·{" "}
              <span className="tabular-nums">{ws.milestonesExecutive.upcoming.length}</span> próximos (muestra)
            </p>
          </Link>
          <Link
            href={m("decisiones")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Decisiones</p>
            <p className="mt-1 text-xs text-slate-500">Gobierno y acuerdos</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold tabular-nums">{ws.decisionsCount}</span> registradas
            </p>
          </Link>
          <Link
            href={m("compromisos")}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600"
          >
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Compromisos</p>
            <p className="mt-1 text-xs text-slate-500">Plazos y responsables</p>
            <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
              <span className="font-bold text-red-700 tabular-nums dark:text-red-400">
                {ws.commitmentsSummary.openOverdue}
              </span>{" "}
              vencidos ·{" "}
              <span className="tabular-nums">{ws.commitmentsSummary.dueNext14Days}</span> próx. 14 días
            </p>
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Plan vs real */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Plan vs real (cronograma)</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                pvr.tone === "red"
                  ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                  : pvr.tone === "amber"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              }`}
            >
              {pvr.label}
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Avance real %</dt>
              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {ws.planVsReal.progressReal}%
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Plan por tareas %</dt>
              <dd className="font-semibold tabular-nums">{ws.planVsReal.progressPlannedWeighted}%</dd>
            </div>
            <div>
              <dt className="text-slate-500">Plan calendario %</dt>
              <dd className="font-semibold tabular-nums">{ws.planVsReal.progressPlannedCalendar}%</dd>
            </div>
            <div>
              <dt className="text-slate-500">Brecha vs plan tareas</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  ws.planVsReal.deviationPctVsWeighted < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {ws.planVsReal.deviationPctVsWeighted > 0 ? "+" : ""}
                {ws.planVsReal.deviationPctVsWeighted} pp
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Brecha vs calendario</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  ws.planVsReal.deviationPctVsCalendar < 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {ws.planVsReal.deviationPctVsCalendar > 0 ? "+" : ""}
                {ws.planVsReal.deviationPctVsCalendar} pp
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Días equivalentes de atraso</dt>
              <dd
                className={`font-semibold tabular-nums ${
                  ws.planVsReal.scheduleSlipDays > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-slate-100"
                }`}
              >
                {ws.planVsReal.scheduleSlipDays > 0 ? "+" : ""}
                {ws.planVsReal.scheduleSlipDays} d
              </dd>
            </div>
          </dl>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
            Línea base (fin efectiva): <span className="tabular-nums">{formatDate(ws.planVsReal.baselineEnd)}</span> ·
            inicio proyecto: <span className="tabular-nums">{formatDate(ws.planVsReal.projectStart)}</span>
          </p>
        </section>

        {/* Dependencias */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Dependencias entre tareas</h2>
            <Link href={planningHref} className="text-sm font-medium text-primary-600 underline">
              Planificación →
            </Link>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
            <li>
              <span className="font-semibold tabular-nums">{ws.taskDependencies.dependencyEdgeCount}</span>{" "}
              dependencias (aristas)
            </li>
            <li>
              <span className="font-semibold tabular-nums">{ws.taskDependencies.blockedTaskCount}</span> tareas
              bloqueadas por predecesoras no terminadas
            </li>
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Decisiones recientes</h2>
          {ws.recentDecisions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin decisiones.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {ws.recentDecisions.slice(0, 5).map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                >
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{d.title}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {formatDate(d.decisionDate)} · impacto {d.impact} · {d.category} · {d.status}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Compromisos (prioridad)</h2>
          {ws.recentCommitments.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Sin compromisos.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {ws.recentCommitments.slice(0, 6).map((c) => {
                const due = new Date(c.dueDate);
                const st = String(c.status || "").toUpperCase();
                const open = !["DONE", "CANCELLED", "CANCELED"].includes(st);
                const late = open && due < new Date();
                return (
                  <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{c.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatDate(c.dueDate)} · {c.sourceType}
                        {c.owner ? ` · ${c.owner}` : ""}
                      </p>
                    </div>
                    {late ? (
                      <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800 dark:bg-red-950 dark:text-red-200">
                        VENCIDO
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">{c.status}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Hitos ejecutivos</h2>
          {ws.milestonesExecutive.overdue.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase text-red-700 dark:text-red-400">Atrasados</p>
              <ul className="mt-1 space-y-2">
                {ws.milestonesExecutive.overdue.slice(0, 4).map((m) => (
                  <li
                    key={m.id}
                    className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-sm dark:border-red-900/50 dark:bg-red-950/20"
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-100">{m.name}</span>
                    <span className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                      {formatDate(m.plannedDate)} · {m.criticality} · {m.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={ws.milestonesExecutive.overdue.length ? "mt-4" : "mt-3"}>
            <p className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">Próximos</p>
            {ws.milestonesExecutive.upcoming.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500">Sin próximos en ventana.</p>
            ) : (
              <ul className="mt-1 space-y-2">
                {ws.milestonesExecutive.upcoming.slice(0, 5).map((m) => (
                  <li key={m.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{m.name}</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      {formatDate(m.plannedDate)} · {m.criticality}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Alertas activas (calculadas)</h2>
          <ul className="mt-3 space-y-2">
            {ws.alerts.map((a) => (
              <li
                key={a.id ?? a.code}
                className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                  a.level === "danger"
                    ? "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100"
                    : a.level === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-100"
                      : "border-slate-100 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                }`}
              >
                <span>{a.message}</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">{a.code}</span>
              </li>
            ))}
          </ul>
          {ws.alertsHistory.length === 0 ? (
            <p className="mt-4 text-xs text-slate-500">
              Historial de alertas persistidas: no disponible en esta vista previa (solo alertas en vivo desde reglas).
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Documentos por tipo</h2>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(ws.kpis.documentsByType).map(([t, n]) => (
              <li key={t} className="rounded-full bg-slate-100 px-2 py-1 font-medium dark:bg-slate-800">
                {t}: <span className="tabular-nums">{n}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs font-semibold uppercase text-slate-500">Últimos documentos</p>
          <ul className="mt-2 space-y-2 text-sm">
            {ws.recentDocuments.map((d) => (
              <li key={d.id} className="text-slate-700 dark:text-slate-200">
                <span className="font-medium">{d.name}</span>
                <span className="block text-xs text-slate-500">{d.type ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Riesgos (activos, muestra)</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ws.topRisks.map((r) => (
              <li key={r.id} className="rounded border border-slate-100 p-2 dark:border-slate-700">
                <p className="text-slate-800 dark:text-slate-100">{r.description}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {r.severity} · {r.status}
                  {r.dueDate ? ` · vence ${formatDate(r.dueDate)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Recursos en obra</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {ws.assignedResources.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 border-b border-slate-50 pb-2 last:border-0 dark:border-slate-800">
                <span className="text-slate-800 dark:text-slate-100">{r.name}</span>
                <span className="shrink-0 text-xs text-slate-500">
                  {r.type} · {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Línea de tiempo (mixta)</h2>
        <p className="mt-1 text-xs text-slate-500">Decisiones, compromisos y alertas recientes (orden descendente).</p>
        <ul className="mt-4 space-y-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700">
          {ws.timeline.slice(0, 15).map((item, i) => (
            <li key={`${item.at}-${i}`} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-400" />
              <span className="font-mono text-xs text-slate-500">{formatDate(item.at)}</span>
              <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase dark:bg-slate-800">
                {item.kind}
              </span>
              <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">{item.title}</p>
              {item.detail ? <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{item.detail}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Datos generales</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Cliente</dt>
            <dd className="font-medium text-slate-900 dark:text-slate-100">{ws.project.client}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ubicación</dt>
            <dd className="text-slate-800 dark:text-slate-200">
              {primaryLoc?.address?.trim() || primaryLoc?.label?.trim() || ws.project.location?.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Inicio</dt>
            <dd className="tabular-nums">{formatDate(ws.project.startDate)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Término</dt>
            <dd className="tabular-nums">{formatDate(ws.project.endDate)}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <div className="min-w-[16rem]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ubicaciones</p>
            {locationsForView.length ? (
              <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
                {locationsForView.slice(0, 3).map((l) => (
                  <li key={`${l.kind}-${l.label}-${l.id ?? "draft"}`} className="flex flex-wrap gap-x-2">
                    <span className="font-semibold">
                      {l.label}
                      {l.isPrimary ? <span className="ml-2 text-[10px] font-bold text-primary-600">Principal</span> : null}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">{l.address?.trim() ? `· ${l.address}` : ""}</span>
                    {l.latitude != null && l.longitude != null ? (
                      <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        · {l.latitude.toFixed(6)},{l.longitude.toFixed(6)}
                      </span>
                    ) : null}
                  </li>
                ))}
                {locationsForView.length > 3 ? (
                  <li className="text-xs text-slate-500">+{locationsForView.length - 3} más…</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">Sin ubicaciones definidas.</p>
            )}
            {locationsError ? (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{locationsError}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={openLocations}
            disabled={!canWrite || savingLocations}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
            title={!canWrite ? "No tiene permisos para editar ubicaciones." : "Editar ubicaciones en mapa"}
          >
            {savingLocations ? "Guardando…" : "Editar ubicaciones (mapa)"}
          </button>
        </div>
        {ws.project.description?.trim() ? (
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
            {ws.project.description}
          </p>
        ) : null}
        <p className="mt-4 text-xs text-slate-500">
          KPIs actualizados según snapshot del servidor:{" "}
          <span className="font-mono tabular-nums">{ws.generatedAt}</span>. Avance con pesos y criticidad en tareas.
        </p>
      </section>

      <ProjectLocationsModal
        open={locationsModalOpen}
        onClose={() => setLocationsModalOpen(false)}
        value={locationsDraft}
        onChange={(next) => void saveLocations(next)}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Origen comercial</h2>
        <p className="mt-1 text-xs text-slate-500">
          Vínculos externos y handoff desde cotización (las líneas transferidas completas siguen en DELTA SPACE).
        </p>
        {ws.project.commercialLinks.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">Sin vínculos registrados.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {ws.project.commercialLinks.map((l) => (
              <li
                key={l.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60"
              >
                <span className="font-mono text-xs">{l.externalSystem}</span> · ref{" "}
                <span className="font-mono">{l.externalRef}</span>
                {l.metadata ? <span className="mt-1 block text-xs text-slate-500">{l.metadata}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
        Flujo sugerido: <strong>Planificación (Gantt)</strong> → Carga / responsables → Riesgos → Compromisos →
        informe ejecutivo. Esta vista consolida datos vía API NestJS + PostgreSQL (vista previa en Software de
        Cotizaciones).
      </section>
    </div>
  );
}

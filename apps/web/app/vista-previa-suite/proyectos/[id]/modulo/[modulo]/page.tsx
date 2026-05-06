"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../../../lib/auth-context";
import { fetchSuiteProjectWorkspace, type SuiteWorkspacePayload } from "../../../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../../../lib/suite-nav-grants";
import { ProjectMrbRiskMatrixPanel } from "../../../../../../components/risks/ProjectMrbRiskMatrixPanel";
import { useSuiteAgentRuntime } from "../../../../../../components/suite-agent/SuiteAgentRuntimeProvider";
import { dispatchSuiteAgentOpenPanel } from "../../../../../../lib/suite-agent-chat";

const MODULOS = [
  "carga",
  "documentos",
  "riesgos",
  "recursos",
  "ia-pmo",
  "hitos",
  "decisiones",
  "compromisos",
] as const;
type ModuloKey = (typeof MODULOS)[number];

function isModulo(s: string): s is ModuloKey {
  return (MODULOS as readonly string[]).includes(s);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export default function ProyectoModuloPage() {
  const { mergeRuntime } = useSuiteAgentRuntime();
  const router = useRouter();
  const params = useParams();
  const id = String(params.id ?? "");
  const rawModulo = String(params.modulo ?? "");
  const modulo = isModulo(rawModulo) ? rawModulo : null;

  const { user, loading: authLoading } = useAuth();
  const [ws, setWs] = useState<SuiteWorkspacePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/vista-previa-suite/proyectos/${encodeURIComponent(id)}`;

  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "proyectos"),
    [user?.suiteNavGrants, user?.roles],
  );

  const titleForAgent = useMemo(() => {
    if (!modulo) return "";
    return modulo === "carga"
      ? "Carga operativa"
      : modulo === "documentos"
        ? "Documentos"
        : modulo === "riesgos"
          ? "Riesgos del proyecto"
          : modulo === "recursos"
            ? "Recursos"
            : modulo === "ia-pmo"
              ? "IA"
              : modulo === "hitos"
                ? "Hitos ejecutivos"
                : modulo === "decisiones"
                  ? "Decisiones"
                  : "Compromisos";
  }, [modulo]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canSee) {
      router.replace("/acceso-restringido");
      return;
    }
    if (!id || !modulo) return;
    let cancelled = false;
    fetchSuiteProjectWorkspace(id)
      .then((p) => {
        if (!cancelled) setWs(p);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canSee, id, modulo, router]);

  useEffect(() => {
    if (!ws?.project || !modulo) return;
    mergeRuntime({
      projectId: ws.project.id,
      projectName: ws.project.name,
      summary: `Módulo del proyecto: ${titleForAgent}. Código ${ws.project.code}.`,
    });
  }, [ws, modulo, titleForAgent, mergeRuntime]);

  if (!modulo) {
    return (
      <main className="p-6">
        <p className="text-sm text-slate-600">Módulo no válido.</p>
        <Link href={id ? base : "/vista-previa-suite/proyectos"} className="mt-4 inline-block text-sm text-primary-600 underline">
          Volver al proyecto
        </Link>
      </main>
    );
  }

  if (authLoading || (!user && !error)) return <p className="p-6 text-sm text-slate-600">Cargando…</p>;
  if (error) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-600">{error}</p>
        <Link href={base} className="mt-4 inline-block text-sm text-primary-600 underline">
          Volver al resumen
        </Link>
      </main>
    );
  }
  if (!ws) return <p className="p-6 text-sm text-slate-500">Cargando módulo…</p>;

  const title =
    modulo === "carga"
      ? "Carga operativa"
      : modulo === "documentos"
        ? "Documentos"
        : modulo === "riesgos"
          ? "Riesgos del proyecto"
          : modulo === "recursos"
            ? "Recursos"
            : modulo === "ia-pmo"
              ? "IA"
              : modulo === "hitos"
                ? "Hitos ejecutivos"
                : modulo === "decisiones"
                  ? "Decisiones"
                  : "Compromisos";

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Proyecto · {ws.project.code}</p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{ws.project.name}</p>
        </div>
        <Link
          href={base}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          ← Resumen del proyecto
        </Link>
      </div>

      {modulo === "riesgos" ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Matriz y fichas MRB / HSEC solo para este proyecto. El resumen ejecutivo multi-proyecto sigue en el menú
            lateral &quot;Riesgos&quot; si lo necesitas.
          </p>
          <RiesgosProyectoTabs projectId={id} />
        </div>
      ) : null}

      {modulo === "carga" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Responsables con tareas asignadas: <strong>{ws.workloadBrief.assigneeBuckets}</strong>. Con tareas vencidas:{" "}
            <strong>{ws.workloadBrief.assigneesWithOverdue}</strong>. Con predecesoras pendientes (bloqueo):{" "}
            <strong>{ws.workloadBrief.assigneesWithBlocked}</strong>.
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            Tareas bloqueadas por dependencias: <strong>{ws.taskDependencies.blockedTaskCount}</strong>. Para editar
            fechas y dependencias usa el cronograma.
          </p>
          <Link
            href={`${base}/planning`}
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            Abrir cronograma (Gantt)
          </Link>
        </section>
      ) : null}

      {modulo === "documentos" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Por tipo</h2>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs">
            {Object.entries(ws.kpis.documentsByType).map(([t, n]) => (
              <li key={t} className="rounded-full bg-slate-100 px-2 py-1 font-medium dark:bg-slate-800">
                {t}: {n}
              </li>
            ))}
          </ul>
          <h2 className="mt-6 text-sm font-semibold text-slate-800 dark:text-slate-100">Listado</h2>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {ws.recentDocuments.map((d) => (
              <li key={d.id} className="py-3 text-sm">
                <span className="font-medium text-slate-900 dark:text-slate-100">{d.name}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {d.type ?? "—"} · {formatDate(d.uploadedAt)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modulo === "recursos" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ws.assignedResources.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="font-medium text-slate-900 dark:text-slate-100">{r.name}</span>
                <span className="text-xs text-slate-500">
                  {r.type} · {r.status}
                </span>
                {r.notes ? <span className="w-full text-xs text-slate-600 dark:text-slate-400">{r.notes}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modulo === "ia-pmo" ? (
        <section className="space-y-4 rounded-xl border border-violet-200/60 bg-gradient-to-br from-violet-50/90 to-white p-5 shadow-sm dark:border-violet-500/30 dark:from-violet-950/40 dark:to-slate-900">
          <div>
            <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">SAM (proyecto)</h2>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              El chat con modelo (listar / crear / editar tareas, etc.) está en la burbuja morada{" "}
              <strong className="text-violet-800 dark:text-violet-200">✦ SAM</strong>, arriba del icono de mensajes
              del chat interno. Requiere API Nest con <code className="rounded bg-white/80 px-1 dark:bg-black/30">OPENAI_API_KEY</code>.
            </p>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Panel ejecutivo de métricas: sigue en{" "}
              <Link href={base} className="font-semibold text-primary-600 underline">
                Resumen
              </Link>
              . Snapshot servidor: {ws.generatedAt}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => dispatchSuiteAgentOpenPanel()}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-violet-500"
            >
              Abrir SAM (burbuja)
            </button>
            <Link
              href={`${base}/planning`}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              Ir a planificación
            </Link>
          </div>
        </section>
      ) : null}

      {modulo === "hitos" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">Atrasados</h2>
            <ul className="mt-3 space-y-2">
              {ws.milestonesExecutive.overdue.map((m) => (
                <li key={m.id} className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-sm dark:border-red-900/40 dark:bg-red-950/20">
                  <span className="font-medium">{m.name}</span>
                  <span className="mt-1 block text-xs text-slate-600">
                    {formatDate(m.plannedDate)} · {m.criticality} · {m.status}
                  </span>
                </li>
              ))}
              {ws.milestonesExecutive.overdue.length === 0 ? (
                <p className="text-sm text-slate-500">Sin hitos atrasados.</p>
              ) : null}
            </ul>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Próximos</h2>
            <ul className="mt-3 space-y-2">
              {ws.milestonesExecutive.upcoming.map((m) => (
                <li key={m.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-700">
                  <span className="font-medium">{m.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {formatDate(m.plannedDate)} · {m.criticality}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {modulo === "decisiones" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ul className="space-y-4">
            {ws.recentDecisions.map((d) => (
              <li key={d.id} className="rounded-lg border border-slate-100 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{d.title}</p>
                {d.description ? <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{d.description}</p> : null}
                <p className="mt-2 text-xs text-slate-500">
                  {formatDate(d.decisionDate)} · {d.category} · impacto {d.impact} · {d.status}
                  {d.responsible ? ` · ${d.responsible}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {modulo === "compromisos" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {ws.recentCommitments.map((c) => {
              const due = new Date(c.dueDate);
              const st = String(c.status || "").toUpperCase();
              const open = !["DONE", "CANCELLED", "CANCELED"].includes(st);
              const late = open && due < new Date();
              return (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{c.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(c.dueDate)} · {c.sourceType}
                      {c.owner ? ` · ${c.owner}` : ""}
                    </p>
                  </div>
                  {late ? (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">VENCIDO</span>
                  ) : (
                    <span className="text-xs text-slate-500">{c.status}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function RiesgosProyectoTabs({ projectId }: { projectId: string }) {
  const [layer, setLayer] = useState<"all" | "mrb" | "hsec">("mrb");
  const risksListPath =
    layer === "hsec"
      ? `/projects/${encodeURIComponent(projectId)}/risks?matrixKind=HSEC`
      : layer === "mrb"
        ? `/projects/${encodeURIComponent(projectId)}/risks?matrixKind=MRB`
        : `/projects/${encodeURIComponent(projectId)}/risks`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-lg border border-amber-200 bg-amber-50/80 p-0.5 dark:border-amber-900/50 dark:bg-amber-950/25">
        {(
          [
            ["mrb", "MRB"],
            ["hsec", "HSEC"],
            ["all", "Todos"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setLayer(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              layer === k ? "bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100" : "text-slate-600 hover:bg-white/70 dark:hover:bg-slate-800/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ProjectMrbRiskMatrixPanel
        key={risksListPath}
        scope="portfolio"
        risksListPath={risksListPath}
        showProjectColumn={false}
        mineOnly={false}
        portfolioRiskCategory="OPERATIONAL"
        portfolioMatrixKind={layer === "hsec" ? "HSEC" : "MRB"}
        fixedProjectId={projectId}
        onReloadParent={async () => {}}
      />
    </div>
  );
}

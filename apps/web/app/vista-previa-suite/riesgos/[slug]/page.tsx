"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "../../../../lib/riesgos-api";
import { RISK_CATEGORY_ENTRIES, type RiskCategorySlug, slugToRiskCategoryCode } from "../../../../lib/risk-categories";
import { useSuiteAgentRuntime } from "../../../../components/suite-agent/SuiteAgentRuntimeProvider";
import { ProjectMrbRiskMatrixPanel } from "../../../../components/risks/ProjectMrbRiskMatrixPanel";

type RiskRow = {
  id: string;
  description: string;
  severity: string;
  probability: string;
  status: string;
  projectId: string;
  project: { id: string; name: string; code: string };
};

function isValidSlug(s: string): s is RiskCategorySlug {
  return RISK_CATEGORY_ENTRIES.some((e) => e.slug === s);
}

function CategoryInvalid() {
  return (
    <main className="p-8">
      <p className="text-sm text-slate-600">Categoría inválida.</p>
      <Link href="/vista-previa-suite/riesgos" className="mt-4 inline-block text-sm text-indigo-700 underline">
        Volver
      </Link>
    </main>
  );
}

function translateRiskStatus(status: string): string {
  const u = status.toUpperCase();
  if (u === "OPEN") return "Abierto";
  if (u === "MITIGATING") return "Mitigando";
  if (u === "MITIGATED") return "Mitigado";
  if (u === "CLOSED") return "Cerrado";
  return status;
}

function translateRiskScale(scale: string): string {
  const u = String(scale).trim().toUpperCase();
  if (u === "1") return "1";
  if (u === "2") return "2";
  if (u === "3") return "3";
  if (u === "4") return "4";
  if (u === "5") return "5";
  return scale;
}

function CategoryBody({ slug }: { slug: RiskCategorySlug }) {
  const { mergeRuntime } = useSuiteAgentRuntime();
  const code = slugToRiskCategoryCode(slug)!;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "list" ? "list" : searchParams.get("view") === "projects" ? "projects" : "matrix";
  const [projectFilter, setProjectFilter] = useState("");
  const operationalMatrixKind = slug === "operacional" ? (searchParams.get("layer") === "hsec" ? "HSEC" : "MRB") : null;

  const risksListPath = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set("riskCategory", code);
    if (operationalMatrixKind) qs.set("matrixKind", operationalMatrixKind);
    const pf = projectFilter.trim();
    if (pf) qs.set("projectId", pf);
    return `/risks?${qs.toString()}`;
  }, [code, projectFilter, operationalMatrixKind]);

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reloadList = useCallback(() => {
    const qs = new URLSearchParams();
    qs.set("riskCategory", code);
    if (operationalMatrixKind) qs.set("matrixKind", operationalMatrixKind);
    if (projectFilter.trim()) qs.set("projectId", projectFilter.trim());
    return apiGet<RiskRow[]>(`/risks?${qs.toString()}`).then(setRows);
  }, [code, projectFilter, operationalMatrixKind]);

  useEffect(() => {
    if (view !== "list" && view !== "projects") return;
    reloadList().catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [reloadList, view]);

  const setViewAndUrl = useCallback(
    (next: "matrix" | "list" | "projects") => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === "matrix") p.delete("view");
      else p.set("view", next);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const setOperationalLayer = useCallback(
    (next: "mrb" | "hsec") => {
      const p = new URLSearchParams(searchParams.toString());
      if (next === "mrb") p.delete("layer");
      else p.set("layer", "hsec");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const byProject = useMemo(() => {
    const m = new Map<string, { project: RiskRow["project"]; count: number; open: number }>();
    for (const row of rows) {
      const cur = m.get(row.projectId);
      const isOpen = row.status.toUpperCase() !== "CLOSED" && row.status.toUpperCase() !== "MITIGATED";
      if (!cur) {
        m.set(row.projectId, { project: row.project, count: 1, open: isOpen ? 1 : 0 });
      } else {
        cur.count += 1;
        if (isOpen) cur.open += 1;
      }
    }
    return Array.from(m.values()).sort((a, b) => a.project.code.localeCompare(b.project.code));
  }, [rows]);

  const categoryTitle =
    slug === "operacional"
      ? "Operacional"
      : slug === "estrategico"
        ? "Estratégico"
        : slug === "financiero"
          ? "Financiero"
          : slug === "cumplimiento-legal"
            ? "Cumplimiento / Legal"
            : "Reputacional";

  const categorySubtitle =
    slug === "operacional"
      ? "Matriz MRB y capa HSEC (cuando aplique)."
      : slug === "estrategico"
        ? "Riesgos estratégicos del portafolio."
        : slug === "financiero"
          ? "Riesgos financieros del portafolio."
          : slug === "cumplimiento-legal"
            ? "Riesgos de cumplimiento / legales."
            : "Riesgos reputacionales.";

  useEffect(() => {
    mergeRuntime({
      summary: [
        `Módulo Riesgos — categoría «${categoryTitle}» (${slug}).`,
        `Vista: ${view}.`,
        operationalMatrixKind ? `Capa operacional: ${operationalMatrixKind}.` : "",
        projectFilter.trim() ? `Filtro proyecto: ${projectFilter.trim()}.` : "",
        `Registros en lista (cuando aplica): ${rows.length}.`,
        error ? `Error: ${error}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }, [
    slug,
    view,
    rows.length,
    operationalMatrixKind,
    categoryTitle,
    projectFilter,
    error,
    mergeRuntime,
  ]);

  return (
    <main className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            <Link href="/vista-previa-suite/riesgos" className="text-indigo-700 underline">
              Riesgos
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">{categoryTitle}</h1>
          <p className="mt-1 text-sm text-slate-600">{categorySubtitle}</p>
        </div>
        <Link
          href="/vista-previa-suite/riesgos/ejecutivo"
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        >
          Resumen ejecutivo
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
        {(
          [
            ["matrix", "Matriz"],
            ["list", "Lista"],
            ["projects", "Por proyecto"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setViewAndUrl(k)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              view === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/60"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {slug === "operacional" ? (
        <div className="flex flex-wrap gap-1 rounded-lg border border-amber-200 bg-amber-50/80 p-0.5">
          {(
            [
              ["mrb", "MRB"],
              ["hsec", "HSEC"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setOperationalLayer(k)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                (k === "hsec") === (searchParams.get("layer") === "hsec")
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:bg-white/70"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {view === "matrix" ? (
        <ProjectMrbRiskMatrixPanel
          key={risksListPath}
          scope="portfolio"
          risksListPath={risksListPath}
          showProjectColumn
          mineOnly={false}
          portfolioRiskCategory={code}
          portfolioMatrixKind={slug === "operacional" ? (operationalMatrixKind ?? "MRB") : "MRB"}
          onReloadParent={async () => {
            await reloadList();
          }}
        />
      ) : null}

      {view === "list" || view === "projects" ? (
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {view === "list" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="text-xs text-slate-600">
                Filtrar por projectId
                <input
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  placeholder="projectId"
                  className="mt-1 w-full max-w-md rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
                />
              </label>
            </div>
          ) : null}

          {view === "list" ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Proyecto</th>
                    <th className="px-4 py-3">Descripción</th>
                    <th className="px-4 py-3">Sev/Prob</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50 align-top">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-slate-900">{row.project.code}</span>
                        <div className="text-xs text-slate-500">{row.project.name}</div>
                      </td>
                      <td className="px-4 py-3">{row.description}</td>
                      <td className="px-4 py-3">
                        {translateRiskScale(row.severity)} / {translateRiskScale(row.probability)}
                      </td>
                      <td className="px-4 py-3">{translateRiskStatus(row.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === "projects" ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                Agrupación rápida por proyecto.
              </p>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Proyecto</th>
                    <th className="px-4 py-3 text-right">Riesgos</th>
                    <th className="px-4 py-3 text-right">Abiertos</th>
                    <th className="px-4 py-3 text-right">Ejecutivo</th>
                  </tr>
                </thead>
                <tbody>
                  {byProject.map(({ project, count, open }) => (
                    <tr key={project.id} className="border-b border-slate-50">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold">{project.code}</span>
                        <div className="text-xs text-slate-500">{project.name}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{count}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{open}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/vista-previa-suite/proyectos/${encodeURIComponent(project.id)}/modulo/riesgos`}
                          className="text-xs font-semibold text-indigo-700 underline"
                        >
                          Abrir en proyecto
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

function CategoryGate() {
  const params = useParams();
  const slug = String(params.slug ?? "");
  if (!isValidSlug(slug)) return <CategoryInvalid />;
  return <CategoryBody slug={slug} />;
}

export default function RiskCategoryPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Cargando…</p>}>
      <CategoryGate />
    </Suspense>
  );
}


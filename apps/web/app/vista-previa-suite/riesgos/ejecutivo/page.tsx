"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSuiteAgentRuntime } from "../../../../components/suite-agent/SuiteAgentRuntimeProvider";
import { apiGet } from "../../../../lib/riesgos-api";
import { RISK_CATEGORY_ENTRIES } from "../../../../lib/risk-categories";

function categoryLabelFromCode(code: string): string {
  switch (code) {
    case "OPERATIONAL":
      return "Operacional";
    case "STRATEGIC":
      return "Estratégico";
    case "FINANCIAL":
      return "Financiero";
    case "COMPLIANCE_LEGAL":
      return "Cumplimiento / Legal";
    case "REPUTATIONAL":
      return "Reputacional";
    default:
      return code;
  }
}

const CHART_COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1"];

type ExecutivePayload = {
  totals: {
    projectCount: number;
    totalRisks: number;
    openRisks: number;
    highInherentRisks: number;
    byCategory: Record<string, number>;
  };
  projects: Array<{
    id: string;
    code: string;
    name: string;
    status: string;
    client: string;
    riskCount: number;
    openCount: number;
    highInherentCount: number;
    byCategory: Record<string, number>;
  }>;
};

function ExecutiveInner() {
  const { mergeRuntime } = useSuiteAgentRuntime();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId")?.trim() || "";
  const [data, setData] = useState<ExecutivePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return apiGet<ExecutivePayload>(`/risks/executive${qs}`).then(setData);
  }, [projectId]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [load]);

  useEffect(() => {
    if (!data) return;
    const t = data.totals;
    mergeRuntime({
      summary: [
        "Módulo Riesgos — resumen ejecutivo (datos desde API /risks/executive).",
        `KPIs: ${t.projectCount} proyectos, ${t.totalRisks} riesgos, ${t.openRisks} abiertos, ${t.highInherentRisks} altos inherentes.`,
        projectId ? `Filtro de proyecto: ${projectId}.` : "Sin filtro de proyecto.",
      ].join("\n"),
    });
  }, [data, projectId, mergeRuntime]);

  const barData = useMemo(
    () =>
      (data?.projects ?? [])
        .filter((p) => p.riskCount > 0)
        .map((p) => ({
          name: p.code,
          fullName: p.name,
          riesgos: p.riskCount,
          abiertos: p.openCount,
          altos: p.highInherentCount,
          id: p.id,
        })),
    [data],
  );

  const pieCategory = useMemo(() => {
    const bc = data?.totals.byCategory ?? {};
    return RISK_CATEGORY_ENTRIES.map((e) => ({
      name: categoryLabelFromCode(e.code),
      value: bc[e.code] ?? 0,
      slug: e.slug,
    })).filter((x) => x.value > 0);
  }, [data]);

  if (error) return <p className="p-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="p-6 text-sm text-slate-500">Cargando…</p>;

  const t = data.totals;

  return (
    <main className="space-y-6 p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa de suite</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">Riesgos — Resumen ejecutivo</h1>
          <p className="mt-1 text-sm text-slate-600">KPIs, gráficos y detalle por proyecto.</p>
          {projectId ? (
            <p className="mt-2 text-xs text-slate-500">
              Filtrado por proyecto.{" "}
              <Link href="/vista-previa-suite/riesgos/ejecutivo" className="font-medium text-indigo-700 underline">
                Limpiar filtro
              </Link>
            </p>
          ) : null}
        </div>
        <Link href="/vista-previa-suite/riesgos" className="text-sm text-slate-600 underline">
          Volver a Riesgos
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Proyectos", String(t.projectCount)],
            ["Riesgos totales", String(t.totalRisks)],
            ["Abiertos", String(t.openRisks)],
            ["Altos/Extremos", String(t.highInherentRisks)],
          ] as const
        ).map(([label, val]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{val}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Por proyecto</p>
          <div className="mt-2 h-72 w-full">
            {barData.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as { fullName?: string } | undefined;
                      return p?.fullName ?? "";
                    }}
                  />
                  <Legend />
                  <Bar dataKey="riesgos" name="Total" fill="#334155" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="abiertos" name="Abiertos" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="altos" name="Altos" fill="#e11d48" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Por categoría</p>
          <div className="mt-2 h-72 w-full">
            {pieCategory.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label>
                    {pieCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Proyecto</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-right">Riesgos</th>
              <th className="px-4 py-3 text-right">Abiertos</th>
              <th className="px-4 py-3 text-right">Altos</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {data.projects.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-3">
                  <span className="font-mono font-semibold text-slate-900">{p.code}</span>
                  <div className="text-xs text-slate-500">{p.name}</div>
                </td>
                <td className="px-4 py-3 text-slate-600">{p.client}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.riskCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.openCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{p.highInherentCount}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/vista-previa-suite/proyectos/${encodeURIComponent(p.id)}/modulo/riesgos`}
                    className="text-xs text-indigo-700 underline"
                  >
                    Ver en proyecto
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-500">Tip: si no aparecen proyectos, crea al menos uno en el API (módulo Projects).</p>
    </main>
  );
}

export default function RiesgosExecutivePage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm text-slate-500">Cargando…</p>}>
      <ExecutiveInner />
    </Suspense>
  );
}


"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { apiGet, apiSend } from "../../lib/riesgos-api";
import { riskToMrbMatrixV1 } from "../../lib/mrb-risk-display";
import { inherentFromValues, MRB_IMPACT_LEVELS, MRB_PROBABILITY_LEVELS } from "../../lib/mrb-matrix";

const PROB_OPTIONS = ["Casi certeza", "Posible", "Moderado", "Improbable", "Muy Improbable"] as const;
const IMPACT_OPTIONS = ["Catastrófico", "Mayores", "Moderados", "Menores", "Insignificantes"] as const;
const PERIODICITY = ["Permanente", "Periódico", "Ocasional", "No determinado"] as const;
const OPPORTUNITY = ["Preventivo", "Correctivo", "Detectivo", "No determinado"] as const;
const AUTOMATION = ["Manual", "Semi automáticos", "Automáticos", "No determinado"] as const;

const CHART_COLORS = ["#0f172a", "#334155", "#64748b", "#94a3b8", "#cbd5e1", "#e2e8f0"];

const RISK_STATUS_FORM_VALUES = ["OPEN", "MITIGATING", "MITIGATED", "CLOSED"] as const;

function translateRiskStatus(status: string): string {
  const u = status.toUpperCase();
  if (u === "OPEN") return "Abierto";
  if (u === "MITIGATING") return "Mitigando";
  if (u === "MITIGATED") return "Mitigado";
  if (u === "CLOSED") return "Cerrado";
  return status;
}

function inherentSeverityStyle(sev: string): { bg: string; text: string } {
  const u = sev.toUpperCase();
  if (u.includes("EXTREMO")) return { bg: "bg-rose-600", text: "text-white" };
  if (u.includes("ALTO")) return { bg: "bg-orange-500", text: "text-white" };
  if (u.includes("MODERADO")) return { bg: "bg-amber-400", text: "text-slate-900" };
  if (u.includes("BAJO")) return { bg: "bg-emerald-500", text: "text-white" };
  return { bg: "bg-slate-200", text: "text-slate-800" };
}

function residualBadgeClass(cls: string): string {
  const u = cls.toLowerCase();
  if (u.includes("no aceptable")) return "bg-rose-100 text-rose-900 ring-1 ring-rose-200";
  if (u.includes("mayor")) return "bg-orange-100 text-orange-900 ring-1 ring-orange-200";
  if (u.includes("media")) return "bg-amber-100 text-amber-900 ring-1 ring-amber-200";
  if (u.includes("menor")) return "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200";
  return "bg-slate-100 text-slate-700";
}

function inherentBarFill(name: string): string {
  const u = name.toUpperCase();
  if (u.includes("EXTREMO")) return "#e11d48";
  if (u.includes("ALTO")) return "#f97316";
  if (u.includes("MODERADO")) return "#fbbf24";
  if (u.includes("BAJO")) return "#22c55e";
  return "#64748b";
}

function formatQuotient(n: number): string {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export type RiskRow = {
  id: string;
  description: string;
  severity: string;
  probability: string;
  mitigation?: string | null;
  status: string;
  owner?: string | null;
  ownerUserId?: string | null;
  ownerUser?: { id: string; name: string; email: string } | null;
  dueDate?: string | null;
  mrbMatrix?: Record<string, unknown> | null;
  riskCategory?: string;
  matrixKind?: string;
  project?: { id: string; name: string; code: string };
};

type PortfolioPanelProps = {
  scope: "portfolio";
  risksListPath: string;
  showProjectColumn: boolean;
  portfolioRiskCategory?: string;
  portfolioMatrixKind?: "MRB" | "HSEC";
  /** Vista dentro de un proyecto: el alta de riesgo se asocia siempre a este id (sin selector de portafolio). */
  fixedProjectId?: string;
};

type Props = {
  mineOnly: boolean;
  onReloadParent: () => Promise<void>;
} & PortfolioPanelProps;

export function ProjectMrbRiskMatrixPanel(props: Props) {
  const {
    mineOnly,
    onReloadParent,
    risksListPath,
    showProjectColumn,
    portfolioRiskCategory,
    portfolioMatrixKind,
    fixedProjectId,
  } = props;
  const totalCols = showProjectColumn ? 28 : 27;
  const critColStickyBase = showProjectColumn
    ? "sticky left-[9.5rem] min-w-[220px] max-w-[320px]"
    : "sticky left-10 min-w-[220px] max-w-[320px]";
  const critColSticky = `${critColStickyBase} z-10`;
  const numColSticky = "sticky left-0 z-10 w-10 min-w-[2.5rem]";
  const projColSticky = "sticky left-10 z-10 w-28 min-w-[7rem]";
  const theadStickyZ = "z-[38]";
  const theadRow2Top = "top-11";

  const [rows, setRows] = useState<RiskRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    const qs = new URLSearchParams();
    if (mineOnly) qs.set("mine", "1");
    const q = qs.toString();
    const path = q ? `${risksListPath}&${q}` : risksListPath;
    return apiGet<RiskRow[]>(path).then(setRows);
  }, [risksListPath, mineOnly]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  const enriched = useMemo(() => rows.map((row) => ({ row, ...riskToMrbMatrixV1(row) })), [rows]);

  const heatCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const { matrix } of enriched) {
      const k = `${matrix.probabilityValue}-${matrix.impactValue}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [enriched]);

  const statusChartData = useMemo(() => {
    const acc = new Map<string, number>();
    for (const { row } of enriched) acc.set(row.status, (acc.get(row.status) ?? 0) + 1);
    return Array.from(acc.entries()).map(([code, value]) => ({
      code,
      name: translateRiskStatus(code),
      value,
    }));
  }, [enriched]);

  const inherentChartData = useMemo(() => {
    const acc = new Map<string, number>();
    for (const { matrix } of enriched) acc.set(matrix.inherentSeverity, (acc.get(matrix.inherentSeverity) ?? 0) + 1);
    return Array.from(acc.entries()).map(([name, count]) => ({ name, count }));
  }, [enriched]);

  const residualChartData = useMemo(() => {
    const acc = new Map<string, number>();
    for (const { matrix } of enriched) acc.set(matrix.residualClass, (acc.get(matrix.residualClass) ?? 0) + 1);
    return Array.from(acc.entries()).map(([name, count]) => ({ name, count }));
  }, [enriched]);

  const [heatmapFilter, setHeatmapFilter] = useState<{ pv: number; iv: number } | null>(null);
  const [rightTab, setRightTab] = useState<"dashboard" | "risks" | "executive">("dashboard");
  const [selectedRiskId, setSelectedRiskId] = useState<string | null>(null);

  const filteredEnriched = useMemo(() => {
    if (!heatmapFilter) return enriched;
    return enriched.filter((e) => e.matrix.probabilityValue === heatmapFilter.pv && e.matrix.impactValue === heatmapFilter.iv);
  }, [enriched, heatmapFilter]);

  const selectedEnriched = useMemo(
    () => enriched.find((e) => e.row.id === selectedRiskId) ?? null,
    [enriched, selectedRiskId],
  );

  const executiveStats = useMemo(() => {
    const total = enriched.length;
    const open = enriched.filter((e) => e.row.status !== "CLOSED").length;
    const highInherent = enriched.filter((e) => /EXTREMO|ALTO/i.test(e.matrix.inherentSeverity)).length;
    const badResidual = enriched.filter((e) => /No Aceptable|Mayor/i.test(e.matrix.residualClass)).length;
    const top = [...enriched].sort((a, b) => b.matrix.inherentValue - a.matrix.inherentValue).slice(0, 5);
    return { total, open, highInherent, badResidual, top };
  }, [enriched]);

  const [form, setForm] = useState({
    event: "",
    cause: "",
    consequence: "",
    probabilityLabel: "Moderado",
    impactLabel: "Moderados",
    keyControl: "",
    controlPeriodicity: "Permanente",
    controlOpportunity: "Preventivo",
    controlAutomation: "Manual",
    genericStrategy: "",
    validationDate: "",
    validator: "",
    treatmentObjective: "",
    treatmentActions: "",
    treatmentResponsible: "",
    treatmentDeadline: "",
    treatmentProgressPct: "",
    treatmentEvidence: "",
    mitigation: "",
    status: "OPEN",
  });

  type ProjectPick = { id: string; code: string; name: string };
  const [portfolioProjects, setPortfolioProjects] = useState<ProjectPick[]>([]);
  const [portfolioTargetId, setPortfolioTargetId] = useState("");

  useEffect(() => {
    if (fixedProjectId) {
      setPortfolioTargetId(fixedProjectId);
      return;
    }
    apiGet<Array<{ id: string; code: string; name: string }>>("/projects")
      .then((list) => setPortfolioProjects(list.map((p) => ({ id: p.id, code: p.code, name: p.name }))))
      .catch(() => setPortfolioProjects([]));
  }, [fixedProjectId]);

  async function onSubmitPortfolioMrb(e: React.FormEvent) {
    e.preventDefault();
    const pid = (fixedProjectId ?? portfolioTargetId).trim();
    if (!pid) {
      setError("Debes seleccionar un proyecto para crear el riesgo.");
      return;
    }
    setSaving(true);
    setError(null);
    const critical = `${form.event.trim()}${form.cause.trim() ? `, debido a ${form.cause.trim()}` : ""}${form.consequence.trim() ? ` genera ${form.consequence.trim()}` : ""}`.trim();
    const mk = portfolioMatrixKind === "HSEC" ? "HSEC" : "MRB";
    const rc = (portfolioRiskCategory ?? "OPERATIONAL").trim() || "OPERATIONAL";
    const body = {
      description: critical || "Riesgo MRB",
      severity: "MODERADO",
      probability: "3",
      matrixKind: mk,
      riskCategory: rc,
      mitigation: form.mitigation.trim() || undefined,
      status: form.status,
      mrbMatrix: {
        event: form.event,
        cause: form.cause,
        consequence: form.consequence,
        keyControl: form.keyControl,
        controlPeriodicity: form.controlPeriodicity,
        controlOpportunity: form.controlOpportunity,
        controlAutomation: form.controlAutomation,
        genericStrategy: form.genericStrategy,
        validationDate: form.validationDate || null,
        validator: form.validator,
        treatmentObjective: form.treatmentObjective,
        treatmentActions: form.treatmentActions,
        treatmentResponsible: form.treatmentResponsible,
        treatmentDeadline: form.treatmentDeadline || null,
        treatmentProgressPct: form.treatmentProgressPct ? Number(form.treatmentProgressPct) : null,
        treatmentEvidence: form.treatmentEvidence,
        probabilityLabel: form.probabilityLabel,
        impactLabel: form.impactLabel,
      },
    };
    try {
      await apiSend(`/projects/${pid}/risks`, "POST", body);
      setForm({
        event: "",
        cause: "",
        consequence: "",
        probabilityLabel: "Moderado",
        impactLabel: "Moderados",
        keyControl: "",
        controlPeriodicity: "Permanente",
        controlOpportunity: "Preventivo",
        controlAutomation: "Manual",
        genericStrategy: "",
        validationDate: "",
        validator: "",
        treatmentObjective: "",
        treatmentActions: "",
        treatmentResponsible: "",
        treatmentDeadline: "",
        treatmentProgressPct: "",
        treatmentEvidence: "",
        mitigation: "",
        status: "OPEN",
      });
      await reload();
      await onReloadParent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  const dashboardCharts = (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-3">
      <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
        <div className="h-52 w-full">
          {statusChartData.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68}>
                  {statusChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Severidad inherente</p>
        <div className="h-52 w-full">
          {inherentChartData.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inherentChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {inherentChartData.map((entry, i) => (
                    <Cell key={i} fill={inherentBarFill(entry.name)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-slate-100 bg-white p-2 shadow-sm sm:col-span-2 xl:col-span-1 2xl:col-span-1">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Residual</p>
        <div className="h-52 w-full">
          {residualChartData.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">Sin datos.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={residualChartData} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {residualChartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">Matriz MRB (portafolio). Puedes filtrar por celdas y crear riesgos MRB.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="text-xs text-slate-600">
        <p>Registros cargados: {rows.length}</p>
        <p className="mt-1 text-[11px] text-slate-500">Fuente: API local (Nest) — módulo Riesgos.</p>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <section className="shrink-0 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm xl:max-w-md xl:min-w-[320px]">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Mapa de calor</h3>
            <p className="mt-1 text-xs text-slate-600">Selecciona una celda para filtrar.</p>
          </div>
          {heatmapFilter ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-900">
                Filtro activo: P{heatmapFilter.pv}×I{heatmapFilter.iv} · {filteredEnriched.length} riesgos
              </span>
              <button
                type="button"
                onClick={() => {
                  setHeatmapFilter(null);
                  setSelectedRiskId(null);
                }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-50"
              >
                Limpiar
              </button>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-medium uppercase text-slate-500">Probabilidad</div>
            <div>
              <div className="mb-1 flex gap-0.5 pl-8 md:pl-10">
                {MRB_IMPACT_LEVELS.map((iv) => (
                  <div
                    key={iv.value}
                    className="w-14 shrink-0 text-center text-[9px] font-medium leading-tight text-slate-600 md:w-16"
                    title={iv.label}
                  >
                    {iv.label.split(" ")[0]}
                  </div>
                ))}
              </div>
              <div className="flex">
                <div className="flex w-8 shrink-0 flex-col justify-around py-0.5 pr-1 text-[9px] font-medium leading-tight text-slate-600 md:w-10">
                  {[...MRB_PROBABILITY_LEVELS].reverse().map((pv) => (
                    <div key={pv.value} className="h-12 md:h-14" title={pv.label}>
                      <span className="line-clamp-2">{pv.label}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-0.5">
                  {[4, 3, 2, 1, 0].flatMap((ri) => {
                    const pv = 5 - ri;
                    return [4, 3, 2, 1, 0].map((ci) => {
                      const iv = 5 - ci;
                      const inh = inherentFromValues(pv, iv);
                      const tone = inherentSeverityStyle(inh.severity);
                      const n = heatCounts.get(`${pv}-${iv}`) ?? 0;
                      const active = heatmapFilter?.pv === pv && heatmapFilter?.iv === iv;
                      return (
                        <button
                          key={`${pv}-${iv}`}
                          type="button"
                          onClick={() => {
                            setHeatmapFilter((prev) => (prev?.pv === pv && prev?.iv === iv ? null : { pv, iv }));
                            setSelectedRiskId(null);
                            setRightTab("risks");
                          }}
                          className={`flex h-12 w-14 flex-col items-center justify-center rounded border text-[10px] font-semibold shadow-sm transition md:h-14 md:w-16 ${tone.bg} ${tone.text} ${
                            active ? "ring-2 ring-indigo-600 ring-offset-2 ring-offset-white" : "border-white/40 hover:brightness-110"
                          }`}
                          title={`P=${pv}, I=${iv} → ${inh.severity} (${inh.value})`}
                        >
                          <span>{inh.value}</span>
                          {n > 0 ? <span className="mt-0.5 rounded-full bg-black/25 px-1.5 py-0 text-[9px]">{n}</span> : null}
                        </button>
                      );
                    });
                  })}
                </div>
              </div>
              <p className="mt-2 pl-8 text-center text-[10px] text-slate-500 md:pl-10">Impacto</p>
            </div>
          </div>
        </section>

        <section className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-100/80 p-0.5">
            {(
              [
                ["dashboard", "Dashboard"],
                ["risks", "Riesgos"],
                ["executive", "Ejecutivo"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setRightTab(k)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  rightTab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:bg-white/70"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 min-h-[280px]">
            {rightTab === "dashboard" ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Resumen</h4>
                <p className="mt-1 text-xs text-slate-600">Gráficos rápidos para ver distribución por estado y severidad.</p>
                <div className="mt-3">{dashboardCharts}</div>
              </div>
            ) : null}

            {rightTab === "risks" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-600">
                  {heatmapFilter ? `Mostrando ${filteredEnriched.length} riesgos filtrados.` : "Mostrando todos los riesgos."}
                </p>
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 text-xs">
                  {filteredEnriched.length === 0 ? (
                    <li className="px-2 py-3 text-slate-500">No hay riesgos para mostrar.</li>
                  ) : null}
                  {filteredEnriched.map(({ row, matrix }) => {
                    const crit = String(matrix.criticalRiskText ?? row.description);
                    const sel = selectedRiskId === row.id;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedRiskId(row.id)}
                          className={`w-full rounded-md px-2 py-1.5 text-left transition ${
                            sel ? "bg-indigo-50 font-medium text-indigo-950" : "hover:bg-slate-50"
                          }`}
                        >
                          <span className="line-clamp-2">{crit}</span>
                          <span className="mt-0.5 block text-[10px] text-slate-500">
                            P{matrix.probabilityValue}×I{matrix.impactValue} · {translateRiskStatus(row.status)}
                            {row.project?.code ? ` · ${row.project.code}` : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
                  <p className="font-semibold text-slate-800">Detalle</p>
                  {!selectedEnriched ? (
                    <p className="mt-2 text-slate-500">Selecciona un riesgo para ver el detalle.</p>
                  ) : (
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      {selectedEnriched.row.project ? (
                        <div className="sm:col-span-2">
                          <dt className="text-[10px] font-semibold uppercase text-slate-500">Proyecto</dt>
                          <dd className="mt-0.5">
                            <span className="font-medium text-slate-900">{selectedEnriched.row.project.code}</span>
                            <span className="text-slate-600"> — {selectedEnriched.row.project.name}</span>
                          </dd>
                        </div>
                      ) : null}
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] font-semibold uppercase text-slate-500">Riesgo crítico</dt>
                        <dd className="mt-0.5 text-slate-800">
                          {String(selectedEnriched.matrix.criticalRiskText ?? selectedEnriched.row.description)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase text-slate-500">Evento</dt>
                        <dd className="mt-0.5">{selectedEnriched.matrix.event || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase text-slate-500">Causa</dt>
                        <dd className="mt-0.5">{selectedEnriched.matrix.cause || "—"}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="text-[10px] font-semibold uppercase text-slate-500">Consecuencia</dt>
                        <dd className="mt-0.5">{selectedEnriched.matrix.consequence || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase text-slate-500">Control clave</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap">{selectedEnriched.matrix.keyControl || "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-semibold uppercase text-slate-500">Acciones</dt>
                        <dd className="mt-0.5 whitespace-pre-wrap">{selectedEnriched.matrix.treatmentActions || "—"}</dd>
                      </div>
                    </dl>
                  )}
                </div>
              </div>
            ) : null}

            {rightTab === "executive" ? (
              <div className="space-y-3 text-sm text-slate-700">
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <span className="text-xs text-slate-500">Total</span>
                    <p className="text-lg font-bold text-slate-900">{executiveStats.total}</p>
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <span className="text-xs text-slate-500">Abiertos</span>
                    <p className="text-lg font-bold text-slate-900">{executiveStats.open}</p>
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <span className="text-xs text-slate-500">Altos/Extremos</span>
                    <p className="text-lg font-bold text-amber-700">{executiveStats.highInherent}</p>
                  </li>
                  <li className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
                    <span className="text-xs text-slate-500">Residual “Mayor/No aceptable”</span>
                    <p className="text-lg font-bold text-rose-700">{executiveStats.badResidual}</p>
                  </li>
                </ul>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Top 5 por severidad</p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                    {executiveStats.top.map(({ row, matrix }) => (
                      <li key={row.id} className="text-slate-700">
                        <span className="font-medium text-slate-900">{matrix.inherentValue}</span>
                        {row.project?.code ? <span className="text-slate-500"> · {row.project.code}</span> : null} —{" "}
                        <span className="line-clamp-2">{String(matrix.criticalRiskText ?? row.description)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Planilla matriz (MRB)</h3>
          <p className="mt-0.5 text-xs text-slate-600">Vista tabular “tipo Excel” de riesgos.</p>
        </div>
        <div className="max-h-[min(70vh,560px)] overflow-auto isolate">
          <table className="w-max min-w-full border-collapse text-left text-[11px]">
            <thead className="text-[10px] font-semibold uppercase tracking-wide shadow-[0_1px_0_0_rgb(203_213_225)]">
              <tr className="border-b border-slate-300">
                <th className={`${numColSticky} top-0 ${theadStickyZ} border-r border-slate-300 bg-slate-200 px-2 py-2 text-center align-middle text-slate-800 shadow-[1px_0_0_0_rgb(203_213_225)]`}>
                  #
                </th>
                {showProjectColumn ? (
                  <th className={`${projColSticky} top-0 ${theadStickyZ} border-r border-slate-300 bg-slate-300 px-2 py-2 align-middle text-[9px] font-bold normal-case text-slate-900 shadow-[1px_0_0_0_rgb(203_213_225)]`}>
                    Proyecto
                  </th>
                ) : null}
                <th className={`${critColStickyBase} top-0 ${theadStickyZ} border-r border-slate-200 bg-orange-600 px-2 py-2 text-left align-middle font-bold normal-case text-white shadow-[2px_0_4px_-2px_rgba(0,0,0,0.12)]`}>
                  Riesgo crítico
                </th>
                <th colSpan={6} className="sticky top-0 z-20 border border-orange-700 bg-orange-600 px-2 py-2 text-center text-white">
                  Crítico
                </th>
                <th colSpan={6} className="sticky top-0 z-20 border border-blue-900 bg-blue-800 px-2 py-2 text-center text-white">
                  Control
                </th>
                <th colSpan={2} className="sticky top-0 z-20 border border-amber-700 bg-amber-500 px-2 py-2 text-center text-slate-900">
                  Residual
                </th>
                <th colSpan={6} className="sticky top-0 z-20 border border-slate-600 bg-slate-600 px-2 py-2 text-center text-white">
                  Plan
                </th>
                <th colSpan={4} className="sticky top-0 z-20 border border-slate-700 bg-slate-500 px-2 py-2 text-center text-white">
                  PMO
                </th>
                <th className={`sticky right-0 top-0 ${theadStickyZ} border-l border-slate-300 bg-slate-200 px-2 py-2 text-right align-middle text-slate-800 shadow-[-1px_0_0_0_rgb(203_213_225)]`}>
                  Fuente
                </th>
              </tr>
              <tr className="border-b-2 border-slate-400">
                <th className={`${numColSticky} ${theadRow2Top} ${theadStickyZ} h-9 border-r border-b-2 border-slate-400 bg-slate-200 shadow-[1px_0_0_0_rgb(203_213_225)]`} aria-hidden />
                {showProjectColumn ? (
                  <th className={`${projColSticky} ${theadRow2Top} ${theadStickyZ} h-9 border-r border-b-2 border-slate-400 bg-slate-300 shadow-[1px_0_0_0_rgb(203_213_225)]`} aria-hidden />
                ) : null}
                <th className={`${critColStickyBase} ${theadRow2Top} ${theadStickyZ} h-9 border-r border-b-2 border-orange-200 bg-orange-100 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]`} aria-hidden />
                <th className={`sticky ${theadRow2Top} z-20 border border-orange-200 bg-orange-100 px-1.5 py-1.5 text-[9px] text-orange-950`}>P (clase)</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-orange-200 bg-orange-100 px-1.5 py-1.5 text-[9px] text-orange-950`}>P</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-orange-200 bg-orange-100 px-1.5 py-1.5 text-[9px] text-orange-950`}>I (clase)</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-orange-200 bg-orange-100 px-1.5 py-1.5 text-[9px] text-orange-950`}>I</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-orange-200 bg-orange-100 px-1.5 py-1.5 text-[9px] text-orange-950`}>Severidad</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-orange-200 bg-orange-100 px-1.5 py-1.5 text-[9px] text-orange-950`}>Valor</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-blue-200 bg-blue-100 px-1.5 py-1.5 text-[9px] text-blue-950`}>Control</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-blue-200 bg-blue-100 px-1.5 py-1.5 text-[9px] text-blue-950`}>Periodicidad</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-blue-200 bg-blue-100 px-1.5 py-1.5 text-[9px] text-blue-950`}>Oportunidad</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-blue-200 bg-blue-100 px-1.5 py-1.5 text-[9px] text-blue-950`}>Automat.</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-blue-200 bg-blue-100 px-1.5 py-1.5 text-[9px] text-blue-950`}>Efectiv.</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-blue-200 bg-blue-100 px-1.5 py-1.5 text-[9px] text-blue-950`}>Val</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-amber-200 bg-amber-100 px-1.5 py-1.5 text-[9px] text-amber-950`}>Clase</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-amber-200 bg-amber-100 px-1.5 py-1.5 text-[9px] text-amber-950`}>Q</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-200 px-1.5 py-1.5 text-[9px] text-slate-900`}>Estrategia</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-200 px-1.5 py-1.5 text-[9px] text-slate-900`}>Val. fecha</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-200 px-1.5 py-1.5 text-[9px] text-slate-900`}>Validador</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-200 px-1.5 py-1.5 text-[9px] text-slate-900`}>Obj.</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-200 px-1.5 py-1.5 text-[9px] text-slate-900`}>Acciones</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-200 px-1.5 py-1.5 text-[9px] text-slate-900`}>Resp.</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-100 px-1.5 py-1.5 text-[9px] text-slate-800`}>Estado</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-100 px-1.5 py-1.5 text-[9px] text-slate-800`}>Mitigación</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-100 px-1.5 py-1.5 text-[9px] text-slate-800`}>Owner</th>
                <th className={`sticky ${theadRow2Top} z-20 border border-slate-300 bg-slate-100 px-1.5 py-1.5 text-[9px] text-slate-800`}>Vence</th>
                <th className={`sticky right-0 ${theadRow2Top} ${theadStickyZ} h-9 border-l border-b-2 border-slate-400 bg-slate-200 shadow-[-1px_0_0_0_rgb(203_213_225)]`} aria-hidden />
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="px-4 py-8 text-center text-slate-500">
                    No hay riesgos.
                  </td>
                </tr>
              ) : (
                enriched.map(({ row, matrix, source }, idx) => {
                  const crit = String(matrix.criticalRiskText ?? row.description);
                  const inhStyle = inherentSeverityStyle(matrix.inherentSeverity);
                  const zebra = idx % 2 === 0 ? "bg-white" : "bg-slate-50";
                  const hf = heatmapFilter;
                  const dimmed = hf != null && (matrix.probabilityValue !== hf.pv || matrix.impactValue !== hf.iv);
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-200 align-top transition-opacity ${zebra} ${dimmed ? "opacity-[0.28]" : ""}`}
                    >
                      <td className={`sticky left-0 z-10 w-10 whitespace-nowrap border-r border-slate-200 px-2 py-1.5 text-center font-mono text-slate-600 ${zebra}`}>
                        {idx + 1}
                      </td>
                      {showProjectColumn && row.project ? (
                        <td className={`sticky left-10 z-10 w-28 min-w-[7rem] border-r border-slate-200 px-1.5 py-1.5 text-[10px] font-normal normal-case ${zebra}`}>
                          <span className="font-semibold text-slate-900">{row.project.code}</span>
                          <div className="mt-0.5 line-clamp-3 text-slate-600">{row.project.name}</div>
                        </td>
                      ) : showProjectColumn ? (
                        <td className={`sticky left-10 z-10 w-28 border-r border-slate-200 px-1.5 py-1.5 text-slate-400 ${zebra}`}>—</td>
                      ) : null}
                      <td className={`${critColSticky} z-10 max-w-[320px] border-r border-orange-200 bg-orange-50/90 px-2 py-1.5 text-left text-[11px] font-normal normal-case text-slate-900 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)] ${zebra}`}>
                        {crit}
                      </td>
                      <td className="border border-orange-100 bg-orange-50/50 px-1.5 py-1.5 text-center">{matrix.probabilityLabel}</td>
                      <td className="border border-orange-100 bg-orange-50/50 px-1.5 py-1.5 text-center font-mono">{matrix.probabilityValue}</td>
                      <td className="border border-orange-100 bg-orange-50/50 px-1.5 py-1.5 text-center">{matrix.impactLabel}</td>
                      <td className="border border-orange-100 bg-orange-50/50 px-1.5 py-1.5 text-center font-mono">{matrix.impactValue}</td>
                      <td className="border border-orange-100 bg-orange-50/50 px-1.5 py-1.5 text-center">
                        <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${inhStyle.bg} ${inhStyle.text}`}>{matrix.inherentSeverity}</span>
                      </td>
                      <td className="border border-orange-100 bg-orange-50/50 px-1.5 py-1.5 text-center font-mono font-semibold">{matrix.inherentValue}</td>
                      <td className="max-w-[220px] border border-blue-100 bg-blue-50/40 px-1.5 py-1.5 text-left text-[10px] font-normal normal-case text-slate-800">{matrix.keyControl || "—"}</td>
                      <td className="border border-blue-100 bg-blue-50/40 px-1.5 py-1.5 text-center">{matrix.controlPeriodicity}</td>
                      <td className="border border-blue-100 bg-blue-50/40 px-1.5 py-1.5 text-center">{matrix.controlOpportunity}</td>
                      <td className="border border-blue-100 bg-blue-50/40 px-1.5 py-1.5 text-center">{matrix.controlAutomation}</td>
                      <td className="border border-blue-100 bg-blue-50/40 px-1.5 py-1.5 text-center">{matrix.effectivenessClass}</td>
                      <td className="border border-blue-100 bg-blue-50/40 px-1.5 py-1.5 text-center font-mono">{matrix.effectivenessValue}</td>
                      <td className="border border-amber-100 bg-amber-50/80 px-1.5 py-1.5 text-center">
                        <span className={`rounded px-1 py-0.5 text-[10px] font-bold ${residualBadgeClass(matrix.residualClass)}`}>{matrix.residualClass}</span>
                      </td>
                      <td className="border border-amber-100 bg-amber-50/80 px-1.5 py-1.5 text-center font-mono text-[11px] font-semibold">{formatQuotient(matrix.residualQuotient)}</td>
                      <td className="max-w-[120px] border border-slate-200 px-1.5 py-1.5 text-[10px] font-normal normal-case text-slate-700">{matrix.genericStrategy || "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center">{matrix.validationDate ? String(matrix.validationDate).slice(0, 10) : "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center">{matrix.validator || "—"}</td>
                      <td className="max-w-[140px] border border-slate-200 px-1.5 py-1.5 text-[10px] font-normal normal-case text-slate-700">{matrix.treatmentObjective || "—"}</td>
                      <td className="max-w-[160px] border border-slate-200 px-1.5 py-1.5 text-[10px] font-normal normal-case text-slate-700">{matrix.treatmentActions || "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center">{matrix.treatmentResponsible || "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center">{translateRiskStatus(row.status)}</td>
                      <td className="max-w-[140px] border border-slate-200 px-1.5 py-1.5 text-[10px] font-normal normal-case text-slate-700">{row.mitigation || "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center text-slate-600">{row.ownerUser?.name ?? row.owner ?? "—"}</td>
                      <td className="border border-slate-200 px-1.5 py-1.5 text-center">{row.dueDate ? row.dueDate.slice(0, 10) : "—"}</td>
                      <td className={`sticky right-0 z-10 border-l border-slate-200 px-2 py-1.5 text-right shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.06)] ${zebra}`}>
                        <span className={source === "mrb" ? "rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-800" : "rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900"}>
                          {source === "mrb" ? "MRB" : "Legacy"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Catálogo</summary>
        <div className="mt-3 grid gap-4 text-xs text-slate-700 md:grid-cols-2">
          <div>
            <p className="font-bold text-slate-900">Probabilidad</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {PROB_OPTIONS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-bold text-slate-900">Impacto</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {IMPACT_OPTIONS.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div className="md:col-span-2">
            <p className="font-bold text-slate-900">Control</p>
            <p className="mt-1 leading-relaxed">
              Periodicidad ({PERIODICITY.join(", ")}), oportunidad ({OPPORTUNITY.join(", ")}) y automatización ({AUTOMATION.join(", ")}).
            </p>
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">
          {fixedProjectId ? "Crear riesgo en este proyecto" : "Crear riesgo (portafolio)"}
        </summary>
        <p className="mt-2 text-xs text-slate-600">
          {fixedProjectId
            ? "El riesgo se registra en el proyecto que estás visitando."
            : "Crea un riesgo MRB en un proyecto seleccionado."}
        </p>
        <form onSubmit={onSubmitPortfolioMrb} className="mt-3 space-y-3">
          {fixedProjectId ? (
            <p className="text-xs font-medium text-slate-700">
              Proyecto fijo · <span className="font-mono">{fixedProjectId}</span>
            </p>
          ) : (
            <label className="block text-xs font-semibold text-slate-700">
              Proyecto
              <select
                required
                value={portfolioTargetId}
                onChange={(e) => setPortfolioTargetId(e.target.value)}
                className="mt-1 w-full max-w-xl rounded border border-slate-200 px-2 py-2 text-sm"
              >
                <option value="">Selecciona…</option>
                {portfolioProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-xs text-slate-600">
              Evento
              <input className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-600">
              Causa
              <input className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.cause} onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-600">
              Consecuencia
              <input className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.consequence} onChange={(e) => setForm((f) => ({ ...f, consequence: e.target.value }))} />
            </label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-xs text-slate-600">
              Probabilidad
              <select className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.probabilityLabel} onChange={(e) => setForm((f) => ({ ...f, probabilityLabel: e.target.value }))}>
                {PROB_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Impacto
              <select className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.impactLabel} onChange={(e) => setForm((f) => ({ ...f, impactLabel: e.target.value }))}>
                {IMPACT_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            Control clave
            <textarea rows={3} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.keyControl} onChange={(e) => setForm((f) => ({ ...f, keyControl: e.target.value }))} />
          </label>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="text-xs text-slate-600">
              Periodicidad
              <select className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.controlPeriodicity} onChange={(e) => setForm((f) => ({ ...f, controlPeriodicity: e.target.value }))}>
                {PERIODICITY.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Oportunidad
              <select className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.controlOpportunity} onChange={(e) => setForm((f) => ({ ...f, controlOpportunity: e.target.value }))}>
                {OPPORTUNITY.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Automatización
              <select className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.controlAutomation} onChange={(e) => setForm((f) => ({ ...f, controlAutomation: e.target.value }))}>
                {AUTOMATION.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-slate-600">
            Estrategia genérica
            <input className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.genericStrategy} onChange={(e) => setForm((f) => ({ ...f, genericStrategy: e.target.value }))} />
          </label>
          <label className="block text-xs text-slate-600">
            Mitigación (PMO)
            <textarea rows={2} className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.mitigation} onChange={(e) => setForm((f) => ({ ...f, mitigation: e.target.value }))} />
          </label>
          <label className="block text-xs text-slate-600">
            Estado
            <select className="mt-1 w-full max-w-xs rounded border border-slate-200 px-2 py-1.5 text-sm" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              {RISK_STATUS_FORM_VALUES.map((code) => (
                <option key={code} value={code}>
                  {translateRiskStatus(code)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {saving ? "Guardando…" : "Crear riesgo"}
          </button>
        </form>
      </details>
    </div>
  );
}


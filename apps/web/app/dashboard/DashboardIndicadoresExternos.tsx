"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate, formatNumber } from "../../lib/format";
import {
  fetchExternalIndicatorsSeries,
  type ExternalIndicatorsData,
  type ExternalIndicatorsSeriesData,
  type ExternalIndicatorSeriesPoint,
} from "../../lib/api";

function formatIndicatorValue(value: number | null, unidad: string | null): string {
  if (value == null || Number.isNaN(value)) return "No disponible";
  if (unidad === "Porcentaje") return formatNumber(value, 1) + " %";
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Mes de referencia a partir de fecha (ej. 2025-03-01 → "marzo 2025"). */
function formatMonthReference(fecha: string | null): string | null {
  const d = parseChartDate(fecha ?? "");
  return d ? d.toLocaleDateString("es-CL", { month: "long", year: "numeric" }) : null;
}

/** Parsea fecha que puede venir como "YYYY-MM-DD" o ISO completo; evita Invalid Date. */
function parseChartDate(fecha: string): Date | null {
  if (!fecha || typeof fecha !== "string") return null;
  const trimmed = fecha.trim();
  if (!trimmed) return null;
  const d = trimmed.includes("T") ? new Date(trimmed) : new Date(trimmed + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formatea punto para eje X (eje del chart). Consistente por período. */
function formatPointLabel(fecha: string, period: "weekly" | "monthly" | "yearly"): string {
  const d = parseChartDate(fecha);
  if (!d) return "—";
  if (period === "yearly") return String(d.getFullYear());
  if (period === "monthly") return d.toLocaleDateString("es-CL", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}

/** Formatea fecha para tooltip; mismo criterio que el eje pero legible en popover. */
function formatPointLabelForTooltip(fecha: string, period: "weekly" | "monthly" | "yearly"): string {
  const d = parseChartDate(fecha);
  if (!d) return "—";
  if (period === "yearly") return String(d.getFullYear());
  if (period === "monthly") return d.toLocaleDateString("es-CL", { month: "long", year: "numeric" });
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });
}

type Period = "weekly" | "monthly" | "yearly";

const PERIOD_TABS: { value: Period; label: string }[] = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensual" },
  { value: "yearly", label: "Anual" },
];

/** Color de línea por indicador (alineado con el borde de la card). */
const INDICATOR_LINE_COLOR: Record<string, string> = {
  dolar: "#059669",   // emerald-600
  uf: "#475569",      // slate-600
  ipc: "#7c3aed",    // violet-600
};

type Props = { data: ExternalIndicatorsData | null; loading: boolean; error: boolean };

function MiniChart({
  points,
  period,
  title,
  unidad,
  emptyMessage,
  indicatorKey,
  formatTooltipLabel,
}: {
  points: ExternalIndicatorSeriesPoint[] | null;
  period: Period;
  title: string;
  unidad: string | null;
  emptyMessage?: string;
  indicatorKey?: "dolar" | "uf" | "ipc";
  formatTooltipLabel: (fecha: string) => string;
}) {
  if (emptyMessage) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <div className="mt-3 flex h-[140px] items-center justify-center rounded-lg bg-slate-50/80 text-center text-sm text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
          {emptyMessage}
        </div>
      </div>
    );
  }
  if (!points || points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
        <div className="mt-3 flex h-[140px] items-center justify-center rounded-lg bg-slate-50/80 text-center text-sm text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
          Sin datos
        </div>
      </div>
    );
  }
  const chartData = points.map((p) => ({
    ...p,
    label: formatPointLabel(p.fecha, period),
  }));
  const tickStyle = { fontSize: 10, fill: "#64748b" };
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
      <div className="mt-3 h-[140px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 16, left: 44, bottom: 28 }}
          >
            <XAxis dataKey="label" tick={tickStyle} axisLine={false} tickLine={false} />
            <YAxis
              tick={tickStyle}
              width={44}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (unidad === "Porcentaje" ? `${v}%` : Number(v).toLocaleString("es-CL"))}
              domain={["auto", "auto"]}
            />
            <Tooltip
              wrapperStyle={{ maxWidth: "min(90vw, 280px)" }}
              contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)", padding: "8px 12px" }}
              formatter={(value: unknown) => [
                unidad === "Porcentaje"
                  ? `${Number(value).toFixed(1)} %`
                  : Number(value).toLocaleString("es-CL"),
                title,
              ]}
              labelFormatter={(label, payload) => {
                const raw = (payload as unknown as { payload?: { fecha?: string } }[])?.[0]?.payload?.fecha;
                return raw ? formatTooltipLabel(raw) : (label && label !== "—" ? String(label) : "");
              }}
            />
            <Line
              type="monotone"
              dataKey="valor"
              stroke={indicatorKey ? INDICATOR_LINE_COLOR[indicatorKey] ?? "#475569" : "#475569"}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function DashboardIndicadoresExternos({ data, loading, error }: Props) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [seriesData, setSeriesData] = useState<ExternalIndicatorsSeriesData | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSeriesLoading(true);
    setSeriesData(null);
    fetchExternalIndicatorsSeries(period)
      .then((d) => {
        if (!cancelled) setSeriesData(d);
      })
      .catch(() => {
        if (!cancelled) setSeriesData(null);
      })
      .finally(() => {
        if (!cancelled) setSeriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white px-6 py-5 shadow-md dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Indicadores externos (Chile)</h3>
        <p className="mt-1 text-xs tracking-wide text-slate-500 dark:text-slate-400">Referencia de mercado</p>
        <div className="mt-6 flex gap-4">
          <div className="h-20 flex-1 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
          <div className="h-20 flex-1 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
          <div className="h-20 flex-1 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
        </div>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Cargando…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="rounded-xl border border-slate-200/80 bg-white px-6 py-5 shadow-md dark:border-slate-700 dark:bg-slate-800">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Indicadores externos (Chile)</h3>
        <p className="mt-1 text-xs tracking-wide text-slate-500 dark:text-slate-400">Referencia de mercado</p>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          No se pudieron cargar los indicadores. Suele deberse a falta de conexión, a que la API no está en marcha o a que el proveedor de datos no respondió.
        </p>
        <ul className="mt-2 list-inside list-disc text-xs text-slate-500 dark:text-slate-400">
          <li>Compruebe su conexión e intente actualizar la página.</li>
          <li>Si usa instalación local, verifique que el backend esté ejecutándose.</li>
        </ul>
        {data?.source && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Última fuente conocida: {data.source}</p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200/80 bg-white px-6 py-5 shadow-md dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Indicadores externos (Chile)</h3>
      <p className="mt-1 text-xs tracking-wide text-slate-500 dark:text-slate-400">Referencia de mercado</p>

      {/* Cards de valor actual */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200/80 border-l-4 border-l-emerald-500 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Dólar (USD/CLP)</p>
          </div>
          <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100">
            {data.dolar.error || data.dolar.value == null
              ? "No disponible"
              : formatIndicatorValue(data.dolar.value, data.dolar.unidad)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 border-l-4 border-l-slate-600 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-200/80 text-slate-600 dark:bg-slate-600 dark:text-slate-300" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">UF</p>
          </div>
          <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100">
            {data.uf.error || data.uf.value == null
              ? "No disponible"
              : formatIndicatorValue(data.uf.value, data.uf.unidad)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200/80 border-l-4 border-l-violet-500 bg-white p-4 shadow-md dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400" aria-hidden>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">IPC último publicado</p>
          </div>
          <p className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl dark:text-slate-100">
            {data.ipc.error || data.ipc.value == null
              ? "No disponible"
              : formatIndicatorValue(data.ipc.value, data.ipc.unidad)}
          </p>
          {data.ipc.fecha && formatMonthReference(data.ipc.fecha) && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Mes de referencia: {formatMonthReference(data.ipc.fecha)}
            </p>
          )}
        </div>
      </div>

      {/* Tabs período + mini gráficos */}
      <div className="mt-6 border-t border-slate-200/80 pt-6 dark:border-slate-700">
        <div className="mb-4 flex gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-700/60">
          {PERIOD_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setPeriod(tab.value)}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                period === tab.value
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-600 hover:bg-slate-200/60 dark:text-slate-400 dark:hover:bg-slate-600/60"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {seriesLoading ? (
          <div className="flex h-[160px] items-center justify-center rounded-xl bg-slate-50/80 text-sm text-slate-500 dark:bg-slate-700/40 dark:text-slate-400">
            Cargando tendencia…
          </div>
        ) : seriesData?.error ? (
          <p className="rounded-xl bg-slate-100/80 py-3 text-center text-sm text-slate-600 dark:bg-slate-700/60 dark:text-slate-400">
            Tendencia no disponible. {seriesData.error}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <MiniChart
              points={seriesData?.dolar ?? null}
              period={period}
              title="Dólar (USD/CLP)"
              unidad={data.dolar.unidad}
              indicatorKey="dolar"
              formatTooltipLabel={(f) => formatPointLabelForTooltip(f, period)}
            />
            <MiniChart
              points={seriesData?.uf ?? null}
              period={period}
              title="UF"
              unidad={data.uf.unidad}
              indicatorKey="uf"
              formatTooltipLabel={(f) => formatPointLabelForTooltip(f, period)}
            />
            <MiniChart
              points={period === "weekly" ? null : (seriesData?.ipc ?? null)}
              period={period}
              title="IPC"
              unidad={data.ipc.unidad}
              emptyMessage={period === "weekly" ? "Sin datos semanales (IPC es mensual)" : undefined}
              indicatorKey="ipc"
              formatTooltipLabel={(f) => formatPointLabelForTooltip(f, period)}
            />
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-200/80 pt-4 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
        {data.updatedAt ? (
          <>
            Actualizado: {formatDate(data.updatedAt)}
            {data.source && " · "}
          </>
        ) : null}
        {data.source && <>Fuente: {data.source}</>}
      </div>
    </section>
  );
}

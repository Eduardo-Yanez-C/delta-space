"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardCharts, DashboardKpis } from "../../lib/api";

const SHORT_MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function formatMonthTick(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const mi = parseInt(m, 10) - 1;
  if (!y || Number.isNaN(mi) || mi < 0 || mi > 11) return monthKey;
  return `${SHORT_MONTH_ES[mi]} '${y.slice(-2)}`;
}

export function MiniQuotesByMonthChart({
  series,
  compact,
}: {
  series: DashboardCharts["quotesByMonth"];
  compact?: boolean;
}) {
  const data = series.map((m) => ({ ...m, tick: formatMonthTick(m.month) }));
  const isCompact = compact ?? false;
  return (
    <div className="flex h-full min-h-0 flex-col px-1 pt-1">
      <h3 className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Cotizaciones por mes
      </h3>
      <div className="min-h-[100px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: isCompact ? 2 : 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
            <XAxis
              dataKey="tick"
              tick={{ fontSize: isCompact ? 8 : 9 }}
              interval={isCompact ? "preserveStartEnd" : 0}
              angle={isCompact ? 0 : -28}
              textAnchor={isCompact ? "middle" : "end"}
              height={isCompact ? 28 : 40}
            />
            <YAxis tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip
              formatter={(v: unknown) => [
                typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""),
                "Cotizaciones",
              ]}
              labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string })?.label ?? ""}
            />
            <Bar dataKey="count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MiniStudiesByMonthChart({
  series,
  compact,
}: {
  series: DashboardCharts["studiesByMonth"];
  compact?: boolean;
}) {
  const data = series.map((m) => ({ ...m, tick: formatMonthTick(m.month) }));
  const isCompact = compact ?? false;
  return (
    <div className="flex h-full min-h-0 flex-col px-1 pt-1">
      <h3 className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Estudios FV por mes
      </h3>
      <div className="min-h-[100px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: isCompact ? 2 : 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
            <XAxis
              dataKey="tick"
              tick={{ fontSize: isCompact ? 8 : 9 }}
              interval={isCompact ? "preserveStartEnd" : 0}
              angle={isCompact ? 0 : -28}
              textAnchor={isCompact ? "middle" : "end"}
              height={isCompact ? 28 : 40}
            />
            <YAxis tick={{ fontSize: 9 }} width={28} allowDecimals={false} />
            <Tooltip
              formatter={(v: unknown) => [
                typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""),
                "Estudios",
              ]}
              labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string })?.label ?? ""}
            />
            <Bar dataKey="count" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function MiniConversionDonut({ kpis }: { kpis: DashboardKpis }) {
  const rest = Math.max(0, kpis.studiesTotal - kpis.studiesConverted);
  const data =
    kpis.studiesTotal === 0
      ? [{ name: "Sin estudios", value: 1, fill: "#cbd5e1" }]
      : [
          { name: "Con cotización", value: kpis.studiesConverted, fill: "#10b981" },
          { name: "Sin cotización", value: rest, fill: "#e2e8f0" },
        ];
  return (
    <div className="flex h-full min-h-0 flex-col px-1 pt-1">
      <h3 className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Conversión estudio → cotización
      </h3>
      <div className="min-h-[88px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              paddingAngle={2}
            >
              {data.map((e, i) => (
                <Cell key={i} fill={e.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown) =>
                typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? "")
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="shrink-0 px-1 pb-1 text-center text-[10px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
        {kpis.conversionPercent.toFixed(1)}% · {kpis.studiesConverted}/{kpis.studiesTotal} estudios
      </p>
    </div>
  );
}

export function MiniOpsFunnelChart({ charts }: { charts: DashboardCharts }) {
  const originData = charts.quotesByOrigin.map((o) => ({ label: o.label, count: o.count }));
  const statusData = charts.studiesByStatus.filter((s) => s.status !== "ARCHIVADO");
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 px-1 pt-1">
      <h3 className="shrink-0 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Embudo comercial y estudios por estado
      </h3>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2">
        <div className="min-h-[72px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={originData} layout="vertical" margin={{ left: 4, right: 8, top: 2, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={88} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown) => [
                  typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""),
                  "Cotizaciones",
                ]}
              />
              <Bar dataKey="count" fill="#64748b" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="min-h-[72px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} layout="vertical" margin={{ left: 4, right: 8, top: 2, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={72} tick={{ fontSize: 9 }} />
              <Tooltip
                formatter={(v: unknown) => [
                  typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""),
                  "Estudios",
                ]}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

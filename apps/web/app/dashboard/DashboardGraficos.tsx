"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DashboardCharts } from "../../lib/api";

type Props = { charts: DashboardCharts };

const SHORT_MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function formatQuotesMonthAxisTick(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const mi = parseInt(m, 10) - 1;
  if (!y || Number.isNaN(mi) || mi < 0 || mi > 11) return monthKey;
  return `${SHORT_MONTH_ES[mi]} '${y.slice(-2)}`;
}

export function DashboardGraficos({ charts }: Props) {
  const { quotesByMonth, studiesByMonth = [], quotesByOrigin, studiesByStatus } = charts;

  const dataMonth = quotesByMonth.map((m) => ({ ...m, name: m.label }));
  const dataStudiesMonth = studiesByMonth.map((m) => ({ ...m, name: m.label }));
  const dataOrigin = quotesByOrigin.map((o) => ({ ...o, name: o.label }));
  const dataStatus = studiesByStatus.map((s) => ({ ...s, name: s.label }));

  return (
    <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
      <div className="card overflow-hidden p-5">
        <h4 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Cotizaciones por mes</h4>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataMonth} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickFormatter={formatQuotesMonthAxisTick}
                angle={-32}
                dy={6}
                textAnchor="end"
                height={46}
                interval={0}
                minTickGap={8}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: unknown) => [typeof value === "number" ? value.toLocaleString("es-CL") : String(value ?? ""), "Cotizaciones"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { label?: string } | undefined;
                  return row?.label ?? "";
                }}
              />
              <Bar dataKey="count" name="Cotizaciones" fill="#f59e0b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden p-5">
        <h4 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Estudios FV por mes</h4>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataStudiesMonth} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickFormatter={formatQuotesMonthAxisTick}
                angle={-32}
                dy={6}
                textAnchor="end"
                height={46}
                interval={0}
                minTickGap={8}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(value: unknown) => [typeof value === "number" ? value.toLocaleString("es-CL") : String(value ?? ""), "Estudios"]}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload as { label?: string } | undefined;
                  return row?.label ?? "";
                }}
              />
              <Bar dataKey="count" name="Estudios" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden p-5">
        <h4 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Cotizaciones por origen</h4>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dataOrigin}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: unknown) => [typeof value === "number" ? value.toLocaleString("es-CL") : String(value ?? ""), "Cantidad"]}
              />
              <Bar dataKey="count" fill="#64748b" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-hidden p-5">
        <h4 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-200">Estudios FV por estado</h4>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dataStatus}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: unknown) => [typeof value === "number" ? value.toLocaleString("es-CL") : String(value ?? ""), "Cantidad"]}
              />
              <Bar dataKey="count" fill="#0ea5e9" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

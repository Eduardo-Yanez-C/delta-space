"use client";

import { formatMoney, formatNumber } from "../../lib/format";
import type { DashboardKpis as DashboardKpisType } from "../../lib/api";

type Props = { kpis: DashboardKpisType };

const KPI_ITEMS: Array<{
  key: keyof DashboardKpisType;
  label: string;
  format: (v: number) => string;
}> = [
  { key: "quotesTotal", label: "Cotizaciones totales", format: (v) => formatNumber(v) },
  { key: "quotesThisMonth", label: "Cotizaciones del mes", format: (v) => formatNumber(v) },
  { key: "totalQuotedAmount", label: "Monto total cotizado", format: (v) => formatMoney(v) },
  { key: "averageTicket", label: "Ticket promedio", format: (v) => formatMoney(v) },
  { key: "studiesTotal", label: "Estudios FV totales", format: (v) => formatNumber(v) },
  { key: "studiesConverted", label: "Estudios convertidos en cotización", format: (v) => formatNumber(v) },
  { key: "conversionPercent", label: "% conversión estudio → cotización", format: (v) => formatNumber(v, 1) + " %" },
];

export function DashboardKpis({ kpis }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {KPI_ITEMS.map(({ key, label, format }) => (
        <div
          key={key}
          className="card flex flex-col justify-between border-t-2 border-t-primary-500/70 p-5"
        >
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {format(kpis[key] as number)}
          </p>
        </div>
      ))}
    </div>
  );
}

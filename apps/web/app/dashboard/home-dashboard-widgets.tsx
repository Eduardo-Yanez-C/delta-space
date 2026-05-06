"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { DashboardData, ExternalIndicatorsData } from "../../lib/api";
import { formatDate } from "../../lib/format";
import { DashboardGraficos } from "./DashboardGraficos";
import { DashboardKpis } from "./DashboardKpis";
import { DashboardTablas } from "./DashboardTablas";
import {
  MiniConversionDonut,
  MiniOpsFunnelChart,
  MiniQuotesByMonthChart,
  MiniStudiesByMonthChart,
} from "./HomeMiniCharts";
import type { HomeWidgetType } from "../../lib/home-dashboard";

export function formatExternalIndicatorValue(item: {
  value: number | null;
  unidad: string | null;
  error?: boolean;
}): string {
  if (item.error || item.value == null || Number.isNaN(item.value)) return "No disponible";
  if (item.unidad === "Porcentaje") return `${item.value.toFixed(1)}%`;
  return new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 }).format(item.value);
}

export function formatCurrencyCl(value: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    Math.round(value),
  );
}

export function commercialHealthLine(kpis: DashboardData["kpis"], pendingStudies: number): string {
  if (pendingStudies > 0) {
    return `${pendingStudies} estudio(s) sin cotización: priorice cerrar el embudo.`;
  }
  if (kpis.quotesThisMonth === 0) {
    return "Sin cotizaciones nuevas este mes: conviene impulsar la generación comercial.";
  }
  return "Embudo y ritmo mensual en línea con operación activa.";
}

export type HomeWidgetRenderContext = {
  data: DashboardData;
  externalData: ExternalIndicatorsData | null;
  externalLoading: boolean;
  externalError: boolean;
  weeklyMessage: { weekNumber: number; text: string };
  canReadQuote: boolean;
  canReadFvStudy: boolean;
};

function shellClass(editMode: boolean) {
  return [
    "flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80",
    editMode ? "ring-2 ring-primary-400/40 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-950" : "",
  ].join(" ");
}

function WidgetWelcome() {
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center px-3 py-2">
      <div className="border-l-[3px] border-l-primary-500 pl-2.5">
        <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">Inicio</h2>
        <p className="mt-0.5 text-xs leading-snug text-slate-600 dark:text-slate-400">
          Tablero personalizable: organice tarjetas, guarde su vista y acceda al flujo comercial.
        </p>
      </div>
    </div>
  );
}

export function renderHomeWidget(
  type: HomeWidgetType,
  ctx: HomeWidgetRenderContext,
  editMode: boolean,
): ReactNode {
  const { data } = ctx;
  const body = (() => {
    switch (type) {
      case "welcome-header":
        return <WidgetWelcome />;
      case "external-indicators":
        return <WidgetExternal ctx={ctx} />;
      case "executive-summary":
        return <WidgetExecutive ctx={ctx} />;
      case "weekly-message":
        return <WidgetWeekly ctx={ctx} />;
      case "radar-commercial":
        return <WidgetRadar ctx={ctx} />;
      case "recent-changes":
        return <WidgetRecent ctx={ctx} />;
      case "follow-up-suggested":
        return <WidgetFollowUp ctx={ctx} />;
      case "kpis-strip":
        return (
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <DashboardKpis kpis={data.kpis} />
          </div>
        );
      case "kpi-conversion":
        return (
          <KpiMini
            label="Conversión estudio → cotización"
            value={`${data.kpis.conversionPercent.toFixed(1)}%`}
            hint={`${data.kpis.studiesConverted} / ${data.kpis.studiesTotal} estudios`}
          />
        );
      case "kpi-ticket":
        return (
          <KpiMini
            label="Ticket promedio"
            value={formatCurrencyCl(data.kpis.averageTicket)}
            hint="Por cotización"
          />
        );
      case "kpi-total-amount":
        return (
          <KpiMini
            label="Monto total cotizado"
            value={formatCurrencyCl(data.kpis.totalQuotedAmount)}
            hint="Cartera cotizada"
          />
        );
      case "charts-trends":
        return data.charts ? (
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <DashboardGraficos charts={data.charts} />
          </div>
        ) : (
          <p className="p-4 text-sm text-slate-500 dark:text-slate-400">No hay series de gráficos disponibles.</p>
        );
      case "mini-quotes-month-chart":
        return data.charts?.quotesByMonth?.length ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden p-1">
            <MiniQuotesByMonthChart series={data.charts.quotesByMonth} />
          </div>
        ) : (
          <p className="p-3 text-xs text-slate-500 dark:text-slate-400">Sin datos de cotizaciones por mes.</p>
        );
      case "mini-studies-month-chart":
        return data.charts?.studiesByMonth?.length ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden p-1">
            <MiniStudiesByMonthChart series={data.charts.studiesByMonth} />
          </div>
        ) : (
          <p className="p-3 text-xs text-slate-500 dark:text-slate-400">Sin datos de estudios por mes.</p>
        );
      case "mini-conversion-donut":
        return (
          <div className="flex h-full min-h-0 flex-col overflow-hidden p-1">
            <MiniConversionDonut kpis={data.kpis} />
          </div>
        );
      case "mini-ops-funnel-chart":
        return data.charts ? (
          <div className="flex h-full min-h-0 flex-col overflow-hidden p-1">
            <MiniOpsFunnelChart charts={data.charts} />
          </div>
        ) : (
          <p className="p-3 text-xs text-slate-500 dark:text-slate-400">Sin datos de embudo.</p>
        );
      case "quick-tables":
        return (
          <div className="min-h-0 flex-1 overflow-auto p-2">
            <DashboardTablas
              latestQuotes={data.latestQuotes}
              latestStudies={data.latestStudies}
              studiesWithoutQuote={data.studiesWithoutQuote}
            />
          </div>
        );
      default:
        return null;
    }
  })();

  return <div className={shellClass(editMode)}>{body}</div>;
}

function KpiMini({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100" title={value}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{hint}</p>
    </div>
  );
}

function WidgetExternal({ ctx }: { ctx: HomeWidgetRenderContext }) {
  const { externalData, externalLoading, externalError } = ctx;
  return (
    <div className="flex min-h-0 flex-1 flex-col p-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Indicadores externos
        </h3>
        <div className="flex flex-wrap items-center gap-1">
          {(["UF", "Dólar", "IPC"] as const).map((label, i) => {
            const raw = i === 0 ? externalData?.uf : i === 1 ? externalData?.dolar : externalData?.ipc;
            const display = externalLoading
              ? "…"
              : externalError || !externalData || !raw
                ? "—"
                : formatExternalIndicatorValue(raw);
            return (
              <div
                key={label}
                className="inline-flex items-baseline gap-1 rounded-md border border-slate-200/90 bg-slate-50/90 px-1.5 py-0.5 dark:border-slate-600/70 dark:bg-slate-800/60"
              >
                <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {label}
                </span>
                <span
                  className={`max-w-[5.5rem] truncate text-[11px] font-semibold tabular-nums text-slate-900 dark:text-slate-100 sm:max-w-[6.5rem] ${externalLoading ? "text-slate-400" : ""}`}
                  title={display}
                >
                  {externalLoading ? "Cargando" : display}
                </span>
              </div>
            );
          })}
        </div>
        <Link
          href="/indicadores-externos"
          className="ml-auto inline-flex shrink-0 rounded-md border border-slate-200/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700/50"
        >
          Ver módulo
        </Link>
      </div>
      {externalError && (
        <p className="mt-1 text-[9px] leading-snug text-amber-800 dark:text-amber-200/90">
          Indicadores no disponibles ahora.
        </p>
      )}
    </div>
  );
}

function WidgetExecutive({ ctx }: { ctx: HomeWidgetRenderContext }) {
  const { data, externalError } = ctx;
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Resumen ejecutivo operativo
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Estado actual con datos vivos de cotizaciones y estudios FV.
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300">
          Actualizado: {formatDate(new Date().toISOString())}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-700/80 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Cotizaciones activas
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{data.kpis.quotesTotal}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">+{data.kpis.quotesThisMonth} este mes</p>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-700/80 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Estudios FV activos
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{data.kpis.studiesTotal}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Conv. {data.kpis.conversionPercent.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-700/80 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Pendientes de cotizar
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            {data.studiesWithoutQuote.length}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Sin cotización asociada</p>
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-700/80 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Alertas operativas
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {externalError ? "1" : "0"}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            {externalError ? "Indicadores externos" : "Sin incidencias críticas"}
          </p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-slate-700/80 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cambios recientes</p>
          <RecentList ctx={ctx} />
        </div>
        <div className="rounded-lg border border-slate-200/80 bg-white p-2.5 dark:border-slate-700/80 dark:bg-slate-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Seguimiento sugerido
          </p>
          <FollowUpList data={data} />
        </div>
      </div>
    </div>
  );
}

function RecentList({ ctx }: { ctx: HomeWidgetRenderContext }) {
  const { data } = ctx;
  return (
    <ul className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
      {data.latestQuotes.slice(0, 4).map((q) => (
        <li key={q.id} className="truncate">
          Cot.:{" "}
          <Link href={`/cotizaciones/${q.id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-400">
            {q.title}
          </Link>{" "}
          <span className="text-slate-500 dark:text-slate-400">({formatDate(q.updatedAt)})</span>
        </li>
      ))}
      {data.latestStudies.slice(0, 4).map((s) => (
        <li key={s.id} className="truncate">
          FV:{" "}
          <Link href={`/estudios-fv/${s.id}`} className="font-medium text-primary-700 hover:underline dark:text-primary-400">
            {s.title}
          </Link>{" "}
          <span className="text-slate-500 dark:text-slate-400">({formatDate(s.updatedAt)})</span>
        </li>
      ))}
      {data.latestQuotes.length === 0 && data.latestStudies.length === 0 && (
        <li className="text-slate-500 dark:text-slate-400">Sin movimientos recientes.</li>
      )}
    </ul>
  );
}

function FollowUpList({ data }: { data: DashboardData }) {
  return (
    <ul className="mt-1.5 space-y-1 text-xs text-slate-700 dark:text-slate-300">
      {data.studiesWithoutQuote.length > 0 ? (
        <li>Priorizar {data.studiesWithoutQuote.length} estudio(s) sin cotización.</li>
      ) : (
        <li>No hay estudios pendientes de cotización.</li>
      )}
      {data.kpis.quotesThisMonth === 0 ? (
        <li>Sin nuevas cotizaciones este mes: impulsar generación comercial.</li>
      ) : (
        <li>Buen ritmo: {data.kpis.quotesThisMonth} cotización(es) este mes.</li>
      )}
      <li>
        Ticket promedio:{" "}
        <span className="font-medium">{new Intl.NumberFormat("es-CL").format(Math.round(data.kpis.averageTicket))}</span>.
      </li>
    </ul>
  );
}

function WidgetRecent({ ctx }: { ctx: HomeWidgetRenderContext }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cambios recientes</h3>
      <RecentList ctx={ctx} />
    </div>
  );
}

function WidgetFollowUp({ ctx }: { ctx: HomeWidgetRenderContext }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Seguimiento sugerido
      </h3>
      <FollowUpList data={ctx.data} />
    </div>
  );
}

function WidgetWeekly({ ctx }: { ctx: HomeWidgetRenderContext }) {
  const { weeklyMessage } = ctx;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-primary-50/30 p-3 dark:bg-primary-950/15">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-primary-700 dark:text-primary-300">
          Mensaje de la semana
        </h3>
        <span className="shrink-0 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-primary-700 ring-1 ring-primary-200/80 dark:bg-slate-900/80 dark:text-primary-200 dark:ring-primary-700/50">
          S{weeklyMessage.weekNumber}
        </span>
      </div>
      <blockquote className="mt-2 min-h-0 flex-1 overflow-auto border-l-[3px] border-primary-500 pl-2 text-xs font-medium leading-snug text-slate-800 dark:text-slate-100">
        “{weeklyMessage.text}”
      </blockquote>
    </div>
  );
}

function WidgetRadar({ ctx }: { ctx: HomeWidgetRenderContext }) {
  const { data, canReadQuote, canReadFvStudy } = ctx;
  return (
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Radar comercial</h3>
          <p className="mt-0.5 text-[9px] text-slate-500 dark:text-slate-500">Montos, conversión y foco.</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold ${
            data.studiesWithoutQuote.length > 0
              ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/35 dark:text-emerald-200"
          }`}
        >
          {data.studiesWithoutQuote.length > 0 ? "Atención embudo" : "Embudo estable"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1 dark:border-slate-700/80 dark:bg-slate-800/40">
          <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">Monto cotizado</p>
          <p className="truncate text-[11px] font-semibold tabular-nums" title={formatCurrencyCl(data.kpis.totalQuotedAmount)}>
            {formatCurrencyCl(data.kpis.totalQuotedAmount)}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1 dark:border-slate-700/80 dark:bg-slate-800/40">
          <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">Ticket prom.</p>
          <p className="truncate text-[11px] font-semibold tabular-nums" title={formatCurrencyCl(data.kpis.averageTicket)}>
            {formatCurrencyCl(data.kpis.averageTicket)}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1 dark:border-slate-700/80 dark:bg-slate-800/40">
          <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">Conv. FV → cotiz.</p>
          <p className="text-[11px] font-semibold tabular-nums">{data.kpis.conversionPercent.toFixed(1)}%</p>
          <p className="text-[8px] tabular-nums text-slate-500">
            {data.kpis.studiesConverted}/{data.kpis.studiesTotal}
          </p>
        </div>
        <div className="min-w-0 rounded-md border border-slate-100 bg-slate-50/80 px-2 py-1 dark:border-slate-700/80 dark:bg-slate-800/40">
          <p className="text-[9px] font-semibold uppercase text-slate-500 dark:text-slate-400">Pendientes</p>
          <p className="text-[11px] font-semibold tabular-nums text-amber-800 dark:text-amber-200">
            {data.studiesWithoutQuote.length}
          </p>
        </div>
      </div>

      <div className="mt-2">
        <div className="mb-0.5 flex justify-between text-[9px] text-slate-500">
          <span>Fuerza conversión</span>
          <span className="tabular-nums font-medium">{Math.min(100, Math.max(0, data.kpis.conversionPercent)).toFixed(0)}%</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80">
          <div
            className="h-full rounded-full bg-primary-500/90"
            style={{ width: `${Math.min(100, Math.max(0, data.kpis.conversionPercent))}%` }}
          />
        </div>
      </div>

      <p className="mt-2 text-[10px] leading-snug text-slate-600 dark:text-slate-400">
        {commercialHealthLine(data.kpis, data.studiesWithoutQuote.length)}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 border-t border-slate-100 pt-2 text-[10px] font-medium dark:border-slate-700/80">
        {canReadQuote && (
          <Link href="/cotizaciones" className="text-primary-700 hover:underline dark:text-primary-400">
            Cotizaciones
          </Link>
        )}
        {canReadFvStudy && (
          <Link href="/estudios-fv" className="text-primary-700 hover:underline dark:text-primary-400">
            Estudios FV
          </Link>
        )}
        {data.studiesWithoutQuote.length > 0 && canReadFvStudy && (
          <Link href={`/estudios-fv/${data.studiesWithoutQuote[0].id}`} className="text-amber-800 hover:underline dark:text-amber-200">
            Ver pendiente
          </Link>
        )}
      </div>
    </div>
  );
}

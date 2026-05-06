"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "../../../lib/useCan";
import { fetchDashboard, fetchExternalIndicators, type DashboardData, type ExternalIndicatorsData } from "../../../lib/api";
import { HomeDashboardShell } from "../../dashboard/HomeDashboardShell";
import { useSuiteAgentRuntime } from "../../../components/suite-agent/SuiteAgentRuntimeProvider";

const WEEKLY_MESSAGES = [
  "Cada cotización clara y bien presentada acelera el cierre comercial.",
  "La consistencia semanal convierte buenos resultados en resultados predecibles.",
  "Pequeñas mejoras diarias en el flujo comercial generan grandes diferencias mensuales.",
  "El seguimiento oportuno vale tanto como una buena propuesta técnica.",
  "Un proceso ordenado hoy evita retrabajo mañana.",
  "La calidad documental también vende confianza.",
  "Lo que se mide se mejora: mantenga foco en avances concretos.",
  "La velocidad importa, pero la claridad comercial sostiene el cierre.",
];

function getIsoWeek(date: Date): number {
  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeeklyMessage(now = new Date()): { weekNumber: number; text: string } {
  const weekNumber = getIsoWeek(now);
  const text = WEEKLY_MESSAGES[(weekNumber - 1) % WEEKLY_MESSAGES.length];
  return { weekNumber, text };
}

/** Panel de ventas: dashboard comercial que antes vivía en Inicio (`/`). */
export default function PanelDeVentasPage() {
  const { mergeRuntime } = useSuiteAgentRuntime();
  const canReadQuote = useCan("read", "quote");
  const canReadFvStudy = useCan("read", "fvStudy");
  const canAccessCommercialPerformance = useCan("access", "commercialPerformance");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [externalData, setExternalData] = useState<ExternalIndicatorsData | null>(null);
  const [externalLoading, setExternalLoading] = useState(true);
  const [externalError, setExternalError] = useState(false);
  const weeklyMessage = getWeeklyMessage();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDashboard()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setExternalLoading(true);
    setExternalError(false);
    fetchExternalIndicators()
      .then((d) => {
        if (!cancelled) setExternalData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setExternalError(true);
          setExternalData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setExternalLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const k = data.kpis;
    const lines = [
      `KPIs: cotizaciones ${k.quotesTotal ?? "—"}, estudios FV ${k.studiesTotal ?? "—"}.`,
      `Últimas cotizaciones en panel: ${data.latestQuotes?.length ?? 0}.`,
      `Últimos estudios FV: ${data.latestStudies?.length ?? 0}.`,
    ];
    mergeRuntime({
      summary: lines.join("\n"),
    });
  }, [data, mergeRuntime]);

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="rounded-xl border border-primary-200 bg-primary-50/80 p-5 shadow-md text-primary-800 dark:border-primary-700 dark:bg-primary-900/30 dark:text-primary-200"
          role="alert"
          aria-live="assertive"
        >
          <p className="font-medium">No se pudo cargar. Intente de nuevo.</p>
          <p className="mt-1 text-sm opacity-90">{error}</p>
        </div>
      )}

      {loading && (
        <div className="card flex items-center justify-center p-14">
          <span className="text-slate-500 dark:text-slate-400">Cargando…</span>
        </div>
      )}

      {!loading && data && (
        <HomeDashboardShell
          data={data}
          externalData={externalData}
          externalLoading={externalLoading}
          externalError={externalError}
          weeklyMessage={weeklyMessage}
          canReadQuote={canReadQuote}
          canReadFvStudy={canReadFvStudy}
        />
      )}

      <section className="border-t border-slate-200/80 pt-6 dark:border-slate-700">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Acceso rápido</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canAccessCommercialPerformance && (
            <Link
              href="/admin/comercial"
              className="card card-hover flex flex-col border-l-4 border-l-amber-500 bg-gradient-to-br from-white to-amber-50/35 p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 hover:shadow-lg dark:from-slate-900 dark:to-amber-950/20"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/40">
                <svg className="h-5 w-5 text-amber-800 dark:text-amber-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Panel comercial</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Rendimiento por vendedor, KPIs y exportación (solo administración).
              </p>
            </Link>
          )}
          {canReadQuote && (
            <>
              <Link
                href="/cotizaciones/nueva"
                className="card card-hover flex flex-col border-l-4 border-l-primary-500 bg-gradient-to-br from-white to-primary-50/20 p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg dark:from-slate-900 dark:to-slate-900"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
                  <svg className="h-5 w-5 text-primary-700 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Nueva cotización</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Crear propuesta en blanco.</p>
              </Link>
              <Link
                href="/cotizaciones/desde-plantilla"
                className="card card-hover flex flex-col border-l-4 border-l-primary-500 bg-gradient-to-br from-white to-primary-50/20 p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg dark:from-slate-900 dark:to-slate-900"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
                  <svg className="h-5 w-5 text-primary-700 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Cotización desde plantilla</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Crear desde 3 kW, 4 kW o 6 kW OnGrid.</p>
              </Link>
            </>
          )}
          {canReadFvStudy && (
            <Link
              href="/estudios-fv/nuevo"
              className="card card-hover flex flex-col border-l-4 border-l-primary-500 bg-gradient-to-br from-white to-primary-50/20 p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg dark:from-slate-900 dark:to-slate-900"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/40">
                <svg className="h-5 w-5 text-primary-700 dark:text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Nuevo estudio FV</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Crear estudio fotovoltaico por cliente.</p>
            </Link>
          )}
          <Link
            href="/clientes"
            className="card card-hover flex flex-col p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <svg className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Clientes</h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Ver listado, crear y editar clientes.</p>
          </Link>

          <Link
            href="/productos"
            className="card card-hover flex flex-col p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <svg className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Productos</h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Catálogo comercial y técnico para cotizaciones.</p>
          </Link>

          <Link
            href="/proveedores"
            className="card card-hover flex flex-col p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
              <svg className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Proveedores</h4>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Abastecimiento nacional e internacional.</p>
          </Link>

          {canReadQuote && (
            <Link
              href="/cotizaciones"
              className="card card-hover flex flex-col p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <svg className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Cotizaciones</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Crear y gestionar propuestas comerciales.</p>
            </Link>
          )}

          {canReadFvStudy && (
            <Link
              href="/estudios-fv"
              className="card card-hover flex flex-col p-6 shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:shadow-lg"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                <svg className="h-5 w-5 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h4 className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Estudios FV</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Estudios fotovoltaicos y creación de cotizaciones.</p>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

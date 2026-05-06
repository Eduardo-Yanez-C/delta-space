"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "../../../lib/auth-context";
import {
  fetchCommercialPerformance,
  fetchDashboard,
  fetchSuiteAgentUsageAdmin,
  type CommercialPerformanceData,
  type DashboardData,
  type SuiteAgentUsageAdminResponse,
} from "../../../lib/api";
import { useCan } from "../../../lib/useCan";

const CHART_COLORS = ["#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b", "#64748b", "#ec4899"];

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function utcYearMonth(): { y: number; m: number } {
  const d = new Date();
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
}

function formatTokens(n: number): string {
  return n.toLocaleString("es");
}

export default function UsuariosPanelPage() {
  const { user } = useAuth();
  const canUsers = useCan("access", "users");
  const canCommercial = useCan("access", "commercialPerformance");

  const [ia, setIa] = useState<SuiteAgentUsageAdminResponse | null>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [commercial, setCommercial] = useState<CommercialPerformanceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isIaAdmin = useMemo(
    () => !!user?.roles?.some((r) => r === "ADMIN" || r === "ADMIN_DEV"),
    [user?.roles],
  );

  const load = useCallback(async () => {
    if (!canUsers) return;
    setLoading(true);
    setError(null);
    const { y, m } = utcYearMonth();
    const range = defaultDateRange();
    try {
      const promises: Promise<unknown>[] = [];
      if (isIaAdmin) {
        promises.push(
          fetchSuiteAgentUsageAdmin({ year: y, month: m })
            .then(setIa)
            .catch(() => setIa(null)),
        );
      } else {
        setIa(null);
      }
      promises.push(fetchDashboard().then(setDash).catch(() => setDash(null)));
      if (canCommercial) {
        promises.push(
          fetchCommercialPerformance({ from: range.from, to: range.to })
            .then(setCommercial)
            .catch(() => setCommercial(null)),
        );
      } else {
        setCommercial(null);
      }
      await Promise.all(promises);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar el panel");
    } finally {
      setLoading(false);
    }
  }, [canUsers, canCommercial, isIaAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canUsers) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-700 dark:text-slate-200">No tiene permiso para ver este panel.</p>
        <Link href="/" className="btn-secondary mt-4 inline-block">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const iaTop = (ia?.byUser ?? []).slice(0, 8);
  const iaDaily = (ia?.dailyTotals ?? []).slice(-18);
  const studiesPie = (dash?.charts?.studiesByStatus ?? []).map((x) => ({
    name: x.label || x.status,
    value: x.count,
  }));
  const amountsBySeller = (commercial?.charts?.amountsBySeller ?? []).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Panel Usuarios</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Resumen de uso de IA (mes UTC), indicadores de ventas y estudios. Use la lista para abrir el panel de una
            persona concreta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/usuarios" className="btn-secondary text-sm">
            Lista y crear usuarios
          </Link>
          <Link href="/vista-previa-suite/agentes-ia/uso" className="btn-secondary text-sm">
            Uso IA (detalle)
          </Link>
          {canCommercial ? (
            <Link href="/admin/comercial" className="btn-secondary text-sm">
              Panel comercial
            </Link>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {loading && !dash && !ia && !commercial ? (
        <div className="card flex justify-center p-12 text-slate-500">Cargando panel…</div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="card flex flex-col p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Uso SAM (suite)
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Mes actual UTC · tokens OpenAI</p>
          {!isIaAdmin ? (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
              El desglose por usuario requiere rol administrador. Puede ver su consumo en{" "}
              <Link href="/vista-previa-suite/agentes-ia/uso" className="text-violet-600 underline dark:text-violet-300">
                Uso SAM
              </Link>
              .
            </p>
          ) : ia && iaTop.length > 0 ? (
            <>
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={iaTop} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="email" width={100} tick={{ fontSize: 9 }} />
                    <Tooltip
                      formatter={(value) => formatTokens(Number(value))}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="usedTotal" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Tokens" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Clic en un usuario desde{" "}
                <Link href="/usuarios" className="underline">
                  la lista
                </Link>{" "}
                para ver su panel individual.
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Sin consumo registrado este mes.</p>
          )}
          {isIaAdmin && iaDaily.length > 0 ? (
            <div className="mt-4 h-40 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Organización · tokens / día</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={iaDaily} margin={{ top: 2, right: 4, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="shortLabel" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={36} />
                  <Tooltip formatter={(value) => formatTokens(Number(value))} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="totalTokens" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </section>

        <section className="card flex flex-col p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ventas</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Desde el dashboard global del producto</p>
          {dash ? (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <dt className="text-xs text-slate-500">Cotizaciones</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {dash.kpis.quotesTotal}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <dt className="text-xs text-slate-500">Este mes</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {dash.kpis.quotesThisMonth}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <dt className="text-xs text-slate-500">Monto cotizado</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.round(dash.kpis.totalQuotedAmount).toLocaleString("es")}
                </dd>
              </div>
              <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                <dt className="text-xs text-slate-500">Ticket medio</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.round(dash.kpis.averageTicket).toLocaleString("es")}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No se pudo cargar el dashboard.</p>
          )}
          {canCommercial && amountsBySeller.length > 0 ? (
            <div className="mt-4 h-52 border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-300">Monto por vendedor (periodo admin)</p>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={amountsBySeller} margin={{ top: 4, right: 8, left: -12, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-25} textAnchor="end" height={50} interval={0} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(value) => Number(value).toLocaleString("es")} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  <Bar dataKey="amount" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}
        </section>

        <section className="card flex flex-col p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Estudios FV</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">KPIs y estado de estudios</p>
          {dash ? (
            <>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Estudios</dt>
                  <dd className="text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {dash.kpis.studiesTotal}
                  </dd>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Convertidos</dt>
                  <dd className="text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                    {dash.kpis.studiesConverted}
                  </dd>
                </div>
                <div className="col-span-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/80">
                  <dt className="text-xs text-slate-500">Conversión</dt>
                  <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dash.kpis.conversionPercent}%</dd>
                </div>
              </dl>
              {studiesPie.some((s) => s.value > 0) ? (
                <div className="mt-4 flex h-52 items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={studiesPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={68}>
                        {studiesPie.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-4 text-center text-sm text-slate-500">Sin estudios por estado en el gráfico.</p>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}

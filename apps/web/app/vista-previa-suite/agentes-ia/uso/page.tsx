"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSuiteAgentRuntime } from "../../../../components/suite-agent/SuiteAgentRuntimeProvider";
import { useAuth } from "../../../../lib/auth-context";
import {
  fetchSuiteAgentUsageAdmin,
  fetchSuiteAgentUsageMe,
  type SuiteAgentUsageAdminResponse,
  type SuiteAgentUsageMeResponse,
} from "../../../../lib/api";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function isSuiteUsageAdmin(roles: string[] | undefined): boolean {
  return !!roles?.some((r) => r === "ADMIN" || r === "ADMIN_DEV");
}

function formatTokens(n: number): string {
  return n.toLocaleString("es");
}

export default function SuiteAgentUsagePage() {
  const { user } = useAuth();
  const { mergeRuntime } = useSuiteAgentRuntime();
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [filterDraft, setFilterDraft] = useState("");
  const [adminQueryUserId, setAdminQueryUserId] = useState<string | undefined>(undefined);

  const [me, setMe] = useState<SuiteAgentUsageMeResponse | null>(null);
  const [admin, setAdmin] = useState<SuiteAgentUsageAdminResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canAdmin = isSuiteUsageAdmin(user?.roles);

  const yearOptions = useMemo(() => {
    const y = now.getUTCFullYear();
    return Array.from({ length: 6 }, (_, i) => y - 3 + i);
  }, [now]);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const meRes = await fetchSuiteAgentUsageMe({ year, month });
      setMe(meRes);
      if (canAdmin) {
        const adm = await fetchSuiteAgentUsageAdmin({
          year,
          month,
          userId: adminQueryUserId,
        });
        setAdmin(adm);
      } else {
        setAdmin(null);
      }
    } catch (e) {
      setMe(null);
      setAdmin(null);
      setError(e instanceof Error ? e.message : "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [year, month, canAdmin, adminQueryUserId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    mergeRuntime({
      summary: [
        "Panel uso SAM (suite): consumo mensual UTC de SAM (✦), límite por usuario y gráficos.",
        canAdmin ? "Como administrador ve resumen por usuario y puede filtrar por userId." : "Vista personal de su consumo.",
      ].join("\n"),
    });
  }, [mergeRuntime, canAdmin]);

  const monthLabel = `${MONTH_NAMES[month - 1] ?? month} ${year} (UTC)`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-700 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            SAM · DELTA SPACE
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Uso SAM</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Tokens contabilizados según OpenAI (<span className="font-medium">total_tokens</span>) por respuesta del
            modelo. El período es el mes calendario en <span className="font-medium">UTC</span>. Los topes se configuran
            en <span className="font-medium">Usuarios → editar</span>.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Año</label>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Mes</label>
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <Link
            href="/vista-previa-suite/agentes-ia"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            Volver al hub
          </Link>
        </div>
      </div>

      {error && (
        <div
          className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200"
          role="alert"
        >
          {error}
        </div>
      )}

      {loading && !me && !error ? (
        <p className="mt-10 text-center text-sm text-slate-500">Cargando…</p>
      ) : null}

      {me && (
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Su consumo
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{monthLabel}</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Usados</dt>
                <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {formatTokens(me.usedTotal)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-slate-600 dark:text-slate-400">Límite</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  {me.suiteAgentMonthlyTokenLimit != null && me.suiteAgentMonthlyTokenLimit > 0
                    ? formatTokens(me.suiteAgentMonthlyTokenLimit)
                    : "Sin límite"}
                </dd>
              </div>
              {me.remaining != null && (
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-600 dark:text-slate-400">Restante</dt>
                  <dd className="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatTokens(me.remaining)}
                  </dd>
                </div>
              )}
            </dl>
            {me.percentOfLimit != null && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-slate-600 dark:text-slate-400">
                  <span>Uso del tope</span>
                  <span>{me.percentOfLimit}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all dark:bg-violet-400"
                    style={{ width: `${Math.min(100, me.percentOfLimit)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Actividad por día (usted)
            </h2>
            <div className="mt-4 h-56 w-full">
              {me.daily.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">Sin consumo este mes.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={me.daily} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} label={{ value: "Día (UTC)", position: "bottom", offset: 0, fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} width={48} />
                    <Tooltip
                      formatter={(value) => [formatTokens(Number(value)), "Tokens"]}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload as { day?: string } | undefined;
                        return row?.day ? `Fecha: ${row.day}` : String(label);
                      }}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="totalTokens" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Tokens" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {canAdmin && admin && (
        <section className="mt-12 space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Administración</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Resumen por usuario en {monthLabel}. Opcional: filtre por ID de usuario para las gráficas agregadas.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                User ID (opcional)
                <input
                  type="text"
                  value={filterDraft}
                  onChange={(e) => setFilterDraft(e.target.value)}
                  placeholder="cuid…"
                  className="ml-2 mt-1 w-56 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <button
                type="button"
                onClick={() => setAdminQueryUserId(filterDraft.trim() || undefined)}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-violet-600 dark:hover:bg-violet-500"
              >
                Aplicar filtro
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3 text-right">Llamadas</th>
                    <th className="px-4 py-3 text-right">Tokens</th>
                    <th className="px-4 py-3 text-right">Límite</th>
                    <th className="px-4 py-3 text-right">% tope</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {admin.byUser.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Sin registros de uso en este período.
                      </td>
                    </tr>
                  ) : (
                    admin.byUser.map((row) => (
                      <tr key={row.userId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{row.email}</div>
                          {row.name ? (
                            <div className="text-xs text-slate-500 dark:text-slate-400">{row.name}</div>
                          ) : null}
                        </td>
                        <td className="max-w-[140px] truncate px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {row.userId}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{row.callCount}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium">{formatTokens(row.usedTotal)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                          {row.suiteAgentMonthlyTokenLimit != null && row.suiteAgentMonthlyTokenLimit > 0
                            ? formatTokens(row.suiteAgentMonthlyTokenLimit)
                            : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.percentOfLimit != null ? `${row.percentOfLimit}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Tokens por día {adminQueryUserId ? `(filtrado)` : "(todos los usuarios)"}
            </h3>
            <div className="mt-4 h-64 w-full">
              {admin.dailyTotals.length === 0 ? (
                <p className="flex h-full items-center justify-center text-sm text-slate-500">Sin datos.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={admin.dailyTotals} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                    <XAxis dataKey="shortLabel" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} width={52} />
                    <Tooltip
                      formatter={(value) => [formatTokens(Number(value)), "Tokens"]}
                      labelFormatter={(label, payload) => {
                        const row = payload?.[0]?.payload as { day?: string } | undefined;
                        return row?.day ?? String(label);
                      }}
                      contentStyle={{ borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="totalTokens" fill="#0ea5e9" radius={[4, 4, 0, 0]} name="Tokens" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

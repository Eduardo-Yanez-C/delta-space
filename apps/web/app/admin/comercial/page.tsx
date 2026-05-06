"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import {
  fetchCommercialPerformance,
  fetchUsers,
  type CommercialPerformanceData,
  type User,
} from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { useCan } from "../../../lib/useCan";

const SHORT_MONTH_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function formatMonthTick(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const mi = parseInt(m, 10) - 1;
  if (!y || Number.isNaN(mi) || mi < 0 || mi > 11) return monthKey;
  return `${SHORT_MONTH_ES[mi]} '${y.slice(-2)}`;
}

function defaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

function formatClp(n: number): string {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(
    Math.round(n),
  );
}

function sellersToCsv(data: CommercialPerformanceData): string {
  const headers = [
    "Vendedor",
    "Email",
    "Cotizaciones",
    "Estudios FV",
    "Estudios convertidos",
    "Monto total",
    "Ticket promedio",
    "Última actividad",
  ];
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [headers.join(";")];
  for (const s of data.sellers) {
    lines.push(
      [
        esc(s.name),
        esc(s.email),
        String(s.quotesCreated),
        String(s.fvStudiesCreated),
        String(s.fvStudiesConverted),
        String(s.totalQuotedAmount),
        String(s.averageTicket),
        esc(s.lastActivityAt ? formatDate(s.lastActivityAt) : "—"),
      ].join(";"),
    );
  }
  return `\uFEFF${lines.join("\n")}`;
}

function downloadBlob(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadXlsx(data: CommercialPerformanceData, filename: string) {
  const XLSX = await import("xlsx");
  const rows = data.sellers.map((s) => ({
    Vendedor: s.name,
    Email: s.email,
    Cotizaciones: s.quotesCreated,
    "Estudios FV": s.fvStudiesCreated,
    "Estudios convertidos": s.fvStudiesConverted,
    "Monto total": s.totalQuotedAmount,
    "Ticket promedio": s.averageTicket,
    "Última actividad": s.lastActivityAt ? formatDate(s.lastActivityAt) : "—",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Por vendedor");
  const meta = [
    { Campo: "Período desde", Valor: data.period.from },
    { Campo: "Período hasta", Valor: data.period.to },
    { Campo: "Nota", Valor: data.v2Note },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), "Metadatos");
  XLSX.writeFile(wb, filename);
}

export default function PanelComercialPage() {
  const canAccess = useCan("access", "commercialPerformance");
  const [from, setFrom] = useState(defaultDateRange().from);
  const [to, setTo] = useState(defaultDateRange().to);
  const [userFilterIds, setUserFilterIds] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [data, setData] = useState<CommercialPerformanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [xlsxBusy, setXlsxBusy] = useState(false);

  const loadUsers = useCallback(() => {
    fetchUsers(true)
      .then(setUsers)
      .catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    if (canAccess) loadUsers();
  }, [canAccess, loadUsers]);

  const loadPanel = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCommercialPerformance({
      from,
      to,
      userIds: userFilterIds.length ? userFilterIds : undefined,
    })
      .then(setData)
      .catch((e) => {
        setData(null);
        setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => setLoading(false));
  }, [from, to, userFilterIds]);

  useEffect(() => {
    if (canAccess) void loadPanel();
  }, [canAccess, loadPanel]);

  const quotesMonthData = useMemo(() => {
    if (!data) return [];
    return data.charts.quotesByMonth.map((m) => ({ ...m, tick: formatMonthTick(m.month) }));
  }, [data]);

  const conversionPie = useMemo(() => {
    if (!data) return [];
    const { converted, notConverted } = data.charts.conversion;
    return [
      { name: "Con cotización", value: converted, fill: "#f59e0b" },
      { name: "Sin cotización", value: notConverted, fill: "#94a3b8" },
    ].filter((x) => x.value > 0);
  }, [data]);

  const toggleUserFilter = (id: string) => {
    setUserFilterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  if (!canAccess) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Acceso restringido</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            El panel comercial solo está disponible para administración (ADMIN / ADMIN_DEV).
          </p>
          <Link href="/" className="btn-primary mt-6 inline-block">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            KPIs y ranking por vendedor según cotizaciones y estudios FV en la base comercial (V1, sin auditoría de
            ediciones).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-slate-500 dark:text-slate-400">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-500 dark:text-slate-400">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
            />
          </label>
          <button type="button" className="btn-secondary" onClick={() => void loadPanel()} disabled={loading}>
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      <details className="card border-slate-200 p-4 dark:border-slate-700">
        <summary className="cursor-pointer text-sm font-medium text-slate-800 dark:text-slate-200">
          Cómo se asignan cotizaciones y estudios a cada vendedor
        </summary>
        {data ? (
          <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>{data.attribution.summary}</p>
            <ul className="list-inside list-disc space-y-1">
              {data.attribution.rules.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            <p className="border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-600">{data.v2Note}</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Cargue datos para ver el detalle devuelto por el API.</p>
        )}
      </details>

      <div className="card p-4">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Filtrar por vendedores</h2>
        <p className="mt-1 text-xs text-slate-500">Vacío = todos los que tengan actividad en el período.</p>
        <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-y-auto">
          {users.map((u) => {
            const label = u.fullName?.trim() || u.name?.trim() || u.email;
            const on = userFilterIds.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggleUserFilter(u.id)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  on
                    ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
                    : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="card border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          {error}
        </div>
      )}

      {data && !loading && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <KpiCard label="Cotizaciones (período)" value={String(data.kpis.quotesCreated)} />
            <KpiCard label="Estudios FV (período)" value={String(data.kpis.fvStudiesCreated)} />
            <KpiCard label="Estudios convertidos" value={String(data.kpis.fvStudiesConverted)} />
            <KpiCard label="Monto total cotizado" value={formatClp(data.kpis.totalQuotedAmount)} />
            <KpiCard label="Ticket promedio" value={formatClp(data.kpis.averageTicket)} />
            <KpiCard label="Conversión estudio → cotización" value={`${data.kpis.conversionPercent.toFixed(1)} %`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card min-h-[280px] p-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cotizaciones por mes</h3>
              <div className="mt-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={quotesMonthData} margin={{ top: 8, right: 8, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis dataKey="tick" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis width={32} tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: unknown) => [
                        typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""),
                        "Cotizaciones",
                      ]}
                      labelFormatter={(_, p) => (p?.[0]?.payload as { label?: string })?.label ?? ""}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card min-h-[280px] p-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Monto por vendedor</h3>
              <div className="mt-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.charts.amountsBySeller.map((s) => ({
                      ...s,
                      short: s.name.length > 18 ? `${s.name.slice(0, 16)}…` : s.name,
                    }))}
                    layout="vertical"
                    margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => formatClp(Number(v))} />
                    <YAxis type="category" dataKey="short" width={88} tick={{ fontSize: 9 }} />
                    <Tooltip
                      formatter={(v: unknown) => (typeof v === "number" ? formatClp(v) : String(v ?? ""))}
                      labelFormatter={(_, p) => (p?.[0]?.payload as { name?: string })?.name ?? ""}
                    />
                    <Bar dataKey="amount" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card min-h-[280px] p-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Conversión (estudios del período)
              </h3>
              <div className="mt-2 h-[220px]">
                {conversionPie.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    Sin estudios FV creados en el período.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={conversionPie}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {conversionPie.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) =>
                          typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? "")
                        }
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="card min-h-[280px] p-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Cotizaciones por estado</h3>
              <div className="mt-2 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.quotesByStatus} margin={{ top: 8, right: 8, left: -12, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                    <XAxis
                      dataKey="status"
                      tick={{ fontSize: 9 }}
                      angle={-35}
                      textAnchor="end"
                      interval={0}
                      height={56}
                    />
                    <YAxis width={28} tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      formatter={(v: unknown) => [
                        typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""),
                        "Cotizaciones",
                      ]}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => downloadBlob(`panel-comercial-${from}_${to}.csv`, sellersToCsv(data), "text/csv;charset=utf-8")}
            >
              Descargar CSV
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={xlsxBusy}
              onClick={() => {
                setXlsxBusy(true);
                void downloadXlsx(data, `panel-comercial-${from}_${to}.xlsx`).finally(() => setXlsxBusy(false));
              }}
            >
              {xlsxBusy ? "Generando Excel…" : "Descargar Excel"}
            </button>
          </div>

          <div className="card overflow-x-auto p-0">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
                <tr>
                  <th className="px-4 py-3 font-semibold">Vendedor</th>
                  <th className="px-4 py-3 font-semibold">Cotizaciones</th>
                  <th className="px-4 py-3 font-semibold">Estudios</th>
                  <th className="px-4 py-3 font-semibold">Convertidos</th>
                  <th className="px-4 py-3 font-semibold">Monto total</th>
                  <th className="px-4 py-3 font-semibold">Ticket prom.</th>
                  <th className="px-4 py-3 font-semibold">Última actividad</th>
                </tr>
              </thead>
              <tbody>
                {data.sellers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Sin filas: no hay actividad atribuible en el período (o el filtro de usuarios excluye todo).
                    </td>
                  </tr>
                ) : (
                  data.sellers.map((s) => (
                    <tr
                      key={s.userId}
                      className="border-b border-slate-100 dark:border-slate-800/80"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{s.name}</div>
                        <div className="text-xs text-slate-500">{s.email}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{s.quotesCreated}</td>
                      <td className="px-4 py-3 tabular-nums">{s.fvStudiesCreated}</td>
                      <td className="px-4 py-3 tabular-nums">{s.fvStudiesConverted}</td>
                      <td className="px-4 py-3 tabular-nums">{formatClp(s.totalQuotedAmount)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatClp(s.averageTicket)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {s.lastActivityAt ? formatDate(s.lastActivityAt) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && loading && (
        <div className="card flex items-center justify-center p-12 text-slate-500">Cargando panel comercial…</div>
      )}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card border-slate-200 p-4 dark:border-slate-700">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</div>
    </div>
  );
}

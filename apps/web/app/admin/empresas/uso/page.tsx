"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchCompaniesUsage, type CompanyUsageRow } from "../../../../lib/api";
import { useCan } from "../../../../lib/useCan";

function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  return { from, to };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function toCsv(rows: CompanyUsageRow[], range: { from: string; to: string }): string {
  const headers = [
    "Empresa",
    "Slug",
    "Activa",
    "Usuarios",
    "Cotizaciones (rango)",
    "Estudios FV (rango)",
    "Último login",
    "Creada",
    "Desde",
    "Hasta",
  ];
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const out = [headers.join(";")];
  for (const r of rows) {
    out.push(
      [
        esc(r.name),
        esc(r.slug),
        r.active ? "SI" : "NO",
        String(r.users),
        String(r.quotesInRange),
        String(r.fvStudiesInRange),
        esc(r.lastLoginAt ? formatDateTime(r.lastLoginAt) : "—"),
        esc(formatDateTime(r.createdAt)),
        range.from,
        range.to,
      ].join(";"),
    );
  }
  return `\uFEFF${out.join("\n")}`;
}

export default function UsoEmpresasAdminPage() {
  const canAccess = useCan("access", "companiesUsage");
  const def = useMemo(() => defaultRange(), []);
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<CompanyUsageRow[] | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchCompaniesUsage({ from, to })
      .then((r) => setRows(r.companies))
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const sorted = useMemo(() => {
    if (!rows) return [];
    return [...rows].sort((a, b) => {
      const aa = a.active ? 0 : 1;
      const bb = b.active ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return b.quotesInRange - a.quotesInRange;
    });
  }, [rows]);

  if (!canAccess) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
          No tiene permisos para ver uso por empresa.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Desde</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Hasta</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field" />
            </div>
            <div className="flex items-end gap-2">
              <button type="button" className="btn-primary" onClick={load}>
                Aplicar
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setFrom(def.from);
                  setTo(def.to);
                  setTimeout(load, 0);
                }}
              >
                Mes actual
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={!rows || rows.length === 0}
              onClick={() => {
                if (!rows || rows.length === 0) return;
                const csv = toCsv(rows, { from, to });
                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `uso-empresas_${from}_${to}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
            {error}
          </div>
        )}
      </div>

      {loading && !rows ? (
        <div className="card flex items-center justify-center p-12">
          <span className="text-slate-500 dark:text-slate-400">Cargando…</span>
        </div>
      ) : null}

      {rows && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Empresa</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Usuarios</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Cotizaciones</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Estudios FV</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Último login</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {sorted.map((r) => (
                <tr key={r.companyId}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{r.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{r.slug}</div>
                  </td>
                  <td className="px-4 py-2">{r.users}</td>
                  <td className="px-4 py-2">{r.quotesInRange}</td>
                  <td className="px-4 py-2">{r.fvStudiesInRange}</td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{formatDateTime(r.lastLoginAt)}</td>
                  <td className="px-4 py-2">
                    {r.active ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Activa</span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Inactiva</span>
                    )}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Sin empresas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


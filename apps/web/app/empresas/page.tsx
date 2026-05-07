"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchCompanies, type Company } from "../../lib/api";
import { useCan } from "../../lib/useCan";

export default function EmpresasPage() {
  const canAccess = useCan("access", "companies");
  const [list, setList] = useState<Company[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchCompanies()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    load();
  }, [canAccess]);

  const sorted = useMemo(() => {
    if (!list) return [];
    return [...list].sort((a, b) => {
      const aa = a.active ? 0 : 1;
      const bb = b.active ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return (a.name ?? "").localeCompare(b.name ?? "", "es");
    });
  }, [list]);

  if (!canAccess) {
    return (
      <div className="card p-6">
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          No tiene permisos para administrar empresas.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Multi-empresa: cada usuario se asigna a una empresa y solo ve datos de su tenant. ADMIN/ADMIN_DEV ve todo.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={load} className="btn-secondary">
            Recargar
          </button>
          <Link href="/empresas/nueva" className="btn-primary">
            Nueva empresa
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {loading && !list ? (
        <div className="card flex items-center justify-center p-12">
          <span className="text-slate-500 dark:text-slate-400">Cargando empresas…</span>
        </div>
      ) : null}

      {list && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Nombre</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Slug</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Estado</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {sorted.map((c) => (
                <tr key={c.id} className="dark:bg-slate-800">
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{c.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{c.slug}</td>
                  <td className="px-4 py-2">
                    {c.active ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Activa
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        Inactiva
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/empresas/${encodeURIComponent(c.id)}/editar`}
                      className="text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No hay empresas.
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


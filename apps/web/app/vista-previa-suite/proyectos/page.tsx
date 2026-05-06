"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";
import { fetchSuiteProjects, type SuiteProjectRow } from "../../../lib/api";
import { hasSuiteNavGrant } from "../../../lib/suite-nav-grants";

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export default function SuiteProyectosPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<SuiteProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const canSee = useMemo(
    () => hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "proyectos"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canCreate = useMemo(() => {
    const r = user?.roles ?? [];
    return ["ADMIN_DEV", "ADMIN", "VENDEDOR_TECNICO", "INGENIERIA", "VENTAS"].some((x) => r.includes(x));
  }, [user?.roles]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canSee) {
      router.replace("/acceso-restringido");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSuiteProjects()
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar proyectos");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, canSee, router]);

  if (authLoading || (!user && !error)) {
    return <p className="p-6 text-sm text-slate-600">Cargando…</p>;
  }

  return (
    <main className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vista previa de suite</p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Proyectos</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Listado y ficha resumen (cliente, fechas, avance). Los riesgos del proyecto se gestionan en{" "}
            <Link href="/vista-previa-suite/riesgos" className="font-medium text-primary-600 underline">
              Riesgos
            </Link>
            .
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/vista-previa-suite/proyectos/nuevo"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Nuevo proyecto
          </Link>
        ) : null}
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Avance</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Cargando proyectos…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay proyectos. Cree uno para asociar riesgos y seguimiento.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/80 dark:border-slate-800 dark:hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-mono text-xs text-slate-800 dark:text-slate-200">{row.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.client}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{row.status}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(row.startDate)}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{Math.round(row.progress ?? 0)}%</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/vista-previa-suite/proyectos/${row.id}`}
                      className="font-semibold text-primary-600 hover:underline dark:text-primary-400"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

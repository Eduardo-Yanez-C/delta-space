"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAuditLogs, type AuditLog } from "../../../lib/api";
import { useCan } from "../../../lib/useCan";

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function shortJsonPreview(raw: string | null): string {
  if (!raw) return "—";
  const s = raw.trim();
  if (!s) return "—";
  return s.length > 160 ? `${s.slice(0, 160)}…` : s;
}

export default function AuditoriaAdminPage() {
  const canAccess = useCan("access", "auditLog");
  const [list, setList] = useState<AuditLog[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [take, setTake] = useState(200);
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    fetchAuditLogs({
      take,
      entityType: entityType.trim() || undefined,
      entityId: entityId.trim() || undefined,
      companyId: companyId.trim() || undefined,
      userId: userId.trim() || undefined,
    })
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccess]);

  const rows = useMemo(() => list ?? [], [list]);

  if (!canAccess) {
    return (
      <div className="card p-6">
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          No tiene permisos para ver auditoría.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Límite</label>
              <input
                type="number"
                min={1}
                max={500}
                value={take}
                onChange={(e) => setTake(Math.min(500, Math.max(1, Number(e.target.value) || 200)))}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">entityType</label>
              <input value={entityType} onChange={(e) => setEntityType(e.target.value)} className="input-field" placeholder="Company / User / ..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">entityId</label>
              <input value={entityId} onChange={(e) => setEntityId(e.target.value)} className="input-field" placeholder="cuid..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">companyId</label>
              <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="input-field" placeholder="actor companyId" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">userId</label>
              <input value={userId} onChange={(e) => setUserId(e.target.value)} className="input-field" placeholder="actor userId" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={load}>
              Aplicar filtros
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEntityType("");
                setEntityId("");
                setCompanyId("");
                setUserId("");
                setTake(200);
                setTimeout(load, 0);
              }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {loading && !list ? (
        <div className="card flex items-center justify-center p-12">
          <span className="text-slate-500 dark:text-slate-400">Cargando auditoría…</span>
        </div>
      ) : null}

      {list && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Fecha</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Acción</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Entidad</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Actor</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Antes</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Después</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">{r.action}</td>
                  <td className="px-4 py-2">
                    <div className="text-slate-900 dark:text-slate-100">
                      {r.entityType}
                      {r.entityId ? <span className="ml-2 font-mono text-xs text-slate-500">{r.entityId}</span> : null}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      companyId: <span className="font-mono">{r.companyId}</span>
                      {r.entityCompanyId ? (
                        <>
                          {" "}
                          · entityCompanyId: <span className="font-mono">{r.entityCompanyId}</span>
                        </>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-slate-900 dark:text-slate-100">
                      {r.user?.email ?? r.userId}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{r.userId}</div>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{shortJsonPreview(r.beforeJson)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-300">{shortJsonPreview(r.afterJson)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    Sin registros.
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


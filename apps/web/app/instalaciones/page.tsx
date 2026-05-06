"use client";

import { useEffect, useState } from "react";
import {
  fetchInstallations,
  revokeInstallation,
  type InstallationListItem,
} from "../../lib/api";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export default function InstalacionesPage() {
  const [list, setList] = useState<InstallationListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetchInstallations()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRevoke = (item: InstallationListItem) => {
    if (!confirm(`¿Revocar la instalación "${item.deviceName || item.id}"? La app en ese equipo dejará de tener acceso en el próximo arranque.`)) return;
    setRevokingId(item.id);
    revokeInstallation(item.id)
      .then(() => load())
      .catch((e) => setError(e instanceof Error ? e.message : "Error al revocar"))
      .finally(() => setRevokingId(null));
  };

  if (loading && !list) {
    return (
      <div className="flex justify-center py-12 text-slate-500">Cargando instalaciones…</div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Listado de instalaciones registradas (equipos que activaron con código). Solo administradores pueden ver y revocar.
      </p>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}
      {list && list.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
          No hay instalaciones registradas.
        </div>
      )}
      {list && list.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Código</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Equipo</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Estado</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Creado</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Revocado</th>
                <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300 w-24" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {list.map((item) => (
                <tr key={item.id} className="dark:bg-slate-800">
                  <td className="px-4 py-2 font-mono text-xs">{item.activationCode}</td>
                  <td className="px-4 py-2">{item.deviceName || "—"}</td>
                  <td className="px-4 py-2">
                    {item.active && !item.revokedAt ? (
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                        Activa
                      </span>
                    ) : (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        Revocada
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                    {formatDate(item.createdAt)}
                  </td>
                  <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                    {formatDate(item.revokedAt)}
                  </td>
                  <td className="px-4 py-2">
                    {item.active && !item.revokedAt && (
                      <button
                        type="button"
                        disabled={revokingId === item.id}
                        onClick={() => handleRevoke(item)}
                        className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {revokingId === item.id ? "Revocando…" : "Revocar"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

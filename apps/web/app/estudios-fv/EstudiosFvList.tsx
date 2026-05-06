"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCan } from "../../lib/useCan";
import { formatDate } from "../../lib/format";
import {
  fetchFvStudies,
  fetchClients,
  archiveFvStudy,
  deleteFvStudy,
  type FvStudy,
  type Client,
} from "../../lib/api";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  VALIDADO: "Validado",
  COTIZADO: "Cotizado",
  ARCHIVADO: "Archivado",
};

const CONNECTION_LABELS: Record<string, string> = {
  MONOFASICO: "Monofásico",
  TRIFASICO: "Trifásico",
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
};

export function EstudiosFvList() {
  const searchParams = useSearchParams();
  const canCreate = useCan("create", "fvStudy");
  const canEdit = useCan("edit", "fvStudy");
  const canArchive = useCan("archive", "fvStudy");
  const canDeleteStudy = useCan("delete", "fvStudy");
  const [studies, setStudies] = useState<FvStudy[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterClientId, setFilterClientId] = useState(searchParams?.get("clientId") ?? "");
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchClients()
      .then((data) => { if (!cancelled) setClients(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const clientId = filterClientId.trim() || undefined;
    fetchFvStudies(clientId)
      .then((data) => { if (!cancelled) setStudies(data); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [filterClientId]);

  const filtered = studies.filter((s) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!s.title.toLowerCase().includes(q) &&
          !(s.client?.name ?? "").toLowerCase().includes(q)) return false;
    }
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const handleArchive = async (id: string) => {
    if (
      !confirm(
        "¿Archivar este estudio FV?\n\n" +
          "• Quedará solo lectura (no se podrá editar).\n" +
          "• Sigue visible en listados y en cotizaciones que lo referencien.\n\n" +
          "¿Continuar?",
      )
    ) {
      return;
    }
    setArchivingId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      const updated = await archiveFvStudy(id);
      setStudies((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setActionSuccess("Estudio archivado. Ya no se puede editar; puede seguir consultándolo o vinculado desde cotizaciones.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo archivar el estudio. Intente de nuevo o revise permisos.");
    } finally {
      setArchivingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "¿Eliminar permanentemente este estudio FV?\n\n" +
          "• Se borran estudio, meses y diseño de implantación.\n" +
          "• Las cotizaciones vinculadas se conservan; solo pierden el enlace al estudio.\n\n" +
          "No se puede deshacer. ¿Continuar?",
      )
    ) {
      return;
    }
    setDeletingId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteFvStudy(id);
      setStudies((prev) => prev.filter((s) => s.id !== id));
      setActionSuccess("Estudio eliminado del sistema.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo eliminar el estudio.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando estudios FV…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        {error}
        <p className="mt-1 text-sm">Comprueba que la API esté en marcha.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100" role="status">
          {actionSuccess}
          <button type="button" onClick={() => setActionSuccess(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por título o cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-xs"
          />
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            className="input-field max-w-[200px]"
          >
            <option value="">Todos los clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field max-w-[140px]"
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {canCreate && (
            <Link href="/estudios-fv/nuevo" className="btn-primary ml-auto">
              Nuevo estudio FV
            </Link>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card flex flex-col items-center justify-center p-12 text-center">
          <p className="text-slate-600">
            {studies.length === 0 ? "No hay estudios FV registrados." : "Ningún estudio coincide con los filtros."}
          </p>
          {canCreate && studies.length === 0 && (
            <Link href="/estudios-fv/nuevo" className="btn-primary mt-4">
              Crear primer estudio FV
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Título
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Cliente
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Conexión
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Tipo proyecto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Propietario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Actualizado
                  </th>
                  <th className="relative px-4 py-3"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <Link href={`/estudios-fv/${s.id}`} className="font-medium text-slate-900 hover:underline dark:text-slate-100">
                        {s.title}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {s.client?.name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          s.status === "ARCHIVADO"
                            ? "bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                            : s.status === "VALIDADO"
                            ? "bg-green-100 text-green-800"
                            : s.status === "COTIZADO"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {STATUS_LABELS[s.status] ?? s.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {CONNECTION_LABELS[s.connectionType] ?? s.connectionType}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {PROJECT_TYPE_LABELS[s.tipoProyecto] ?? s.tipoProyecto}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {s.owner?.name ?? s.owner?.email ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                      {formatDate(s.updatedAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/estudios-fv/${s.id}`}
                        className="btn-secondary mr-2 py-1.5 px-3 text-xs"
                      >
                        Ver
                      </Link>
                      {canEdit && s.status !== "ARCHIVADO" && (
                        <Link
                          href={`/estudios-fv/${s.id}/editar`}
                          className="btn-secondary mr-2 py-1.5 px-3 text-xs"
                        >
                          Editar
                        </Link>
                      )}
                      {canArchive && s.status !== "ARCHIVADO" && (
                        <button
                          type="button"
                          onClick={() => handleArchive(s.id)}
                          disabled={archivingId === s.id || deletingId === s.id}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        >
                          {archivingId === s.id ? "…" : "Archivar"}
                        </button>
                      )}
                      {canDeleteStudy && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          disabled={deletingId === s.id || archivingId === s.id}
                          className="ml-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          {deletingId === s.id ? "…" : "Eliminar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

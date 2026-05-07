"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "../../lib/useCan";
import { formatDate, formatMoney } from "../../lib/format";
import {
  fetchQuotes,
  fetchClients,
  fetchAssignableSalesUsers,
  type FilterQuotesParams,
  type QuoteListItem,
  type Client,
  type User,
} from "../../lib/api";
import { quoteCommercialStatusBadgeClass } from "../../lib/quote-status-ui";
import { COMMERCIAL_STATUS_LABELS, COMMERCIAL_STATUS_OPTIONS } from "./constants";

const PROJECT_TYPE_LABELS: Record<string, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
};

export function CotizacionesList() {
  const canEdit = useCan("edit", "quote");
  const canCreate = useCan("create", "quote");
  const [quotes, setQuotes] = useState<QuoteListItem[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterClientId, setFilterClientId] = useState("");
  const [filterOwnerId, setFilterOwnerId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchClients(), fetchAssignableSalesUsers()])
      .then(([c, u]) => {
        if (!cancelled) {
          setClients(c);
          setUsers(u);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const filters: FilterQuotesParams = {};
    if (filterStatus) filters.status = filterStatus;
    if (filterClientId) filters.clientId = filterClientId;
    if (filterOwnerId) filters.ownerId = filterOwnerId;
    if (search.trim()) filters.search = search.trim();
    if (includeInactive) filters.includeInactive = true;
    fetchQuotes(filters)
      .then((data) => {
        if (!cancelled) setQuotes(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
  }, [filterStatus, filterClientId, filterOwnerId, search, includeInactive]);

  const hasFilters = !!(
    search.trim() ||
    filterStatus ||
    filterClientId ||
    filterOwnerId ||
    includeInactive
  );

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando cotizaciones…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-xs"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field max-w-[140px]"
          >
            <option value="">Estado</option>
            {COMMERCIAL_STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {COMMERCIAL_STATUS_LABELS[value] ?? value}
              </option>
            ))}
          </select>
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            className="input-field max-w-[180px]"
          >
            <option value="">Cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={filterOwnerId}
            onChange={(e) => setFilterOwnerId(e.target.value)}
            className="input-field max-w-[180px]"
          >
            <option value="">Responsable</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-slate-300"
            />
            Incluir anuladas y archivadas
          </label>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
          Por defecto el listado oculta cotizaciones anuladas o archivadas para enfocar lo operativo. Marque la casilla para revisar el historial completo.
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Nº
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Título
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Origen FV
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Cliente
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Tipo proyecto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Versión
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Estado
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Responsable
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Actualizado
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Total
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    <p>{hasFilters ? "Ninguna cotización coincide con los filtros." : "Aún no hay cotizaciones."}</p>
                    {canCreate && (
                      <Link href="/cotizaciones/nueva" className="btn-primary mt-3 inline-block">
                        Nueva cotización
                      </Link>
                    )}
                  </td>
                </tr>
              ) : (
                quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
                      {q.commercialNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {q.title}
                        {q.quoteKind === "MARGIN" ? (
                          <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
                            Margen
                          </span>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {q.sourceFvStudyId ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Desde estudio
                        </span>
                      ) : q.sourceQuoteTemplateId ? (
                        <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                          Desde plantilla
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {q.client?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {PROJECT_TYPE_LABELS[q.projectType] ?? q.projectType}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                      {q.currentVersion ? `v${q.currentVersion.versionNumber}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${quoteCommercialStatusBadgeClass(q.status)}`}
                        title={
                          q.status === "ARCHIVADA"
                            ? "Archivada: fuera de la bandeja activa; datos conservados."
                            : q.status === "ANULADA"
                              ? "Anulada o cancelada; ya no cuenta como oportunidad activa."
                              : undefined
                        }
                      >
                        {COMMERCIAL_STATUS_LABELS[q.status] ?? q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {q.owner ? (q.owner.name || q.owner.email) : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(q.updatedAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
                      {q.currentVersion ? formatMoney(q.currentVersion.total, q.currency ?? undefined) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link href={`/cotizaciones/${q.id}`} className="mr-2 text-amber-600 hover:underline dark:text-amber-300">
                        Ver
                      </Link>
                      {canEdit && (
                        <Link
                          href={`/cotizaciones/${q.id}/editar`}
                          className="text-slate-600 hover:underline"
                        >
                          Editar
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

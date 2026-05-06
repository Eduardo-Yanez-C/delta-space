"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "../../lib/useCan";
import {
  fetchSuppliers,
  type Supplier,
} from "../../lib/api";
import { SupplyOriginBadge, ActorTypeBadge } from "../../components/ui/Badge";

export function ProveedoresList() {
  const canEdit = useCan("edit", "supplier");
  const canCreate = useCan("create", "supplier");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supplyOrigin, setSupplyOrigin] = useState<string>("");
  const [actorType, setActorType] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const filters: { supplyOrigin?: string; actorType?: string; active?: boolean } = {};
    if (supplyOrigin) filters.supplyOrigin = supplyOrigin;
    if (actorType) filters.actorType = actorType;
    if (activeFilter === "true") filters.active = true;
    if (activeFilter === "false") filters.active = false;
    fetchSuppliers(filters)
      .then((data) => {
        let list = data;
        if (search.trim()) {
          const term = search.trim().toLowerCase();
          list = list.filter(
            (s) =>
              s.name.toLowerCase().includes(term) ||
              (s.legalName && s.legalName.toLowerCase().includes(term)) ||
              (s.country && s.country.toLowerCase().includes(term)) ||
              (s.city && s.city.toLowerCase().includes(term))
          );
        }
        setSuppliers(list);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [supplyOrigin, actorType, activeFilter, search]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            placeholder="Buscar por nombre, país, ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field max-w-xs"
          />
          <select
            value={supplyOrigin}
            onChange={(e) => setSupplyOrigin(e.target.value)}
            className="input-field max-w-[140px]"
          >
            <option value="">Origen</option>
            <option value="NACIONAL">Nacional</option>
            <option value="INTERNACIONAL">Internacional</option>
          </select>
          <select
            value={actorType}
            onChange={(e) => setActorType(e.target.value)}
            className="input-field max-w-[160px]"
          >
            <option value="">Tipo de actor</option>
            <option value="FABRICANTE">Fabricante</option>
            <option value="DISTRIBUIDOR">Distribuidor</option>
            <option value="REPRESENTANTE">Representante</option>
            <option value="IMPORTADOR">Importador</option>
            <option value="INTEGRADOR">Integrador</option>
          </select>
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="input-field max-w-[120px]"
          >
            <option value="">Estado</option>
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="card flex items-center justify-center p-12">
          <span className="text-slate-500">Cargando proveedores…</span>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
              <thead className="bg-slate-50 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Nombre
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    País / Ciudad
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Origen
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Tipo de actor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Moneda
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Lead time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-slate-600 dark:text-slate-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {suppliers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                      <p>No hay proveedores que coincidan.</p>
                      {canCreate && (
                        <Link href="/proveedores/nuevo" className="btn-primary mt-3 inline-block">
                          Crear proveedor
                        </Link>
                      )}
                    </td>
                  </tr>
                ) : (
                  suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {s.country ?? "—"} {s.city && ` / ${s.city}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <SupplyOriginBadge origin={s.supplyOrigin} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <ActorTypeBadge actorType={s.actorType} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {s.defaultCurrency ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                        {s.leadTimeDays != null ? `${s.leadTimeDays} días` : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            s.active
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                          }`}
                        >
                          {s.active ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {canEdit && (
                          <Link
                            href={`/proveedores/${s.id}/editar`}
                            className="mr-2 text-amber-600 hover:underline dark:text-amber-300"
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
      )}
    </div>
  );
}

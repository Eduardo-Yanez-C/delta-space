"use client";

import { useEffect, useState } from "react";
import {
  fetchProductSuppliers,
  addProductSupplier,
  updateProductSupplier,
  removeProductSupplier,
  fetchSuppliers,
  type ProductSupplier,
  type Supplier,
} from "../../lib/api";
import { SupplyOriginBadge, ActorTypeBadge } from "../../components/ui/Badge";

export function ProductSuppliersSection({
  productId,
  onUpdate,
  canManage = false,
}: {
  productId: string;
  onUpdate: () => void;
  canManage?: boolean;
}) {
  const [list, setList] = useState<ProductSupplier[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newSupplierId, setNewSupplierId] = useState("");
  const [newIsPrimary, setNewIsPrimary] = useState(false);
  const [newLeadTime, setNewLeadTime] = useState("");
  const [newMoq, setNewMoq] = useState("");
  const [newWarranty, setNewWarranty] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([fetchProductSuppliers(productId), fetchSuppliers({ active: true })])
      .then(([supList, supAll]) => {
        setList(supList);
        setSuppliers(supAll);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [productId]);

  const alreadyLinked = list.map((ps) => ps.supplierId);
  const availableSuppliers = suppliers.filter((s) => !alreadyLinked.includes(s.id));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSupplierId) return;
    setError(null);
    try {
      await addProductSupplier(productId, {
        supplierId: newSupplierId,
        isPrimary: newIsPrimary,
        isAlternative: !newIsPrimary,
        leadTimeDays: newLeadTime ? Number(newLeadTime) : undefined,
        moq: newMoq.trim() || undefined,
        warranty: newWarranty.trim() || undefined,
        notes: newNotes.trim() || undefined,
      });
      setNewSupplierId("");
      setNewIsPrimary(false);
      setNewLeadTime("");
      setNewMoq("");
      setNewWarranty("");
      setNewNotes("");
      setAdding(false);
      load();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al agregar");
    }
  };

  const handleSetPrimary = async (supplierId: string) => {
    setError(null);
    try {
      await updateProductSupplier(productId, supplierId, { isPrimary: true });
      load();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  const handleRemove = async (supplierId: string) => {
    if (!confirm("¿Quitar este proveedor del producto? No se podrá si tiene precios asociados.")) return;
    setError(null);
    try {
      await removeProductSupplier(productId, supplierId);
      load();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se puede eliminar");
    }
  };

  return (
    <div className="card p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Proveedores asociados
      </h3>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-slate-500">Cargando…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Proveedor</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Origen / Tipo</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Rol</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Lead time</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">MOQ</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-600">Garantía</th>
                  {canManage && (
                  <th className="px-4 py-2 text-right font-medium text-slate-600">Acciones</th>
                )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
                {list.map((ps) => (
                  <tr key={ps.id}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100">
                      {ps.supplier?.name ?? ps.supplierId}
                    </td>
                    <td className="px-4 py-2">
                      {ps.supplier && (
                        <>
                          <SupplyOriginBadge origin={ps.supplier.supplyOrigin} />
                          <span className="ml-1">
                            <ActorTypeBadge actorType={ps.supplier.actorType} />
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {ps.isPrimary ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                          Principal
                        </span>
                      ) : ps.isAlternative ? (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          Alternativo
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      {ps.leadTimeDays != null ? `${ps.leadTimeDays} días` : "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600">{ps.moq ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-600">{ps.warranty ?? "—"}</td>
                    {canManage && (
                      <td className="px-4 py-2 text-right">
                        {!ps.isPrimary && (
                          <button
                            type="button"
                            onClick={() => handleSetPrimary(ps.supplierId)}
                            className="text-amber-600 hover:underline mr-2"
                          >
                            Marcar principal
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(ps.supplierId)}
                          className="text-red-600 hover:underline"
                        >
                          Quitar
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {list.length === 0 && !adding && (
            <p className="py-4 text-slate-500">Aún no hay proveedores asociados. Agregue uno para gestionar precios y abastecimiento.</p>
          )}
          {canManage && adding ? (
            <form onSubmit={handleAdd} className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Proveedor *</label>
                  <select
                    value={newSupplierId}
                    onChange={(e) => setNewSupplierId(e.target.value)}
                    className="input-field"
                    required
                  >
                    <option value="">Seleccione proveedor</option>
                    {availableSuppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.supplyOrigin})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={newIsPrimary}
                      onChange={(e) => setNewIsPrimary(e.target.checked)}
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Proveedor principal</span>
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Lead time (días)</label>
                  <input
                    type="number"
                    min={0}
                    value={newLeadTime}
                    onChange={(e) => setNewLeadTime(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">MOQ</label>
                  <input
                    type="text"
                    value={newMoq}
                    onChange={(e) => setNewMoq(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Garantía</label>
                  <input
                    type="text"
                    value={newWarranty}
                    onChange={(e) => setNewWarranty(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-slate-600">Notas</label>
                  <input
                    type="text"
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="input-field"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button type="submit" className="btn-primary">
                  Agregar
                </button>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : canManage ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="btn-secondary mt-4"
              disabled={availableSuppliers.length === 0}
            >
              Agregar proveedor
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

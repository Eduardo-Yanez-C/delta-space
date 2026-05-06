"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import { SupplierForm } from "../../SupplierForm";
import {
  fetchSupplier,
  updateSupplier,
  deactivateSupplier,
  deleteSupplier,
  type Supplier,
} from "../../../../lib/api";
import { ShareEntityToChatModal } from "../../../../components/conversations/ShareEntityToChatModal";

export default function EditarProveedorPage() {
  const canEdit = useCan("edit", "supplier");
  const canDeactivate = useCan("deactivate", "supplier");
  const canDelete = useCan("delete", "supplier");
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  useEffect(() => {
    if (!canEdit) router.replace("/acceso-restringido");
  }, [canEdit, router]);
  if (!canEdit) return null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchSupplier(id)
      .then(setSupplier)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDeactivate = async () => {
    if (!confirm("¿Desactivar este proveedor? No aparecerá en los listados y no podrá asignarse a nuevos productos.")) return;
    setActionError(null);
    try {
      await deactivateSupplier(id);
      router.push("/proveedores?success=updated");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al desactivar");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Eliminar permanentemente este proveedor?\n\n" +
          "Se quitará como proveedor principal donde aplique y se borrarán vínculos y precios asociados a este proveedor.\n\n" +
          "Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await deleteSupplier(id);
      router.push("/proveedores?success=deleted");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Error al eliminar");
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando proveedor…</span>
      </div>
    );
  }
  if (error || !supplier) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error ?? "Proveedor no encontrado"}
        </div>
        <Link href="/proveedores" className="btn-secondary mt-3 inline-block">Volver</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Editar proveedor</h2>
        <div className="flex flex-wrap gap-2">
          {supplier.active && canDeactivate && (
            <button
              type="button"
              onClick={handleDeactivate}
              className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-amber-950/30"
            >
              Desactivar
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-200 dark:hover:bg-red-950/30"
            >
              Eliminar
            </button>
          )}
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Compartir
          </button>
        </div>
      </div>
      <SupplierForm
        mode="edit"
        initial={supplier}
        onSubmit={async (data) => {
          await updateSupplier(id, data);
          router.push("/proveedores?success=updated");
        }}
      />
      </div>
      <ShareEntityToChatModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        entityType="SUPPLIER"
        title={supplier.name}
        sourceEntityId={supplier.id}
        snapshot={{
          name: supplier.name,
          email: supplier.email ?? null,
          phone: supplier.phone ?? null,
          supplyOrigin: supplier.supplyOrigin,
          actorType: supplier.actorType,
        }}
        proposedImport={{
          name: supplier.name,
          email: supplier.email ?? null,
          supplyOrigin: supplier.supplyOrigin,
          actorType: supplier.actorType,
        }}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCan } from "../../lib/useCan";
import { fetchClients, deleteClient, type Client } from "../../lib/api";
import { ShareEntityToChatModal } from "../../components/conversations/ShareEntityToChatModal";

const TYPE_LABELS: Record<string, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
};

export function ClientesList() {
  const canCreate = useCan("create", "client");
  const canEdit = useCan("edit", "client");
  const canDelete = useCan("delete", "client");
  const canReadFvStudy = useCan("read", "fvStudy");
  const canCreateFvStudy = useCan("create", "fvStudy");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareClient, setShareClient] = useState<Client | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchClients()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este cliente? Esta acción no se puede deshacer.")) return;
    setDeletingId(id);
    setActionError(null);
    setActionSuccess(null);
    try {
      await deleteClient(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
      setActionSuccess("Cliente eliminado correctamente.");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "No se pudo eliminar el cliente");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <div className="text-slate-500">Cargando clientes…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800">
        {error}
        <p className="mt-1 text-sm">Comprueba que la API esté en marcha en el puerto configurado.</p>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-12 text-center">
        <p className="text-slate-600">No hay clientes registrados.</p>
        {canCreate && (
          <Link href="/clientes/nuevo" className="btn-primary mt-4">
            Crear primer cliente
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
    <div className="space-y-4">
      {actionSuccess && (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100"
          role="status"
        >
          {actionSuccess}
          <button type="button" onClick={() => setActionSuccess(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50 dark:bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                Nombre
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                Tipo
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">
                Email / Teléfono
              </th>
              <th className="relative px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{client.name}</span>
                  {client.taxId && (
                    <span className="ml-2 text-xs text-slate-500">RUT: {client.taxId}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                  {TYPE_LABELS[client.type] ?? client.type}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {[client.email, client.phone].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  {canReadFvStudy && (
                    <Link
                      href={`/estudios-fv?clientId=${encodeURIComponent(client.id)}`}
                      className="btn-secondary mr-2 py-1.5 px-3 text-xs"
                    >
                      Ver estudios FV
                    </Link>
                  )}
                  {canCreateFvStudy && (
                    <Link
                      href={`/estudios-fv/nuevo?clientId=${encodeURIComponent(client.id)}`}
                      className="btn-secondary mr-2 py-1.5 px-3 text-xs"
                    >
                      Nuevo estudio FV
                    </Link>
                  )}
                  {canEdit && (
                    <Link
                      href={`/clientes/${client.id}/editar`}
                      className="btn-secondary mr-2 py-1.5 px-3 text-xs"
                    >
                      Editar
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => setShareClient(client)}
                    className="btn-secondary mr-2 py-1.5 px-3 text-xs"
                  >
                    Compartir
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => handleDelete(client.id)}
                      disabled={deletingId === client.id}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-slate-800 dark:text-red-200 dark:hover:bg-red-900/30"
                    >
                      {deletingId === client.id ? "…" : "Eliminar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
    {shareClient && (
      <ShareEntityToChatModal
        open={!!shareClient}
        onClose={() => setShareClient(null)}
        entityType="CLIENT"
        title={shareClient.name}
        sourceEntityId={shareClient.id}
        snapshot={{
          name: shareClient.name,
          type: shareClient.type,
          taxId: shareClient.taxId ?? null,
          email: shareClient.email ?? null,
          phone: shareClient.phone ?? null,
        }}
        proposedImport={{
          type: shareClient.type,
          name: shareClient.name,
          taxId: shareClient.taxId ?? null,
          email: shareClient.email ?? null,
          phone: shareClient.phone ?? null,
          address: shareClient.address ?? null,
        }}
      />
    )}
    </>
  );
}

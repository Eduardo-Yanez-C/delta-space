"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import { ClienteForm } from "../../ClienteForm";
import { fetchClient, updateClient, type Client } from "../../../../lib/api";

export default function EditarClientePage() {
  const canEdit = useCan("edit", "client");
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [client, setClient] = useState<Client | null>(null);
  useEffect(() => {
    if (!canEdit) router.replace("/acceso-restringido");
  }, [canEdit, router]);
  if (!canEdit) return null;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchClient(id)
      .then((data) => {
        if (!cancelled) setClient(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <div className="text-slate-500">Cargando cliente…</div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error ?? "Cliente no encontrado"}
        </div>
        <Link href="/clientes" className="btn-secondary mt-3 inline-block">
          Volver a clientes
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <ClienteForm
        mode="edit"
        initial={client}
        onSubmit={async (data) => {
          await updateClient(id, data);
          const raw = searchParams.get("returnTo")?.trim() ?? "";
          const safe =
            raw.startsWith("/") && !raw.startsWith("//") ? raw : "/clientes?success=updated";
          router.push(safe);
        }}
      />
    </div>
  );
}

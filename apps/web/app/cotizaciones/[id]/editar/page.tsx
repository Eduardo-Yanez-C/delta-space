"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import { CotizacionForm } from "../../CotizacionForm";
import { fetchQuote, updateQuote, type QuoteDetail } from "../../../../lib/api";

export default function EditarCotizacionPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const canEdit = useCan("edit", "quote");
  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) router.replace("/acceso-restringido");
  }, [canEdit, router]);

  useEffect(() => {
    if (!id || !canEdit) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQuote(id)
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, canEdit]);

  if (!canEdit) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando cotización…</span>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error ?? "Cotización no encontrada"}
        </div>
        <Link href="/cotizaciones" className="btn-secondary mt-3 inline-block">
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100">Editar cotización</h2>
      <CotizacionForm
        mode="edit"
        initial={quote}
        onSubmit={async (data) => {
          await updateQuote(id, data);
          router.push(`/cotizaciones/${id}?success=updated`);
        }}
      />
    </div>
  );
}

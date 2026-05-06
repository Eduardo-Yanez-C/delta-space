"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import { SuccessBanner } from "../../../../components/ui/SuccessBanner";
import {
  fetchQuoteTemplate,
  updateQuoteTemplate,
  type QuoteTemplate,
  type UpdateQuoteTemplateInput,
} from "../../../../lib/api";
import { PlantillaEditarView } from "../PlantillaEditarView";

export default function PlantillaEditarPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const created = searchParams.get("created") === "1";
  const canEdit = useCan("edit", "quote");
  const [template, setTemplate] = useState<QuoteTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusSuccess, setStatusSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !canEdit) {
      router.replace("/acceso-restringido");
      return;
    }
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQuoteTemplate(id)
      .then((data) => { if (!cancelled) setTemplate(data); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar plantilla");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, canEdit, router]);

  const refreshTemplate = () => {
    if (!id) return;
    fetchQuoteTemplate(id)
      .then(setTemplate)
      .catch((e) => setError(e instanceof Error ? e.message : "Error al recargar"));
  };

  const handleDesactivar = () => {
    if (!id || !template) return;
    if (
      !confirm(
        "¿Desactivar esta plantilla?\n\n" +
          "• No aparecerá en el listado ni al crear cotización desde plantilla.\n" +
          "• Podrá reactivarla desde esta misma pantalla.\n\n" +
          "¿Continuar?",
      )
    ) {
      return;
    }
    setStatusSuccess(null);
    setError(null);
    updateQuoteTemplate(id, { active: false })
      .then(() => router.push("/plantillas"))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo desactivar la plantilla"));
  };

  const handleActivar = () => {
    if (!id) return;
    setStatusSuccess(null);
    setError(null);
    updateQuoteTemplate(id, { active: true })
      .then((t) => {
        setTemplate(t);
        setStatusSuccess("Plantilla activada correctamente. Vuelve a aparecer en el listado y al crear cotización desde plantilla.");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo activar la plantilla"));
  };

  if (!canEdit) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando plantilla…</span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error ?? "Plantilla no encontrada"}
        </div>
        <Link href="/plantillas" className="btn-secondary mt-3 inline-block">
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/plantillas/${id}`} className="text-slate-600 hover:text-slate-800 text-sm">
            ← Ver plantilla
          </Link>
          <Link href="/plantillas" className="text-slate-600 hover:text-slate-800 text-sm">
            Listado
          </Link>
        </div>
        {template.active !== false ? (
          <button
            type="button"
            onClick={handleDesactivar}
            className="btn-secondary border-amber-200 text-amber-800 hover:bg-amber-50"
          >
            Desactivar plantilla
          </button>
        ) : (
          <button
            type="button"
            onClick={handleActivar}
            className="btn-secondary border-emerald-200 text-emerald-800 hover:bg-emerald-50"
          >
            Activar plantilla
          </button>
        )}
      </div>
      {created && (
        <SuccessBanner message="Plantilla creada correctamente. Puede editar ítems y líneas a continuación." onDismiss={() => router.replace(`/plantillas/${id}/editar`)} />
      )}
      {statusSuccess && (
        <SuccessBanner message={statusSuccess} onDismiss={() => setStatusSuccess(null)} />
      )}
      {template.active === false && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="status">
          Esta plantilla está desactivada. No aparece en el listado ni al crear cotización desde plantilla. Actívela para volver a usarla.
        </div>
      )}
      <PlantillaEditarView
        template={template}
        onSaveHeader={async (data: UpdateQuoteTemplateInput) => {
          await updateQuoteTemplate(id, data);
          setTemplate((prev) => (prev ? { ...prev, ...data } : null));
        }}
        onRefresh={refreshTemplate}
      />
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../lib/useCan";
import { fetchQuoteTemplate, type QuoteTemplate } from "../../../lib/api";
import { ShareToChatModal } from "../../../components/conversations/ShareToChatModal";

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  ON_GRID: "On Grid",
  OFF_GRID: "Off Grid",
  HYBRID: "Híbrido",
};

const QUOTE_KIND_LABEL: Record<string, string> = {
  STANDARD: "Estándar",
  MARGIN: "Con margen",
};

export default function PlantillaDetallePage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const canRead = useCan("read", "quote");
  const canEdit = useCan("edit", "quote");
  const [template, setTemplate] = useState<QuoteTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (typeof window !== "undefined" && !canRead) {
      router.replace("/acceso-restringido");
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
  }, [id, canRead, router]);

  if (!canRead) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando plantilla…</span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800">
        {error ?? "Plantilla no encontrada"}
        <Link href="/plantillas" className="btn-secondary mt-3 inline-block">
          Volver al listado
        </Link>
      </div>
    );
  }

  const items = template.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/plantillas" className="text-slate-600 hover:text-slate-800 text-sm">
          ← Plantillas
        </Link>
        {canEdit && (
          <Link href={`/plantillas/${template.id}/editar`} className="btn-primary">
            Editar plantilla
          </Link>
        )}
        <button type="button" onClick={() => setShareOpen(true)} className="btn-secondary">
          Compartir
        </button>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{template.name}</h2>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600 mb-4">
          <span>
            <strong>Clase:</strong> {QUOTE_KIND_LABEL[template.quoteKind] ?? QUOTE_KIND_LABEL.STANDARD}
          </span>
          <span>
            <strong>Tipo de sistema:</strong> {SYSTEM_TYPE_LABELS[template.systemType] ?? template.systemType}
          </span>
          <span>
            <strong>Potencia objetivo:</strong> {template.targetPowerKwp ?? "—"} kWp
          </span>
        </div>
        {template.description && (
          <p className="text-sm text-slate-600 mb-4">{template.description}</p>
        )}

        <h3 className="text-base font-medium text-slate-800 mt-6 mb-3">Ítems de la plantilla</h3>
        <div className="space-y-4">
          {items.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-700/40 dark:text-slate-400">
              <p>Esta plantilla no tiene ítems. Edite la plantilla para agregar ítems y líneas base.</p>
              {canEdit && (
                <Link href={`/plantillas/${template.id}/editar`} className="btn-primary mt-3 inline-block">
                  Editar plantilla
                </Link>
              )}
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
                <div className="font-medium text-slate-800">
                  {item.productNameSnapshot || `Ítem ${item.sortOrder + 1}`}
                </div>
                {item.productDescriptionSnapshot && (
                  <p className="text-sm text-slate-600 mt-1">{item.productDescriptionSnapshot}</p>
                )}
                <div className="mt-2 text-xs text-slate-500">
                  Cantidad: {item.quantityRule === "FIXED" ? item.quantityFixed ?? "—" : "Derivada de potencia"}
                  {item.unitPriceDefault != null && ` · Precio ref: ${item.unitPriceDefault}`}
                </div>
                {item.lines && item.lines.length > 0 && (
                  <ul className="mt-3 ml-4 list-disc text-sm text-slate-600 space-y-1">
                    {item.lines.map((line) => (
                      <li key={line.id}>
                        {line.productNameSnapshot ?? line.product?.name ?? "Línea"}
                        {line.source === "FROM_CATALOG" && (
                          <span className="ml-1 text-xs text-slate-500">(catálogo)</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <ShareToChatModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        entityType="QUOTE_TEMPLATE"
        title={template.name}
        sourceEntityId={template.id}
        snapshot={{
          id: template.id,
          name: template.name,
          quoteKind: template.quoteKind,
          systemType: template.systemType,
          targetPowerKwp: template.targetPowerKwp ?? null,
          itemsCount: items.length,
        }}
        proposedImport={{
          templateId: template.id,
          mode: "REFERENCE_ONLY",
        }}
      />
    </div>
  );
}

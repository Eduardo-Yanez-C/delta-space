"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../lib/useCan";
import { fetchQuoteTemplates, type QuoteTemplate } from "../../lib/api";

const SYSTEM_TYPE_LABELS: Record<string, string> = {
  ON_GRID: "On Grid",
  OFF_GRID: "Off Grid",
  HYBRID: "Híbrido",
};

type TemplateTab = "STANDARD" | "MARGIN";

function templateKind(t: QuoteTemplate): TemplateTab {
  return t.quoteKind === "MARGIN" ? "MARGIN" : "STANDARD";
}

export default function PlantillasPage() {
  const router = useRouter();
  const canRead = useCan("read", "quote");
  const canEdit = useCan("edit", "quote");
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TemplateTab>("STANDARD");

  useEffect(() => {
    if (typeof window !== "undefined" && !canRead) {
      router.replace("/acceso-restringido");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchQuoteTemplates()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar plantillas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead, router]);

  const filtered = useMemo(
    () => templates.filter((t) => templateKind(t) === tab),
    [templates, tab],
  );

  if (!canRead) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando plantillas…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
        {error}
        <Link href="/" className="btn-secondary mt-3 inline-block">
          Volver al inicio
        </Link>
      </div>
    );
  }

  const tabCopy =
    tab === "STANDARD"
      ? {
          subtitle: "Plantillas estándar para cotizaciones rápidas",
          description:
            "Definen ítems y líneas base para cotizaciones convencionales. Desde aquí puede crear cotizaciones estándar desde plantilla cuando lo necesite.",
          newHref: "/plantillas/nueva?quoteKind=STANDARD",
          newLabel: "Nueva plantilla estándar",
          emptyHint: "Cree una plantilla estándar para reutilizarla al armar cotizaciones.",
        }
      : {
          subtitle: "Plantillas con margen para gestión comercial",
          description:
            "Clasifique aquí las plantillas pensadas para el flujo con margen (MARGIN). Aún no se pueden usar para “crear cotización desde plantilla”; sirven para organizar y editar la base de ítems por separado.",
          newHref: "/plantillas/nueva?quoteKind=MARGIN",
          newLabel: "Nueva plantilla con margen",
          emptyHint: "Cree una plantilla con margen para mantenerla separada de las estándar.",
        };

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-600 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setTab("STANDARD")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "STANDARD"
              ? "bg-white text-slate-900 shadow dark:bg-slate-800 dark:text-slate-100"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Estándar
        </button>
        <button
          type="button"
          onClick={() => setTab("MARGIN")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "MARGIN"
              ? "bg-violet-100 text-violet-900 shadow dark:bg-violet-900/50 dark:text-violet-100"
              : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Con margen
        </button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{tabCopy.subtitle}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">{tabCopy.description}</p>
        </div>
        {canEdit && (
          <Link href={tabCopy.newHref} className={tab === "MARGIN" ? "btn-primary bg-violet-600 hover:bg-violet-700" : "btn-primary"}>
            {tabCopy.newLabel}
          </Link>
        )}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Nombre</th>
              <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Tipo</th>
              <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Potencia (kWp)</th>
              <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Ítems</th>
              <th className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500 dark:text-slate-300">
                  <p>No hay plantillas en esta categoría.</p>
                  <p className="mt-1 text-sm">{tabCopy.emptyHint}</p>
                  {canEdit && (
                    <Link href={tabCopy.newHref} className="btn-primary mt-3 inline-block">
                      {tabCopy.newLabel}
                    </Link>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{t.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {SYSTEM_TYPE_LABELS[t.systemType] ?? t.systemType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.targetPowerKwp ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{t.items?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Link href={`/plantillas/${t.id}`} className="font-medium text-amber-600 hover:text-amber-700">
                        Ver
                      </Link>
                      {canEdit && (
                        <Link href={`/plantillas/${t.id}/editar`} className="font-medium text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-100">
                          Editar
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {tab === "STANDARD" && (
        <div className="text-sm text-slate-500 dark:text-slate-300">
          <Link href="/cotizaciones/desde-plantilla" className="text-amber-600 hover:underline dark:text-amber-300">
            Crear cotización desde plantilla estándar →
          </Link>
        </div>
      )}
    </div>
  );
}

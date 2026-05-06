"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../lib/useCan";
import {
  fetchClients,
  fetchQuoteTemplates,
  createQuoteFromTemplate,
  type Client,
  type QuoteTemplate,
} from "../../../lib/api";

const CURRENCY_OPTIONS = [
  { value: "CLP", label: "CLP" },
  { value: "USD", label: "USD" },
];

const SYSTEM_TYPE_OPTIONS: { value: "ON_GRID" | "OFF_GRID" | "HYBRID"; label: string }[] = [
  { value: "ON_GRID", label: "On Grid" },
  { value: "OFF_GRID", label: "Off Grid" },
  { value: "HYBRID", label: "Híbrido" },
];

function DesdePlantillaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fvStudyId = searchParams.get("fvStudyId")?.trim() ?? "";
  const clientIdFromUrl = searchParams.get("clientId")?.trim() ?? "";
  const currencyFromUrl = searchParams.get("currency")?.trim() ?? "";

  const canCreate = useCan("create", "quote");
  const [clients, setClients] = useState<Client[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [systemType, setSystemType] = useState<"" | "ON_GRID" | "OFF_GRID" | "HYBRID">("");
  const [templateId, setTemplateId] = useState("");
  const [clientId, setClientId] = useState("");
  const [currency, setCurrency] = useState("CLP");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templatesFiltered =
    systemType === "" ? [] : templates.filter((t) => t.systemType === systemType);

  useEffect(() => {
    if (!canCreate) {
      router.replace("/acceso-restringido");
      return;
    }
    let cancelled = false;
    Promise.all([fetchClients(), fetchQuoteTemplates("STANDARD")])
      .then(([c, t]) => {
        if (!cancelled) {
          setClients(c);
          setTemplates(t);
          if (c.length > 0) setClientId((prev) => (prev ? prev : c[0].id));
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canCreate, router]);

  useEffect(() => {
    if (currencyFromUrl !== "CLP" && currencyFromUrl !== "USD") return;
    setCurrency(currencyFromUrl);
  }, [currencyFromUrl]);

  useEffect(() => {
    if (!clientIdFromUrl || clients.length === 0) return;
    const ok = clients.some((c) => c.id === clientIdFromUrl);
    if (ok) setClientId(clientIdFromUrl);
  }, [clientIdFromUrl, clients]);

  useEffect(() => {
    setTemplateId("");
  }, [systemType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemType) {
      setError("Seleccione el tipo de sistema.");
      return;
    }
    if (!templateId || !clientId) {
      setError("Seleccione plantilla y cliente.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const result = await createQuoteFromTemplate(templateId, {
        clientId,
        currency: currency || undefined,
        title: title.trim() || undefined,
        ...(fvStudyId ? { fvStudyId } : {}),
      });
      router.push(`/cotizaciones/${result.quote.id}?versionId=${result.version.id}&success=created`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cotización");
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando…</span>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100">Crear cotización desde plantilla</h2>
      <p className="mb-6 text-sm text-slate-600">
        Elija el tipo de sistema y luego la plantilla. Se generará una cotización con ítems base según la plantilla. Podrá editar cantidades y precios después.
      </p>
      {fvStudyId && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          Esta cotización quedará <strong>vinculada al estudio FV</strong> desde el que llegó. El cliente se ha preseleccionado cuando corresponde.
        </div>
      )}
      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="systemType" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tipo de sistema *
          </label>
          <select
            id="systemType"
            value={systemType}
            onChange={(e) => setSystemType(e.target.value as "" | "ON_GRID" | "OFF_GRID" | "HYBRID")}
            className="input-field"
            required
          >
            <option value="">Seleccione tipo de sistema</option>
            {SYSTEM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="templateId" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Plantilla *
          </label>
          <select
            id="templateId"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="input-field"
            required
            disabled={!systemType}
          >
            <option value="">
              {!systemType
                ? "Seleccione primero el tipo de sistema"
                : templatesFiltered.length === 0
                  ? "No hay plantillas para este tipo"
                  : "Seleccione plantilla"}
            </option>
            {templatesFiltered.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {systemType && templatesFiltered.length === 0 && (
            <p className="mt-1 text-sm text-amber-700">
              No hay plantillas para este tipo. Cree una en{" "}
              <Link href="/plantillas" className="underline">
                Plantillas
              </Link>
              .
            </p>
          )}
        </div>
        <div>
          <label htmlFor="clientId" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Cliente *
          </label>
          <select
            id="clientId"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input-field"
            required
          >
            <option value="">Seleccione cliente</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clients.length === 0 && (
            <p className="mt-1 text-sm text-slate-600">
              Aún no hay clientes. <Link href="/clientes/nuevo" className="text-amber-600 underline hover:no-underline">Cree uno en Clientes</Link>.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="currency" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Moneda
          </label>
          <select
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="input-field"
          >
            {CURRENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="title" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Título (opcional)
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Cotización 4 kW - Cliente X"
            className="input-field"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving || !systemType || !templateId || !clientId}
            className="btn-primary"
          >
            {saving ? "Creando…" : "Crear cotización"}
          </button>
          <Link href="/cotizaciones" className="btn-secondary">
            Volver
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function DesdePlantillaPage() {
  return (
    <Suspense
      fallback={
        <div className="card flex items-center justify-center p-12">
          <span className="text-slate-500">Cargando…</span>
        </div>
      }
    >
      <DesdePlantillaContent />
    </Suspense>
  );
}

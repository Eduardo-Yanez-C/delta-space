"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../lib/useCan";
import { createQuoteTemplate, type CreateQuoteTemplateInput } from "../../../lib/api";

const SYSTEM_TYPE_OPTIONS: { value: "ON_GRID" | "OFF_GRID" | "HYBRID"; label: string }[] = [
  { value: "ON_GRID", label: "On Grid" },
  { value: "OFF_GRID", label: "Off Grid" },
  { value: "HYBRID", label: "Híbrido" },
];

const DEFAULT_POWER: Record<string, number> = {
  ON_GRID: 4,
  OFF_GRID: 6,
  HYBRID: 5,
};

function parseQuoteKindParam(raw: string | null): "STANDARD" | "MARGIN" {
  const q = raw?.trim().toUpperCase();
  if (q === "MARGIN") return "MARGIN";
  return "STANDARD";
}

function PlantillaNuevaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteKind = parseQuoteKindParam(searchParams.get("quoteKind"));
  const canEdit = useCan("edit", "quote");
  const [name, setName] = useState("");
  const [systemType, setSystemType] = useState<"ON_GRID" | "OFF_GRID" | "HYBRID">("ON_GRID");
  const [targetPowerKwp, setTargetPowerKwp] = useState<number>(4);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMargin = quoteKind === "MARGIN";
  const title = isMargin ? "Nueva plantilla con margen" : "Nueva plantilla estándar";
  const intro = isMargin
    ? "Se creará una plantilla clasificada como con margen, con los mismos ítems base por tipo de sistema. Podrá editar ítems y líneas después. Crear cotización desde esta plantilla no está disponible todavía."
    : "Se creará una plantilla estándar con ítems base según el tipo de sistema. Podrá editar ítems y líneas después.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("El nombre es obligatorio.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body: CreateQuoteTemplateInput = {
        name: trimmedName,
        quoteKind,
        systemType,
        targetPowerKwp: targetPowerKwp || undefined,
        description: description.trim() || undefined,
      };
      const template = await createQuoteTemplate(body);
      router.push(`/plantillas/${template.id}/editar?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear plantilla");
    } finally {
      setSaving(false);
    }
  };

  const handleSystemTypeChange = (value: "ON_GRID" | "OFF_GRID" | "HYBRID") => {
    setSystemType(value);
    setTargetPowerKwp(DEFAULT_POWER[value] ?? 4);
  };

  if (typeof window !== "undefined" && !canEdit) {
    router.replace("/acceso-restringido");
    return null;
  }

  return (
    <div className={`card p-6 max-w-lg ${isMargin ? "border-violet-200 dark:border-violet-800" : ""}`}>
      <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">{intro}</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Nombre *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: 4 kW OnGrid estándar"
            className="input-field"
            required
          />
        </div>
        <div>
          <label htmlFor="systemType" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tipo de sistema *
          </label>
          <select
            id="systemType"
            value={systemType}
            onChange={(e) => handleSystemTypeChange(e.target.value as "ON_GRID" | "OFF_GRID" | "HYBRID")}
            className="input-field"
            required
          >
            {SYSTEM_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="targetPowerKwp" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Potencia objetivo (kWp)
          </label>
          <input
            id="targetPowerKwp"
            type="number"
            min={1}
            step={0.5}
            value={targetPowerKwp || ""}
            onChange={(e) => setTargetPowerKwp(e.target.value === "" ? 0 : Number(e.target.value))}
            className="input-field"
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Descripción (opcional)
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="input-field"
            placeholder="Descripción breve de la plantilla"
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button type="submit" disabled={saving} className={isMargin ? "btn-primary bg-violet-600 hover:bg-violet-700" : "btn-primary"}>
            {saving ? "Creando…" : "Crear plantilla"}
          </button>
          <Link href="/plantillas" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function PlantillaNuevaPage() {
  return (
    <Suspense
      fallback={
        <div className="card flex max-w-lg items-center justify-center p-12">
          <span className="text-slate-500">Cargando…</span>
        </div>
      }
    >
      <PlantillaNuevaForm />
    </Suspense>
  );
}

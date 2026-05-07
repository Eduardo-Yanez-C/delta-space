"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createCompany } from "../../../lib/api";
import { useCan } from "../../../lib/useCan";

function normalizeSlugPreview(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return s
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export default function NuevaEmpresaPage() {
  const canAccess = useCan("access", "companies");
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slugPreview = useMemo(() => normalizeSlugPreview(slug), [slug]);

  if (!canAccess) {
    return (
      <div className="card p-6">
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          No tiene permisos para crear empresas.
        </div>
        <Link href="/empresas" className="btn-secondary mt-3 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-6 max-w-xl">
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">Nueva empresa</h2>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error}
        </div>
      )}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          const n = name.trim();
          const s = normalizeSlugPreview(slug);
          if (!n) return setError("El nombre es obligatorio.");
          if (!s) return setError("El slug es obligatorio.");
          setSaving(true);
          try {
            const c = await createCompany({ name: n, slug: s, active });
            router.push(`/empresas/${encodeURIComponent(c.id)}/editar?success=created`);
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : "Error al crear");
          } finally {
            setSaving(false);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" required />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200">Slug *</label>
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className="input-field" required />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Se normaliza a: <span className="font-mono">{slugPreview || "—"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-amber-600"
            id="active-company"
          />
          <label htmlFor="active-company" className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Empresa activa
          </label>
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Creando…" : "Crear empresa"}
          </button>
          <Link href="/empresas" className="btn-secondary">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}


"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { fetchCompany, updateCompany, type Company } from "../../../../lib/api";
import { useCan } from "../../../../lib/useCan";
import { SuccessBanner } from "../../../../components/ui/SuccessBanner";

function normalizeSlugPreview(raw: string): string {
  const s = String(raw ?? "").trim().toLowerCase();
  return s
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export default function EditarEmpresaPage() {
  const canAccess = useCan("access", "companies");
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const success = sp.get("success");
  const id = typeof params.id === "string" ? params.id : "";

  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [active, setActive] = useState(true);

  const slugPreview = useMemo(() => normalizeSlugPreview(slug), [slug]);

  useEffect(() => {
    if (!canAccess || !id) return;
    setLoading(true);
    setError(null);
    fetchCompany(id)
      .then((c) => {
        setCompany(c);
        setName(c.name ?? "");
        setSlug(c.slug ?? "");
        setActive(!!c.active);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, [canAccess, id]);

  if (!canAccess) {
    return (
      <div className="card p-6">
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          role="alert"
        >
          No tiene permisos para editar empresas.
        </div>
      </div>
    );
  }

  if (loading && !company) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500 dark:text-slate-400">Cargando empresa…</span>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200" role="alert">
          {error ?? "Empresa no encontrada"}
        </div>
        <Link href="/empresas" className="btn-secondary mt-3 inline-block">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success === "created" && (
        <SuccessBanner message="Empresa creada correctamente." dismissHref={`/empresas/${encodeURIComponent(id)}/editar`} />
      )}
      <div className="card p-6 max-w-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Editar empresa</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">{company.id}</p>
          </div>
          <Link href="/empresas" className="btn-secondary">
            Volver
          </Link>
        </div>

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
              const next = await updateCompany(id, { name: n, slug: s, active });
              setCompany(next);
              router.replace(`/empresas/${encodeURIComponent(id)}/editar`);
            } catch (e2) {
              setError(e2 instanceof Error ? e2.message : "Error al guardar");
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
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


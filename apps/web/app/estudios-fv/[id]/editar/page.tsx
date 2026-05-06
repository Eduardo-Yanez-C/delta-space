"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import { fetchFvStudy, fetchImplantationDesign, updateFvStudy, type FvStudy, type ImplantationDesign, type UpdateFvStudyInput } from "../../../../lib/api";
import { EstudioFvForm } from "../../EstudioFvForm";

export default function EditarEstudioFvPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const canEdit = useCan("edit", "fvStudy");
  const [study, setStudy] = useState<FvStudy | null>(null);
  const [implantationDesign, setImplantationDesign] = useState<ImplantationDesign | null | undefined>(undefined);
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
    setImplantationDesign(undefined);
    Promise.all([fetchFvStudy(id), fetchImplantationDesign(id)])
      .then(([studyData, designData]) => {
        if (!cancelled) {
          setStudy(studyData);
          setImplantationDesign(designData ?? null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, canEdit]);

  if (!canEdit) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando estudio…</span>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="card p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error ?? "Estudio no encontrado"}
        </div>
        <Link href="/estudios-fv" className="btn-secondary mt-3 inline-block">
          Volver al listado
        </Link>
      </div>
    );
  }

  if (study.status === "ARCHIVADO") {
    return (
      <div className="card border-slate-200 p-4 dark:border-slate-700">
        <p className="text-slate-700 dark:text-slate-300">Este estudio está archivado y no puede editarse.</p>
        <Link href={`/estudios-fv/${id}`} className="btn-secondary mt-3 inline-block">
          Ver detalle
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <EstudioFvForm
        mode="edit"
        initial={study}
        initialDesign={implantationDesign ?? undefined}
        onSubmit={async (data: UpdateFvStudyInput) => {
          await updateFvStudy(id, data);
          router.push(`/estudios-fv/${id}?success=updated`);
        }}
      />
    </div>
  );
}

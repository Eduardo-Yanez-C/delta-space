"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../lib/useCan";
import { fetchFvStudy, type FvStudy } from "../../../lib/api";
import { EstudioFvDetalleView } from "./EstudioFvDetalleView";
import { SuccessBanner } from "../../../components/ui/SuccessBanner";

export default function EstudioFvDetallePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const canRead = useCan("read", "fvStudy");
  const [study, setStudy] = useState<FvStudy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const successParam = searchParams?.get("success");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFvStudy(id)
      .then((data) => { if (!cancelled) setStudy(data); })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error al cargar");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (!canRead) return null;

  if (loading) {
    return (
      <div className="card flex items-center justify-center p-12">
        <span className="text-slate-500">Cargando estudio…</span>
      </div>
    );
  }

  if (error || !study) {
    return (
      <div className="card border-amber-200 bg-amber-50 p-4 text-amber-800">
        {error ?? "Estudio no encontrado"}
        <Link href="/estudios-fv" className="btn-secondary mt-3 inline-block">
          Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {successParam === "created" && (
        <SuccessBanner message="Estudio FV creado correctamente." dismissHref={`/estudios-fv/${id}`} />
      )}
      {successParam === "updated" && (
        <SuccessBanner message="Estudio FV actualizado correctamente." dismissHref={`/estudios-fv/${id}`} />
      )}
      <EstudioFvDetalleView
        study={study}
        onArchived={() => setStudy((prev) => prev ? { ...prev, status: "ARCHIVADO" } : null)}
      />
    </div>
  );
}

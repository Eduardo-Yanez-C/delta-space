"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { fetchQuote, fetchQuoteVersion, createQuoteVersion, type QuoteDetail, type QuoteVersionDetail } from "../../../lib/api";
import { SuccessBanner } from "../../../components/ui/SuccessBanner";
import { CotizacionDetalleView } from "./CotizacionDetalleView";

export default function DetalleCotizacionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const versionIdFromUrl = searchParams.get("versionId");
  const success = searchParams.get("success");

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [versionDetail, setVersionDetail] = useState<QuoteVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  // Cargar cotización
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuote(null);
    setVersionDetail(null);
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
  }, [id]);

  // Sincronizar URL: si hay quote y no hay versionId en URL, redirigir a la versión actual
  useEffect(() => {
    if (!quote || versionIdFromUrl !== null) return;
    const currentId = quote.currentVersion?.id;
    if (currentId) {
      const url = `/cotizaciones/${id}?versionId=${currentId}`;
      router.replace(url, { scroll: false });
    }
  }, [quote, id, versionIdFromUrl, router]);

  // Cargar detalle de la versión cuando versionId está en la URL
  useEffect(() => {
    if (!id || !versionIdFromUrl || !quote) {
      setVersionDetail(null);
      return;
    }
    const belongs = quote.versions?.some((v) => v.id === versionIdFromUrl);
    if (!belongs) {
      setVersionDetail(null);
      return;
    }
    let cancelled = false;
    fetchQuoteVersion(id, versionIdFromUrl)
      .then((data) => {
        if (!cancelled) setVersionDetail(data);
      })
      .catch(() => {
        if (!cancelled) setVersionDetail(null);
      });
    return () => { cancelled = true; };
  }, [id, versionIdFromUrl, quote]);

  const handleSelectVersion = (versionId: string) => {
    router.replace(`/cotizaciones/${id}?versionId=${versionId}`, { scroll: false });
  };

  const handleRefreshVersion = () => {
    if (!id || !versionIdFromUrl) return;
    fetchQuoteVersion(id, versionIdFromUrl)
      .then(setVersionDetail)
      .catch(() => {});
  };

  const handleQuoteRefresh = useCallback(async () => {
    if (!id) return;
    const q = await fetchQuote(id);
    setQuote(q);
  }, [id]);

  const createVersion = (sourceVersionId?: string) => {
    if (!id) return;
    setCreateError(null);
    const body = sourceVersionId ? { sourceVersionId } : undefined;
    createQuoteVersion(id, body)
      .then((created) => {
        setVersionDetail(created);
        router.replace(`/cotizaciones/${id}?versionId=${created.id}`, { scroll: false });
        return fetchQuote(id);
      })
      .then((updated) => {
        if (updated) setQuote(updated);
        setCreateError(null);
      })
      .catch((e) => setCreateError(e instanceof Error ? e.message : "Error al crear versión"));
  };

  const handleCreateVersion = () => createVersion();
  const handleDuplicateCurrentVersion = () => {
    const currentId = quote?.currentVersion?.id;
    if (currentId) createVersion(currentId);
  };

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

  const isCurrentVersion = quote.currentVersion?.id === versionIdFromUrl;

  const detailBaseUrl = `/cotizaciones/${id}${versionIdFromUrl ? `?versionId=${versionIdFromUrl}` : ""}`;

  return (
    <>
      {success === "created" && (
        <SuccessBanner message="Cotización creada correctamente." dismissHref={detailBaseUrl} />
      )}
      {success === "updated" && (
        <SuccessBanner message="Cotización actualizada correctamente." dismissHref={detailBaseUrl} />
      )}
      {createError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {createError}
          <button type="button" onClick={() => setCreateError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}
      <CotizacionDetalleView
      quote={quote}
      versionDetail={versionDetail}
      versionId={versionIdFromUrl}
      isCurrentVersion={!!versionIdFromUrl && isCurrentVersion}
      onSelectVersion={handleSelectVersion}
      onRefreshVersion={handleRefreshVersion}
      onQuoteRefresh={handleQuoteRefresh}
      onCreateVersion={handleCreateVersion}
      onDuplicateCurrentVersion={handleDuplicateCurrentVersion}
    />
    </>
  );
}

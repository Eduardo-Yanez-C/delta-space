"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCan } from "../../../../lib/useCan";
import {
  fetchQuote,
  fetchQuoteVersion,
  fetchFvCalculation,
  fetchFvStudy,
  fetchImplantationDesign,
  fetchImplantationScreenshotBlob,
  fetchCompanyProfileForDocument,
  fetchCompanyLogoForDocumentBlob,
  type QuoteDetail,
  type QuoteVersionDetail,
  type FvStudy,
  type FvStudyMonth,
  type FvSnapshotData,
  type ImplantationDesign,
  type CompanyProfile,
} from "../../../../lib/api";
import { CotizacionVistaPrevia } from "../CotizacionVistaPrevia";
import type { FvSummaryFromStudy } from "../../constants";

export default function VistaPreviaCotizacionPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const canReadQuote = useCan("read", "quote");
  const id = typeof params.id === "string" ? params.id : "";
  const versionId = searchParams.get("versionId");

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [version, setVersion] = useState<QuoteVersionDetail | null>(null);
  const [fvCalculation, setFvCalculation] = useState<Awaited<ReturnType<typeof fetchFvCalculation>>>(null);
  const [fvStudy, setFvStudy] = useState<FvStudy | null>(null);
  const [fvSummaryFromStudy, setFvSummaryFromStudy] = useState<FvSummaryFromStudy | null>(null);
  const [fvStudyMonths, setFvStudyMonths] = useState<FvStudyMonth[] | null>(null);
  const [implantationDesign, setImplantationDesign] = useState<ImplantationDesign | null>(null);
  const [implantationScreenshotUrl, setImplantationScreenshotUrl] = useState<string | null>(null);
  const [implantationSummary, setImplantationSummary] = useState<FvSnapshotData["implantationSummary"] | null>(null);
  const screenshotUrlRef = useRef<string | null>(null);
  const companyLogoUrlRef = useRef<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [companyLogoObjectUrl, setCompanyLogoObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [printBusy, setPrintBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printSuccess, setPrintSuccess] = useState<string | null>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canReadQuote) {
      router.replace("/acceso-restringido");
      return;
    }
  }, [canReadQuote, router]);

  useEffect(() => {
    if (!shareOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shareOpen]);

  useEffect(() => {
    if (!canReadQuote || !id || !versionId) {
      setLoading(false);
      if (id && !versionId) setError("Falta el identificador de versión.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFvCalculation(null);
    setFvSummaryFromStudy(null);
    setFvStudyMonths(null);
    setFvStudy(null);
    setImplantationDesign(null);
    setImplantationScreenshotUrl(null);
    setImplantationSummary(null);
    setCompanyProfile(null);
    if (companyLogoUrlRef.current) {
      URL.revokeObjectURL(companyLogoUrlRef.current);
      companyLogoUrlRef.current = null;
    }
    setCompanyLogoObjectUrl(null);
    Promise.all([fetchQuote(id), fetchQuoteVersion(id, versionId)])
      .then(([q, v]) => {
        if (!cancelled) {
          setQuote(q);
          setVersion(v);
        }
        void (async () => {
          try {
            const cp = await fetchCompanyProfileForDocument();
            if (cancelled) return;
            setCompanyProfile(cp);
            if (cp.hasLogo) {
              const blob = await fetchCompanyLogoForDocumentBlob();
              if (cancelled || !blob) return;
              const url = URL.createObjectURL(blob);
              if (companyLogoUrlRef.current) URL.revokeObjectURL(companyLogoUrlRef.current);
              companyLogoUrlRef.current = url;
              setCompanyLogoObjectUrl(url);
            } else {
              if (companyLogoUrlRef.current) URL.revokeObjectURL(companyLogoUrlRef.current);
              companyLogoUrlRef.current = null;
              setCompanyLogoObjectUrl(null);
            }
          } catch {
            if (!cancelled) {
              setCompanyProfile(null);
              if (companyLogoUrlRef.current) URL.revokeObjectURL(companyLogoUrlRef.current);
              companyLogoUrlRef.current = null;
              setCompanyLogoObjectUrl(null);
            }
          }
        })();
        const useFvSnapshot =
          q.sourceFvStudyId &&
          v.status !== "BORRADOR" &&
          v.fvSnapshot != null &&
          v.fvSnapshot.trim() !== "";
        if (useFvSnapshot) {
          try {
            const snapshot = JSON.parse(v.fvSnapshot!) as FvSnapshotData;
            if (!cancelled) {
              setFvStudy(snapshot.studyForReport);
              setFvSummaryFromStudy(snapshot.summary);
              setFvStudyMonths(snapshot.months);
              setImplantationSummary(snapshot.implantationSummary);
            }
          } catch {
            if (!cancelled) setImplantationSummary(null);
          }
          return;
        }
        if (q.sourceFvStudyId) {
          return fetchFvStudy(q.sourceFvStudyId)
            .then((study) => {
              if (!cancelled) {
                setFvStudy(study);
                setFvSummaryFromStudy({
                  plantaKwp: study.potenciaSistemaKwp,
                  cantidadPaneles: study.cantidadPaneles,
                  generacionAnualKwh: study.generacionAnualKwh,
                  ahorroAnual: study.ahorroAnual,
                  porcentajeAhorro: study.porcentajeAhorro,
                  pagoResidualAnual: study.pagoResidualAnual,
                  currency: study.currency ?? "USD",
                  sourceTitle: study.title,
                });
                setFvStudyMonths(study.months ?? []);
              }
              if (!cancelled && study?.id) {
                return fetchImplantationDesign(study.id)
                  .then((design) => {
                    if (!cancelled) setImplantationDesign(design ?? null);
                    if (!cancelled && design?.screenshotUrl) {
                      return fetchImplantationScreenshotBlob(study.id).then((blob) => {
                        if (!cancelled && blob) {
                          const url = URL.createObjectURL(blob);
                          if (screenshotUrlRef.current) URL.revokeObjectURL(screenshotUrlRef.current);
                          screenshotUrlRef.current = url;
                          setImplantationScreenshotUrl(url);
                        }
                      });
                    }
                  })
                  .catch(() => {
                    if (!cancelled) setImplantationDesign(null);
                  });
              }
            })
            .catch(() => {
              if (!cancelled) {
                setFvSummaryFromStudy(null);
                setFvStudyMonths(null);
                setFvStudy(null);
                setImplantationDesign(null);
                setImplantationScreenshotUrl(null);
              }
            });
        }
        if (!q.sourceFvStudyId) {
          return fetchFvCalculation(id, versionId)
            .then((fv) => {
              if (!cancelled) setFvCalculation(fv ?? null);
            })
            .catch(() => {
              if (!cancelled) setFvCalculation(null);
            });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Error al cargar");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      if (screenshotUrlRef.current) {
        URL.revokeObjectURL(screenshotUrlRef.current);
        screenshotUrlRef.current = null;
      }
      if (companyLogoUrlRef.current) {
        URL.revokeObjectURL(companyLogoUrlRef.current);
        companyLogoUrlRef.current = null;
      }
    };
  }, [canReadQuote, id, versionId]);

  const handlePrint = async () => {
    setPrintError(null);
    setPrintSuccess(null);
    const desktop =
      typeof window !== "undefined"
        ? (window as unknown as { __DESKTOP__?: { print?: () => Promise<{ ok: boolean; message?: string }> } })
            .__DESKTOP__
        : undefined;
    if (desktop?.print) {
      setPrintBusy(true);
      try {
        const res = await desktop.print();
        if (!res?.ok) {
          setPrintError(res?.message || "No se pudo abrir la impresión.");
          return;
        }
        return;
      } catch (e) {
        setPrintError(e instanceof Error ? e.message : "Error al imprimir.");
        return;
      } finally {
        setPrintBusy(false);
      }
    }
    window.print();
  };

  const handleExportPdf = async () => {
    setPrintError(null);
    setPrintSuccess(null);
    const desktop =
      typeof window !== "undefined"
        ? (window as unknown as {
            __DESKTOP__?: {
              exportPdf?: (args?: { defaultFilename?: string }) => Promise<{
                ok: boolean;
                canceled?: boolean;
                message?: string;
                filePath?: string;
              }>;
            };
          }).__DESKTOP__
        : undefined;
    if (desktop?.exportPdf) {
      setPdfBusy(true);
      try {
        const safeName = quote?.commercialNumber
          ? `cotizacion-${quote.commercialNumber}`.replace(/[^\w\-]+/g, "-")
          : "cotizacion";
        const res = await desktop.exportPdf({ defaultFilename: `${safeName}.pdf` });
        if (res?.canceled) return;
        if (!res?.ok) {
          setPrintError(res?.message || "No se pudo exportar el PDF.");
          return;
        }
        setPrintSuccess("PDF guardado correctamente.");
        return;
      } catch (e) {
        setPrintError(e instanceof Error ? e.message : "Error al exportar PDF.");
        return;
      } finally {
        setPdfBusy(false);
      }
    }
    window.print();
  };

  const shareUrl =
    typeof window !== "undefined"
      ? window.location.href
      : `${id ? `/cotizaciones/${id}/vista-previa` : "/cotizaciones"}`;
  const shareTitle = quote?.commercialNumber
    ? `Cotización ${quote.commercialNumber}`
    : `Cotización ${quote?.title ?? ""}`.trim() || "Cotización";
  const shareText =
    quote?.client?.name
      ? `${shareTitle} para ${quote.client.name}.`
      : `${shareTitle}.`;

  const handleShareNative = async () => {
    setShareError(null);
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setShareError("Compartir nativo no disponible en este navegador/dispositivo.");
      return;
    }
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
      setShareOpen(false);
    } catch {
      // Cancelación del usuario o error del SO/navegador; evitamos ruido UX.
    }
  };

  const handleShareEmail = () => {
    const recipient = quote?.client?.email?.trim() || "";
    const subject = encodeURIComponent(`${shareTitle} - ${quote?.title ?? ""}`.trim());
    const body = encodeURIComponent(
      `${shareText}\n\nPuede revisar la vista previa aquí:\n${shareUrl}`,
    );
    window.open(`mailto:${recipient}?subject=${subject}&body=${body}`, "_blank");
    setShareOpen(false);
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(`${shareText}\n${shareUrl}`);
    window.open(`https://wa.me/?text=${message}`, "_blank");
    setShareOpen(false);
  };

  const isHistoricalVersion =
    !!quote?.currentVersion &&
    !!version &&
    quote.currentVersion.id !== version.id;

  const fvSourceLabel =
    quote?.sourceFvStudyId && version
      ? version.status !== "BORRADOR" &&
        version.fvSnapshot != null &&
        String(version.fvSnapshot).trim() !== ""
        ? "snapshot"
        : version.status !== "BORRADOR"
          ? "compatibility"
          : "live"
      : undefined;

  if (!canReadQuote) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-slate-500">Cargando vista previa…</p>
      </div>
    );
  }

  if (error || !quote || !version) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p>{error ?? "Cotización o versión no encontrada"}</p>
        <Link
          href={id ? `/cotizaciones/${id}` : "/cotizaciones"}
          className="btn-secondary mt-4 inline-block"
        >
          Volver
        </Link>
      </div>
    );
  }

  const canUseNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";

  return (
    <div className="vista-previa-page">
      <div className="no-print sticky top-16 z-20 mb-4 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-700 dark:bg-slate-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Vista previa de la cotización</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Use Imprimir o Exportar PDF para guardar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={handlePrint} className="btn-primary" disabled={printBusy || pdfBusy}>
              {printBusy ? "Abriendo impresión…" : "Imprimir"}
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="btn-secondary"
              disabled={printBusy || pdfBusy}
            >
              {pdfBusy ? "Exportando PDF…" : "Exportar PDF"}
            </button>
            <div className="relative" ref={shareMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setShareError(null);
                  setShareOpen((v) => !v);
                }}
                className="btn-secondary"
              >
                Enviar
              </button>
              {shareOpen && (
                <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={handleShareEmail}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Enviar por correo
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Enviar por WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleShareNative}
                    disabled={!canUseNativeShare}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Compartir {canUseNativeShare ? "(dispositivo)" : "(no disponible)"}
                  </button>
                </div>
              )}
            </div>
            <Link
              href={`/cotizaciones/${id}?versionId=${versionId}`}
              className="btn-secondary"
            >
              Volver al detalle
            </Link>
          </div>
        </div>
        {shareError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{shareError}</p>
        )}
        {printError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{printError}</p>
        )}
        {printSuccess && (
          <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">{printSuccess}</p>
        )}
      </div>

      <CotizacionVistaPrevia
        quote={quote}
        version={version}
        isHistoricalVersion={isHistoricalVersion}
        fvSourceLabel={fvSourceLabel}
        fvCalculation={fvSummaryFromStudy ? null : fvCalculation}
        fvSummaryFromStudy={fvSummaryFromStudy}
        fvStudyMonths={fvStudyMonths}
        fvStudy={fvStudy}
        implantationDesign={implantationDesign}
        implantationScreenshotUrl={implantationScreenshotUrl}
        implantationSummary={implantationSummary ?? undefined}
        companyProfile={companyProfile}
        companyLogoObjectUrl={companyLogoObjectUrl}
      />
    </div>
  );
}

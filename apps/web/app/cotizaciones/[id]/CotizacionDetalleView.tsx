"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import {
  applyCleanMarginHierarchy,
  applyLatestMarginTemplateSnapshotToVersion,
  createMarginTemplateSnapshotFromVersion,
  deleteQuoteItem,
  deleteLine,
  duplicateLine,
  duplicateMainItem,
  fetchClient,
  fetchFvCalculation,
  fetchFvStudy,
  fetchLatestMarginTemplateSnapshot,
  fetchTechnicalValidations,
  refreshQuoteVersionFromStudy,
  createTemplateFromQuoteVersion,
  updateClient,
  updateQuote,
  updateLine,
  type Client,
  type QuoteDetail,
  type QuoteVersionDetail,
  type QuoteItemDto,
  type QuoteItemLineDto,
  type QuoteMainItemDto,
  type QuoteFvCalculation,
  type FvStudy,
  type TechnicalValidationAlert,
  type MarginTemplateSnapshotSummary,
} from "../../../lib/api";
import {
  MARGIN_CONNECTION_LABELS,
  MARGIN_MOUNT_STRUCTURE_LABELS,
  MARGIN_TECHNICAL_KNOWN_KEYS,
  MARGIN_TECHNICAL_LABELS,
  MARGIN_SYSTEM_TYPE_LABELS,
  splitMarginTechnicalBasics,
  type MarginConnectionType,
  type MarginMountStructureType,
  type MarginSystemType,
  type MarginTechnicalKnownKey,
} from "../../../lib/margin-technical-basics";
import { formatRutForDisplay, onMoneyIntegerInputChange } from "../../../lib/chile-inputs";
import { Modal } from "../../../components/ui/Modal";
import {
  MARGIN_QUOTE_SUBTITLE,
  MARGIN_QUOTE_TAGLINE,
  marginQuoteBannerClass,
  marginQuoteSubtitleTextClass,
  marginQuoteTaglineTextClass,
} from "../../../lib/margin-quote-identity";

const FV_KINDS = ["PANELS", "INVERTER", "STRUCTURE"] as const;

function marginTechnicalDetailValue(key: MarginTechnicalKnownKey, raw: unknown): string {
  if (raw === undefined || raw === null) return "—";
  if (key === "systemType" && typeof raw === "string" && raw in MARGIN_SYSTEM_TYPE_LABELS) {
    return MARGIN_SYSTEM_TYPE_LABELS[raw as MarginSystemType];
  }
  if (key === "mountStructureType" && typeof raw === "string" && raw in MARGIN_MOUNT_STRUCTURE_LABELS) {
    return MARGIN_MOUNT_STRUCTURE_LABELS[raw as MarginMountStructureType];
  }
  if (key === "connectionType" && typeof raw === "string" && raw in MARGIN_CONNECTION_LABELS) {
    return MARGIN_CONNECTION_LABELS[raw as MarginConnectionType];
  }
  if (key === "potenciaOrientativaKwp") {
    if (typeof raw === "number" && Number.isFinite(raw)) return `${raw} kWp`;
    if (typeof raw === "string" && raw.trim() !== "") return `${raw.trim()} kWp`;
  }
  if (typeof raw === "string") return raw.trim() === "" ? "—" : raw;
  return String(raw);
}

/**
 * Indica si hace falta sincronizar desde el estudio: solo la cantidad de paneles en la línea FV de paneles.
 * Las descripciones de línea no se reescriben al actualizar desde estudio; no las usamos para este aviso.
 */
function isFvOutOfSync(
  study: FvStudy | null,
  mainItems: QuoteMainItemDto[] | undefined,
  suggestedFromStudy: boolean,
): boolean {
  if (!study || !mainItems?.length) return false;
  const qty = study.cantidadPaneles ?? 0;

  for (let i = 0; i < mainItems.length; i++) {
    const mainItem = mainItems[i] as QuoteMainItemDto & { sourceFromFvStudyKind?: string | null };
    const kind =
      mainItem.sourceFromFvStudyKind ??
      (suggestedFromStudy && mainItem.sortOrder >= 0 && mainItem.sortOrder <= 2 ? FV_KINDS[mainItem.sortOrder] : null);
    if (kind !== "PANELS" || !mainItem.lines?.length) continue;
    const line = mainItem.lines[0];
    const lineQty = typeof line.quantity === "number" ? line.quantity : Number(line.quantity);
    if (lineQty !== qty) return true;
  }
  return false;
}
import { quoteCommercialStatusBadgeClass } from "../../../lib/quote-status-ui";
import {
  STATUS_LABELS,
  COMMERCIAL_STATUS_LABELS,
  COMMERCIAL_STATUS_OPTIONS,
  PROJECT_TYPE_LABELS,
  QUOTE_ITEM_ORIGIN_LABEL,
  QUOTE_MAIN_ITEM_TOTAL_MODE_LABEL,
  formatDate,
  formatMoney,
} from "../constants";
import { ModalAgregarProducto } from "./ModalAgregarProducto";
import { ModalAgregarManual } from "./ModalAgregarManual";
import { ModalEditarItem } from "./ModalEditarItem";
import { ModalEditarLinea } from "./ModalEditarLinea";
import { ModalCrearPrincipal } from "./ModalCrearPrincipal";
import { MainItemBlockHeaderForm } from "./MainItemBlockHeaderForm";
import { MarginInlineLineCell } from "./MarginInlineLineCell";
import { ModalEditarVersion } from "./ModalEditarVersion";
import { useMarginInlineLineEdit } from "./useMarginInlineLineEdit";
import { CalculoFvModal } from "./CalculoFvModal";
import { AdicionalesSection } from "./AdicionalesSection";
import { CotizacionResumenEjecutivo } from "../CotizacionResumenEjecutivo";
import { ShareToChatModal } from "../../../components/conversations/ShareToChatModal";
import { ClienteForm } from "../../clientes/ClienteForm";
import { CotizacionForm } from "../CotizacionForm";

type Props = {
  quote: QuoteDetail;
  versionDetail: QuoteVersionDetail | null;
  versionId: string | null;
  isCurrentVersion: boolean;
  onSelectVersion: (versionId: string) => void;
  onRefreshVersion: () => void;
  /** Recarga cabecera de cotización (cliente, vendedor, lead, etc.) tras PATCH. */
  onQuoteRefresh: () => Promise<void>;
  onCreateVersion: () => void;
  onDuplicateCurrentVersion: () => void;
};

export function CotizacionDetalleView({
  quote,
  versionDetail,
  versionId,
  isCurrentVersion,
  onSelectVersion,
  onRefreshVersion,
  onQuoteRefresh,
  onCreateVersion,
  onDuplicateCurrentVersion,
}: Props) {
  const router = useRouter();
  const canEdit = useCan("edit", "quote");
  const canEditClient = useCan("edit", "client");
  const canPriceOverride = useCan("priceOverride", "quote");
  const canCreateFvStudy = useCan("create", "fvStudy");
  const isMarginQuote = quote.quoteKind === "MARGIN";
  const [modalAddProduct, setModalAddProduct] = useState(false);
  const [modalAddManual, setModalAddManual] = useState(false);
  const [modalEditItem, setModalEditItem] = useState(false);
  const [modalEditVersion, setModalEditVersion] = useState(false);
  const [modalCalculoFv, setModalCalculoFv] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItemDto | null>(null);
  const [fvCalculation, setFvCalculation] = useState<QuoteFvCalculation | null>(null);
  const [fvStudySummary, setFvStudySummary] = useState<FvStudy | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedMainIds, setExpandedMainIds] = useState<Set<string>>(new Set());
  const lastVersionIdRef = useRef<string | null>(null);

  const [modalCrearPrincipal, setModalCrearPrincipal] = useState(false);
  const [modalApplyCleanMargin, setModalApplyCleanMargin] = useState(false);
  const [applyCleanMarginSaving, setApplyCleanMarginSaving] = useState(false);
  const [cleanMarginSystemType, setCleanMarginSystemType] = useState<"ON_GRID" | "HYBRID" | "OFF_GRID">("ON_GRID");
  const [cleanMarginMountStructureType, setCleanMarginMountStructureType] = useState<
    "STANDARD" | "ANGULAR" | "MIXTA"
  >("STANDARD");
  const [marginLatestSnapshot, setMarginLatestSnapshot] = useState<
    MarginTemplateSnapshotSummary | null | undefined
  >(undefined);
  const [modalSaveValorizada, setModalSaveValorizada] = useState(false);
  const [saveValorizadaName, setSaveValorizadaName] = useState("");
  const [saveValorizadaDescription, setSaveValorizadaDescription] = useState("");
  const [saveValorizadaSaving, setSaveValorizadaSaving] = useState(false);
  const [applyValorizadaSaving, setApplyValorizadaSaving] = useState(false);
  const [mainItemIdForLine, setMainItemIdForLine] = useState<string | null>(null);
  const [editingLine, setEditingLine] = useState<QuoteItemLineDto | null>(null);
  const [modalEditLine, setModalEditLine] = useState(false);

  const [technicalAlerts, setTechnicalAlerts] = useState<TechnicalValidationAlert[] | null>(null);
  const [technicalAlertsLoading, setTechnicalAlertsLoading] = useState(false);
  const [technicalAlertsError, setTechnicalAlertsError] = useState<string | null>(null);
  const [refreshFromStudyLoading, setRefreshFromStudyLoading] = useState(false);
  const [saveAsTemplateLoading, setSaveAsTemplateLoading] = useState(false);
  const [togglingLineId, setTogglingLineId] = useState<string | null>(null);
  const [duplicatingLineId, setDuplicatingLineId] = useState<string | null>(null);
  const [duplicatingMainItemId, setDuplicatingMainItemId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [modalEditCommercial, setModalEditCommercial] = useState(false);
  const [modalEditClient, setModalEditClient] = useState(false);
  const [clientForEdit, setClientForEdit] = useState<Client | null>(null);
  const [clientEditLoading, setClientEditLoading] = useState(false);
  const [clientEditError, setClientEditError] = useState<string | null>(null);

  const marginLineInline = useMarginInlineLineEdit({
    quoteId: quote.id,
    versionId,
    enabled: Boolean(canEdit && isMarginQuote && versionId),
    onRefresh: onRefreshVersion,
  });
  const [openAddDropdownMainId, setOpenAddDropdownMainId] = useState<string | null>(null);
  /** Edición del ítem madre (bloque): nombre, descripción, PDF, totalMode, totalOverride */
  const [editingMainBlockId, setEditingMainBlockId] = useState<string | null>(null);
  const [commercialStatus, setCommercialStatus] = useState(quote.status ?? "BORRADOR");
  const [savedCommercialStatus, setSavedCommercialStatus] = useState(quote.status ?? "BORRADOR");
  const [savingCommercialStatus, setSavingCommercialStatus] = useState(false);
  const [commercialStatusError, setCommercialStatusError] = useState<string | null>(null);
  const addDropdownRef = useRef<HTMLDivElement>(null);

  const currency = quote.currency ?? "USD";
  const quoteStatus = commercialStatus || quote.status;
  const fromStudy = Boolean(quote.sourceFvStudyId);
  const canRefreshFromStudy =
    Boolean(quote.sourceFvStudyId) &&
    versionDetail?.status === "BORRADOR" &&
    quoteStatus === "BORRADOR" &&
    canEdit;

  const fvOutOfSync = useMemo(
    () =>
      quote.sourceFvStudyId &&
      versionDetail?.status === "BORRADOR" &&
      fvStudySummary &&
      versionDetail.mainItems?.length
        ? isFvOutOfSync(fvStudySummary, versionDetail.mainItems, quote.suggestedItemsFromStudy ?? false)
        : false,
    [quote.sourceFvStudyId, quote.suggestedItemsFromStudy, versionDetail?.status, versionDetail?.mainItems, fvStudySummary],
  );

  const marginHierarchyLineCount = useMemo(() => {
    const items = versionDetail?.mainItems ?? [];
    return items.reduce((n, m) => n + (m.lines?.length ?? 0), 0);
  }, [versionDetail?.mainItems]);

  useEffect(() => {
    const next = quote.status ?? "BORRADOR";
    setCommercialStatus(next);
    setSavedCommercialStatus(next);
  }, [quote.status, quote.id]);

  useEffect(() => {
    if (quote.sourceFvStudyId) {
      fetchFvStudy(quote.sourceFvStudyId)
        .then(setFvStudySummary)
        .catch(() => setFvStudySummary(null));
    } else {
      setFvStudySummary(null);
    }
  }, [quote.sourceFvStudyId]);

  useEffect(() => {
    const studyId = quote.sourceFvStudyId;
    if (!studyId) return;
    const handleFocus = () => {
      fetchFvStudy(studyId)
        .then(setFvStudySummary)
        .catch(() => setFvStudySummary(null));
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [quote.sourceFvStudyId]);

  useEffect(() => {
    if (!quote.id || fromStudy) return;
    fetchFvCalculation(quote.id, versionId ?? undefined)
      .then(setFvCalculation)
      .catch(() => setFvCalculation(null));
  }, [quote.id, versionId, fromStudy]);

  // Expandir grupos: al cambiar de versión, todos; en la misma versión, solo ítems principales nuevos (p. ej. primer bloque creado).
  useEffect(() => {
    const items = versionDetail?.mainItems;
    if (!versionId) return;
    if (!items?.length) {
      if (lastVersionIdRef.current !== versionId) {
        lastVersionIdRef.current = versionId;
        setExpandedMainIds(new Set());
      }
      return;
    }
    if (lastVersionIdRef.current !== versionId) {
      lastVersionIdRef.current = versionId;
      setExpandedMainIds(new Set(items.map((m) => m.id)));
      return;
    }
    setExpandedMainIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const m of items) {
        if (!next.has(m.id)) {
          next.add(m.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [versionId, versionDetail?.mainItems]);

  // Cerrar dropdown "Agregar subitem" al hacer clic fuera
  useEffect(() => {
    if (openAddDropdownMainId == null) return;
    const handleClick = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setOpenAddDropdownMainId(null);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [openAddDropdownMainId]);

  // Cargar validaciones técnicas cuando hay versión; refrescar al cambiar versión o al actualizar versionDetail
  useEffect(() => {
    if (!quote.id || !versionId || !versionDetail) {
      setTechnicalAlerts(null);
      setTechnicalAlertsError(null);
      return;
    }
    let cancelled = false;
    setTechnicalAlertsLoading(true);
    setTechnicalAlertsError(null);
    fetchTechnicalValidations(quote.id, versionId)
      .then((data) => {
        if (!cancelled) setTechnicalAlerts(data.alerts);
      })
      .catch((err) => {
        if (!cancelled) {
          setTechnicalAlertsError(err instanceof Error ? err.message : "Error al cargar validaciones");
          setTechnicalAlerts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setTechnicalAlertsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quote.id, versionId, versionDetail]);

  useEffect(() => {
    if (!isMarginQuote || !canEdit || !versionId || versionDetail?.status !== "BORRADOR") {
      setMarginLatestSnapshot(undefined);
      return;
    }
    let cancelled = false;
    setMarginLatestSnapshot(undefined);
    fetchLatestMarginTemplateSnapshot()
      .then((r) => {
        if (!cancelled) setMarginLatestSnapshot(r.snapshot);
      })
      .catch(() => {
        if (!cancelled) setMarginLatestSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isMarginQuote, canEdit, versionId, versionDetail?.status, quote.id]);

  const toggleMainItemExpanded = (id: string) => {
    setExpandedMainIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const versions = quote.versions ?? [];
  const hasVersions = versions.length > 0;

  const openEditItem = (item: QuoteItemDto) => {
    setEditingItem(item);
    setModalEditItem(true);
  };
  const closeEditItem = () => {
    setEditingItem(null);
    setModalEditItem(false);
  };
  const handleRemoveItem = (item: QuoteItemDto) => {
    if (!versionId || !confirm(`¿Eliminar el ítem «${item.productNameSnapshot}»? Esta acción no se puede deshacer.`)) return;
    setActionError(null);
    deleteQuoteItem(quote.id, versionId, item.id)
      .then(() => {
        onRefreshVersion();
        setActionError(null);
      })
      .catch((e) => setActionError(e instanceof Error ? e.message : "Error al eliminar"));
  };

  const handleSaveCommercialStatus = () => {
    if (!canEdit || savingCommercialStatus || !commercialStatus) return;
    setCommercialStatusError(null);
    setSavingCommercialStatus(true);
    updateQuote(quote.id, { status: commercialStatus })
      .then((updated) => {
        const next = updated.status ?? commercialStatus;
        setCommercialStatus(next);
        setSavedCommercialStatus(next);
      })
      .catch((e) => {
        setCommercialStatusError(e instanceof Error ? e.message : "Error al actualizar estado comercial");
      })
      .finally(() => setSavingCommercialStatus(false));
  };

  /** Valor visible en ficha comercial; siempre muestra algo (nunca cadena vacía). */
  const fichaValor = (v: string | null | undefined) =>
    v != null && String(v).trim() !== "" ? String(v).trim() : "—";

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      {/* 1. Cabecera comercial: misma card; ficha en tabla para que no “desaparezca” por layout */}
      <div
        className={`card border-2 border-slate-300 p-0 shadow-md dark:border-slate-600 ${
          isMarginQuote ? "margin-quote-card-shell" : ""
        }`}
        role="region"
        aria-label="Ficha comercial de la cotización"
      >
        <div className="border-b-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white px-5 py-4 dark:border-slate-600 dark:from-slate-800/90 dark:to-slate-800/50 sm:px-6 sm:py-5">
          {isMarginQuote && (
            <div className={`mb-4 ${marginQuoteBannerClass}`} role="note">
              <p className={marginQuoteSubtitleTextClass}>{MARGIN_QUOTE_SUBTITLE}</p>
              <p className={marginQuoteTaglineTextClass}>{MARGIN_QUOTE_TAGLINE}</p>
            </div>
          )}
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  {quote.title}
                </h2>
                <span className="shrink-0 rounded-md border-2 border-amber-300 bg-amber-50 px-2.5 py-1 text-sm font-bold tabular-nums text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100">
                  Nº {quote.commercialNumber ?? "—"}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-200">
                <span className="text-slate-500 dark:text-slate-400">Cliente:</span>{" "}
                {fichaValor(quote.client?.name) !== "—" ? fichaValor(quote.client?.name) : quote.clientId}
                <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400">Tipo:</span>{" "}
                {PROJECT_TYPE_LABELS[quote.projectType] ?? quote.projectType}
                <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400">Validez:</span> {formatDate(quote.validUntil)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                Compartir
              </button>
              {isMarginQuote && (
                <span className="inline-flex rounded-full border border-violet-300/90 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-900 dark:border-violet-600/60 dark:bg-violet-950/40 dark:text-violet-100">
                  Margen
                </span>
              )}
              {quote.sourceQuoteTemplateId ? (
                <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                  Desde plantilla
                </span>
              ) : fromStudy ? (
                <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                  Desde estudio
                </span>
              ) : fvCalculation ? (
                <span className="inline-flex rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                  Desde cálculo rápido
                </span>
              ) : null}
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${quoteCommercialStatusBadgeClass(quoteStatus)}`}
                title={
                  quoteStatus === "ARCHIVADA"
                    ? "Archivada: fuera de la bandeja activa; datos conservados."
                    : quoteStatus === "ANULADA"
                      ? "Anulada o cancelada; ya no cuenta como oportunidad activa."
                      : undefined
                }
              >
                {COMMERCIAL_STATUS_LABELS[quoteStatus] ?? quoteStatus}
              </span>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <div className="rounded-lg border-2 border-dashed border-amber-400/90 bg-amber-50/70 p-4 dark:border-amber-600/60 dark:bg-amber-950/25">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Datos comerciales y de contacto
                </h3>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  Cada fila se muestra siempre. Si ves “—”, el dato no está cargado en el cliente o en la cotización (también puede actualizar la ficha del cliente).
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setModalEditCommercial(true)}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-sm"
                >
                  Editar datos comerciales…
                </button>
              )}
            </div>
            <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {(
                [
                  ["Cliente", fichaValor(quote.client?.name) !== "—" ? fichaValor(quote.client?.name) : quote.clientId],
                  [
                    "RUT",
                    fichaValor(formatRutForDisplay(quote.client?.taxId) || undefined),
                  ],
                  ["Correo", fichaValor(quote.client?.email)],
                  ["Teléfono", fichaValor(quote.client?.phone)],
                  ["Dirección", fichaValor(quote.client?.address)],
                  ["Lead", fichaValor(quote.leadNumber)],
                  [
                    "Vendedor responsable",
                    quote.salesperson
                      ? fichaValor(
                          quote.salesperson.fullName?.trim() ||
                            quote.salesperson.name?.trim() ||
                            quote.salesperson.email,
                        )
                      : "—",
                  ],
                  [
                    "Responsable del registro",
                    quote.owner
                      ? fichaValor(
                          quote.owner.fullName?.trim() ||
                            quote.owner.name?.trim() ||
                            quote.owner.email,
                        )
                      : "—",
                  ],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2.5 dark:border-amber-800/40 dark:bg-slate-900/40"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {label}
                  </p>
                  <p className="mt-1 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(quote.sourceFvStudyId || quote.sourceQuoteTemplateId) && (
          <div className="border-t-2 border-slate-200 bg-slate-50/80 px-5 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-300 sm:px-6">
            {quote.sourceFvStudyId && (
              <p>
                Origen estudio FV:{" "}
                <Link
                  href={`/estudios-fv/${quote.sourceFvStudyId}`}
                  className="font-semibold text-amber-700 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                >
                  {quote.sourceFvStudy?.title ?? "Ver estudio"}
                </Link>
              </p>
            )}
            {quote.sourceQuoteTemplateId && quote.sourceQuoteTemplate && (
              <p className={quote.sourceFvStudyId ? "mt-1" : ""}>
                Creada desde plantilla:{" "}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{quote.sourceQuoteTemplate.name}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {quote.quoteKind === "MARGIN" && (
        <div
          className="card border-violet-200 dark:border-violet-800"
          role="region"
          aria-label="Parámetros técnicos base margen"
        >
          <div className="border-b border-violet-100 px-5 py-3 dark:border-violet-900/50 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-violet-900 dark:text-violet-200">
                Parámetros técnicos base
              </h3>
              <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-900/50 dark:text-violet-200">
                Margen
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Datos técnicos mínimos para el flujo MARGIN; edición en{" "}
              <Link href={`/cotizaciones/${quote.id}/editar`} className="font-medium text-amber-700 underline dark:text-amber-400">
                Editar cotización
              </Link>
              .
            </p>
          </div>
          <div className="px-5 py-4 sm:px-6">
            {(() => {
              const raw = quote.technicalBasicsJson;
              const { unknown } = splitMarginTechnicalBasics(raw);
              const hasUnknown = Object.keys(unknown).length > 0;
              const knownRows = MARGIN_TECHNICAL_KNOWN_KEYS.filter((key) => {
                if (raw == null || !Object.prototype.hasOwnProperty.call(raw, key)) return false;
                return marginTechnicalDetailValue(key, raw[key as keyof typeof raw]) !== "—";
              });
              if (!raw || Object.keys(raw).length === 0) {
                return (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sin datos cargados. Agréguelos en <strong>Editar cotización</strong>.
                  </p>
                );
              }
              if (knownRows.length === 0 && !hasUnknown) {
                return (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sin datos cargados. Agréguelos en <strong>Editar cotización</strong>.
                  </p>
                );
              }
              return (
                <div className="space-y-4">
                  {knownRows.length > 0 && (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {knownRows.map((key) => {
                        const v = raw![key as keyof typeof raw];
                        const text = marginTechnicalDetailValue(key, v);
                        return (
                          <div
                            key={key}
                            className="rounded-md border border-violet-100 bg-white/80 px-3 py-2.5 dark:border-violet-900/40 dark:bg-slate-900/50"
                          >
                            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              {MARGIN_TECHNICAL_LABELS[key]}
                            </dt>
                            <dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100">
                              {text}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  )}
                  {hasUnknown && (
                    <details className="rounded-md border border-slate-200 bg-slate-50/90 dark:border-slate-600 dark:bg-slate-900/50">
                      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        Datos técnicos adicionales ({Object.keys(unknown).length})
                      </summary>
                      <pre className="max-h-56 overflow-auto border-t border-slate-200 p-3 font-mono text-xs text-slate-800 dark:border-slate-600 dark:text-slate-200">
                        {JSON.stringify(unknown, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Panel estado estudio ↔ cotización */}
      {versionDetail && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/40" role="region" aria-label="Estado vinculación estudio FV">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
            Estado estudio ↔ cotización
          </h3>
          {!quote.sourceFvStudyId ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Esta cotización no está vinculada a un estudio FV. Use{" "}
              <strong>Crear estudio FV e implementación</strong> en el resumen FV para generar el estudio, el dibujo de implantación y vincular esta cotización automáticamente.
            </p>
          ) : (
            <>
              <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Vinculada al estudio FV</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    Sí —{" "}
                    <Link
                      href={`/estudios-fv/${quote.sourceFvStudyId}`}
                      className="text-amber-700 underline hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      {quote.sourceFvStudy?.title ?? "Ver estudio"}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Fuente técnica en vista previa</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    {versionDetail.status !== "BORRADOR" &&
                    versionDetail.fvSnapshot != null &&
                    String(versionDetail.fvSnapshot).trim() !== ""
                      ? "Snapshot congelado"
                      : versionDetail.status !== "BORRADOR"
                        ? "Estudio en vivo (compatibilidad)"
                        : "Estudio en vivo"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Estado de la versión</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    {STATUS_LABELS[versionDetail.status] ?? versionDetail.status}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Snapshot técnico</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    {versionDetail.fvSnapshot != null && String(versionDetail.fvSnapshot).trim() !== ""
                      ? "Disponible"
                      : "No disponible"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Actualizar ítems FV desde estudio</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-200">
                    {canRefreshFromStudy ? "Disponible" : "No disponible"}
                  </dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                {versionDetail.status !== "BORRADOR" &&
                versionDetail.fvSnapshot != null &&
                String(versionDetail.fvSnapshot).trim() !== ""
                  ? "Esta versión está congelada y ya no cambia si el estudio se edita."
                  : versionDetail.status !== "BORRADOR"
                    ? "Versión antigua sin snapshot: usando estudio en vivo por compatibilidad."
                    : "Esta versión usa el estudio en vivo. Puede actualizar ítems técnicos desde el estudio antes de enviar o aceptar."}
              </p>
              {versionDetail.status === "BORRADOR" && quote.sourceFvStudyId && fvStudySummary && (versionDetail.mainItems?.length ?? 0) > 0 && (
                <p
                  className={`mt-2 text-sm ${fvOutOfSync ? "font-medium text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}
                  role="status"
                >
                  {fvOutOfSync
                    ? "El estudio tiene cambios respecto a esta cotización. Use \"Actualizar ítems FV desde estudio\" para sincronizar."
                    : "Los ítems FV base están alineados con el estudio actual."}
                </p>
              )}
              {canRefreshFromStudy && versionId && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={refreshFromStudyLoading}
                    onClick={() => {
                      setRefreshFromStudyLoading(true);
                      setActionError(null);
                      refreshQuoteVersionFromStudy(quote.id, versionId)
                        .then(() => {
                          onRefreshVersion();
                          setActionError(null);
                        })
                        .catch((e) => setActionError(e instanceof Error ? e.message : "Error al actualizar desde estudio"))
                        .finally(() => setRefreshFromStudyLoading(false));
                    }}
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                  >
                    {refreshFromStudyLoading ? "Actualizando…" : "Actualizar ítems FV desde estudio"}
                  </button>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Actualiza la cantidad de paneles (y el total de esa línea) según el estudio; no cambia textos de
                    descripción ni precios ni descuentos.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {quote.suggestedItemsFromStudy && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-900" role="status">
          <p className="font-medium">Propuesta base generada desde estudio</p>
          <p className="mt-1 text-sm text-sky-800">
            Las líneas siguientes se generaron a partir del estudio FV y son editables. Complete precios donde corresponda y ajuste cantidades o descripciones si lo necesita.
          </p>
        </div>
      )}

      {/* 2. Bloque de versiones */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Versiones
        </h3>
        {!hasVersions ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700/40">
            <p className="text-sm text-slate-600 dark:text-slate-400">Esta cotización aún no tiene versiones. Cree la primera para agregar ítems y precios.</p>
            {canEdit && (
              <button type="button" onClick={onCreateVersion} className="btn-primary mt-3">
                Crear versión inicial
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {versions.map((v) => {
              const isSelected = versionId === v.id;
              const isCurrent = quote.currentVersion?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVersion(v.id)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    isSelected
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  }`}
                >
                  <span>Versión {v.versionNumber}</span>
                  {isCurrent && (
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                      Actual
                    </span>
                  )}
                  {isSelected && !isCurrent && (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-600">
                      Viendo
                    </span>
                  )}
                </button>
              );
            })}
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={onCreateVersion}
                  className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm text-slate-500 hover:border-amber-400 hover:text-amber-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:border-amber-500 dark:hover:text-amber-400"
                >
                  + Nueva versión
                </button>
                {quote.currentVersion && (
                  <button
                    type="button"
                    onClick={onDuplicateCurrentVersion}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Duplicar versión actual
                  </button>
                )}
                {!isMarginQuote && versionDetail?.status === "BORRADOR" && versionId && (
                    <button
                      type="button"
                      disabled={saveAsTemplateLoading}
                      onClick={() => {
                        const defaultName = (quote.title?.trim() || "Plantilla desde cotización") + " (plantilla)";
                        const name = window.prompt("Nombre de la nueva plantilla", defaultName);
                        if (name === null) return;
                        const trimmed = name.trim();
                        if (!trimmed) {
                          setActionError("Indique un nombre para la plantilla.");
                          return;
                        }
                        setSaveAsTemplateLoading(true);
                        setActionError(null);
                        createTemplateFromQuoteVersion({
                          quoteId: quote.id,
                          versionId,
                          name: trimmed,
                        })
                          .then((tpl) => {
                            router.push(`/plantillas/${tpl.id}/editar`);
                          })
                          .catch((e) =>
                            setActionError(
                              e instanceof Error ? e.message : "Error al guardar como plantilla",
                            ),
                          )
                          .finally(() => setSaveAsTemplateLoading(false));
                      }}
                      className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70"
                    >
                      {saveAsTemplateLoading ? "Creando plantilla…" : "Guardar versión como plantilla"}
                    </button>
                  )}
              </>
            )}
          </div>
        )}
        {hasVersions && versionId && !isCurrentVersion && (
          <p className="mt-3 text-sm text-amber-700 dark:text-amber-400" role="status">
            Está viendo una versión anterior. La versión actual es la {quote.currentVersion?.versionNumber}.
          </p>
        )}
      </div>

      {/* 2b. Resumen FV — desde estudio o desde cálculo en cotización */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {fromStudy
            ? "Resumen FV (desde estudio)"
            : fvCalculation
              ? "Resumen FV (cálculo guardado en cotización)"
              : "Resumen FV"}
        </h3>
        {fromStudy && fvStudySummary ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Planta</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{fvStudySummary.potenciaSistemaKwp} kWp</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Paneles</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{fvStudySummary.cantidadPaneles}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Ahorro anual</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">$ {formatMoney(fvStudySummary.ahorroAnual, "")}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">% ahorro</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{fvStudySummary.porcentajeAhorro.toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Pago residual</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">$ {formatMoney(fvStudySummary.pagoResidualAnual, "")}</dd>
              </div>
            </dl>
            <div className="flex flex-col items-end gap-1">
              <Link
                href={`/estudios-fv/${quote.sourceFvStudyId}`}
                className="text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Ver estudio
              </Link>
              <p className="text-xs text-slate-500 max-w-[260px] text-right">
                Esta cotización usa un Estudio FV vinculado. Edite el estudio para cambiar el resumen FV.
              </p>
            </div>
          </div>
        ) : fromStudy && !fvStudySummary ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-slate-500">Cargando resumen del estudio…</p>
            <Link href={`/estudios-fv/${quote.sourceFvStudyId}`} className="btn-secondary">
              Ver estudio
            </Link>
          </div>
        ) : fvCalculation ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Planta</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{fvCalculation.plantaKwp} kWp</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Paneles</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{fvCalculation.cantidadPaneles}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Ahorro anual</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">$ {formatMoney(fvCalculation.ahorroAnual, "")}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">% ahorro</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">{fvCalculation.porcentajeAhorro.toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 dark:text-slate-400">Pago residual</dt>
                <dd className="font-medium text-slate-900 dark:text-slate-100">$ {formatMoney(fvCalculation.pagoResidual, "")}</dd>
              </div>
            </dl>
            <button type="button" onClick={() => setModalCalculoFv(true)} className="text-sm font-medium text-amber-600 hover:text-amber-700">
              Ver / editar cálculo (legado)
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <p className="text-sm text-slate-600 max-w-xl dark:text-slate-400">
              El flujo estándar es un <strong>Estudio FV</strong> con <strong>diseño de implantación</strong> (dibujo de techo, paneles y parámetros técnicos). Se aplica igual a cotizaciones normales y a las creadas desde plantilla.
              Al crear el estudio desde aquí, esta cotización quedará <strong>vinculada automáticamente</strong> al guardar.
            </p>
            <div className="flex shrink-0 flex-col gap-2">
              {canCreateFvStudy ? (
                <Link
                  href={`/estudios-fv/nuevo?clientId=${encodeURIComponent(quote.clientId)}&quoteId=${encodeURIComponent(quote.id)}`}
                  className="btn-primary inline-flex justify-center text-center"
                >
                  Crear estudio FV e implementación
                </Link>
              ) : null}
              <Link
                href={`/estudios-fv?clientId=${encodeURIComponent(quote.clientId)}`}
                className="text-center text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400"
              >
                Ver estudios FV del cliente
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* (Resumen económico movido al final de la vista) */}

      {/* 3.4 Validaciones técnicas (alertas informativas, no bloquean) */}
      {versionDetail && versionId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-6 py-4 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800">
            Validaciones técnicas
          </h3>
          <p className="mt-1 text-xs text-amber-700/90">
            Revisión de compatibilidad entre estudio FV, productos y líneas. Estas advertencias no impiden guardar ni enviar la cotización.
          </p>
          {technicalAlertsLoading ? (
            <p className="mt-3 text-sm text-amber-800">Cargando validaciones…</p>
          ) : technicalAlertsError ? (
            <p className="mt-3 text-sm text-amber-800" role="status">
              {technicalAlertsError}
            </p>
          ) : Array.isArray(technicalAlerts) && technicalAlerts.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800" role="status">
              No se detectaron alertas de compatibilidad técnica.
            </p>
          ) : Array.isArray(technicalAlerts) && technicalAlerts.length > 0 ? (
            <ul className="mt-3 space-y-2" role="list">
              {technicalAlerts.map((alert, idx) => (
                <li key={`${alert.code}-${idx}`} className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-amber-900">{alert.message}</span>
                  {(alert.itemId || alert.lineId) && (
                    <span className="text-xs text-amber-700/80">
                      {alert.itemId ? "Ítem de cotización" : "Línea en vista jerárquica"}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {/* 3.5 Adicionales (parámetros y sugerencias) */}
      {versionDetail && versionId && (
        <AdicionalesSection
          quoteId={quote.id}
          versionId={versionId}
          canEdit={canEdit}
          currency={currency}
          onRefreshVersion={onRefreshVersion}
        />
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-stretch">
        <div className="space-y-4 min-h-0">
          {/* 3.6 Vista jerárquica: misma base STANDARD/MARGIN (grupos + subítems + PDF). Siempre visible con versión cargada. */}
      {versionDetail && versionId && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Vista jerárquica de la cotización
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {canEdit
                  ? (versionDetail.mainItems?.length ?? 0) > 0
                    ? "Cada grupo es un ítem principal; dentro están los subítems (líneas). Use Agregar subitem para añadir líneas. La visibilidad en PDF se controla por bloque (Editar bloque) y por línea (columna En PDF). La tabla plana de abajo queda en solo lectura mientras existan grupos."
                    : "Arme la misma estructura que en una cotización estándar: cree un ítem principal y luego agregue subítems (manual o catálogo). Mientras no haya grupos, puede usar la tabla plana de abajo para ítems sueltos."
                  : "Estructura comercial: grupos (ítems principales) y subítems (líneas de detalle)."}
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setModalCrearPrincipal(true)}
                  className="btn-primary"
                >
                  Crear ítem principal
                </button>
                {isMarginQuote && versionId && versionDetail?.status === "BORRADOR" && (
                  <button
                    type="button"
                    onClick={() => {
                      const raw = quote.technicalBasicsJson;
                      if (
                        raw &&
                        typeof raw.systemType === "string" &&
                        (raw.systemType === "ON_GRID" || raw.systemType === "HYBRID" || raw.systemType === "OFF_GRID")
                      ) {
                        setCleanMarginSystemType(raw.systemType);
                      }
                      if (
                        raw &&
                        typeof raw.mountStructureType === "string" &&
                        (raw.mountStructureType === "STANDARD" ||
                          raw.mountStructureType === "ANGULAR" ||
                          raw.mountStructureType === "MIXTA")
                      ) {
                        setCleanMarginMountStructureType(raw.mountStructureType);
                      }
                      setModalApplyCleanMargin(true);
                    }}
                    className="btn-secondary"
                  >
                    Cargar plantilla limpia
                  </button>
                )}
                {isMarginQuote && versionId && versionDetail?.status === "BORRADOR" && canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setSaveValorizadaName(
                          (quote.commercialNumber
                            ? `Plantilla ${quote.commercialNumber}`
                            : quote.title?.trim() || "Plantilla valorizada"
                          ).slice(0, 200),
                        );
                        setSaveValorizadaDescription("");
                        setModalSaveValorizada(true);
                      }}
                      className="btn-secondary border-violet-200 text-violet-900 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-100 dark:hover:bg-violet-950/40"
                      disabled={
                        (versionDetail?.mainItems?.length ?? 0) === 0 || marginHierarchyLineCount === 0
                      }
                      title={
                        (versionDetail?.mainItems?.length ?? 0) === 0 || marginHierarchyLineCount === 0
                          ? "Necesita al menos un bloque con líneas en la jerarquía"
                          : "Guarda la jerarquía y valores actuales como plantilla reutilizable"
                      }
                    >
                      Guardar plantilla valorizada
                    </button>
                    <button
                      type="button"
                      className="btn-secondary border-violet-200 text-violet-900 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-100 dark:hover:bg-violet-950/40"
                      disabled={
                        marginLatestSnapshot === undefined ||
                        marginLatestSnapshot === null ||
                        applyValorizadaSaving
                      }
                      title={
                        marginLatestSnapshot === undefined
                          ? "Consultando plantillas guardadas…"
                          : marginLatestSnapshot === null
                            ? "Aún no ha guardado ninguna plantilla valorizada (use el botón anterior en una cotización con jerarquía lista)"
                            : `Aplicar “${marginLatestSnapshot.name}” (${new Date(marginLatestSnapshot.createdAt).toLocaleString()})`
                      }
                      onClick={() => {
                        if (!versionId || marginLatestSnapshot == null) return;
                        const hasHierarchy = (versionDetail?.mainItems?.length ?? 0) > 0;
                        if (hasHierarchy) {
                          if (
                            !window.confirm(
                              "¿Reemplazar toda la jerarquía actual por su última plantilla valorizada guardada? Esta acción no se puede deshacer.",
                            )
                          ) {
                            return;
                          }
                        }
                        setApplyValorizadaSaving(true);
                        setActionError(null);
                        void applyLatestMarginTemplateSnapshotToVersion(quote.id, versionId, {
                          replaceExisting: hasHierarchy ? true : undefined,
                        })
                          .then(() => {
                            onRefreshVersion();
                          })
                          .catch((e) => {
                            setActionError(
                              e instanceof Error ? e.message : "Error al cargar la última plantilla valorizada",
                            );
                          })
                          .finally(() => setApplyValorizadaSaving(false));
                      }}
                    >
                      {applyValorizadaSaving ? "Aplicando…" : "Cargar última plantilla valorizada"}
                    </button>
                  </>
                )}
              </div>
            )}
            {isMarginQuote && versionDetail?.status === "BORRADOR" && canEdit && marginLatestSnapshot === null && (
              <p className="mt-2 w-full basis-full text-xs text-slate-500 dark:text-slate-400">
                No tiene plantillas valorizadas guardadas todavía. Cuando tenga una jerarquía lista en otra cotización con
                margen, use &quot;Guardar plantilla valorizada&quot; para poder reutilizarla aquí.
              </p>
            )}
          </div>
          {(versionDetail.mainItems?.length ?? 0) === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-600 dark:text-slate-400">
              <p className="font-medium text-slate-700 dark:text-slate-300">Sin ítems principales todavía</p>
              <p className="mt-2 max-w-lg mx-auto">
                {canEdit
                  ? "Las cotizaciones con margen usan la misma jerarquía que las normales. Pulse Crear ítem principal para el primer grupo y luego Agregar subitem en cada bloque."
                  : "Esta versión no tiene grupos definidos."}
              </p>
            </div>
          ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-600">
            {(versionDetail.mainItems ?? []).map((mainItem) => {
              const isExpanded = expandedMainIds.has(mainItem.id);
              const totalModeLabel =
                QUOTE_MAIN_ITEM_TOTAL_MODE_LABEL[mainItem.totalMode] ?? mainItem.totalMode;
              const mainNameTrim = (mainItem.name ?? "").trim();
              return (
                <div
                  key={mainItem.id}
                  className="rounded-lg border border-slate-200 bg-white dark:border-slate-600 dark:bg-slate-800"
                >
                  {/* Encabezado del grupo (ítem principal) */}
                  <div className="flex items-start gap-2.5 border-l-4 border-amber-500/70 bg-slate-50/80 px-4 py-2.5 dark:border-amber-500/50 dark:bg-slate-800/80">
                    <button
                      type="button"
                      onClick={() => toggleMainItemExpanded(mainItem.id)}
                      className="shrink-0 pt-0.5 text-left text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-expanded={isExpanded}
                    >
                      <span aria-hidden>{isExpanded ? "▼" : "▶"}</span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Grupo
                      </span>
                      {editingMainBlockId === mainItem.id && versionId ? (
                        <MainItemBlockHeaderForm
                          key={mainItem.id}
                          quoteId={quote.id}
                          versionId={versionId}
                          mainItem={mainItem}
                          onSaved={() => {
                            setEditingMainBlockId(null);
                            setActionError(null);
                            onRefreshVersion();
                          }}
                          onCancel={() => setEditingMainBlockId(null)}
                        />
                      ) : (
                        <>
                      <div className="mt-0.5 text-[15px] font-medium leading-snug text-slate-900 dark:text-slate-100">{mainItem.name}</div>
                      {mainItem.description && (
                        <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{mainItem.description}</div>
                      )}
                      {isMarginQuote && mainItem.marginBlockEconomics && (
                        <div
                          className="mt-2 rounded-md border border-violet-200/90 bg-violet-50/90 px-3 py-2 dark:border-violet-800/60 dark:bg-violet-950/30"
                          role="group"
                          aria-label="Resumen económico del bloque"
                        >
                          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
                            Bloque (suma de líneas · venta = total del grupo)
                          </p>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                            <div>
                              <dt className="text-slate-500 dark:text-slate-400">Costo</dt>
                              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                $ {formatMoney(mainItem.marginBlockEconomics.blockCostTotal, "")}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-500 dark:text-slate-400">Venta</dt>
                              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                $ {formatMoney(mainItem.marginBlockEconomics.blockSaleTotal, "")}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-500 dark:text-slate-400">Utilidad</dt>
                              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                $ {formatMoney(mainItem.marginBlockEconomics.blockUtility, "")}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-slate-500 dark:text-slate-400">Margen</dt>
                              <dd className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                                {mainItem.marginBlockEconomics.blockMarginPercent != null
                                  ? `${Number(mainItem.marginBlockEconomics.blockMarginPercent).toFixed(2)} %`
                                  : "—"}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          Total: <span className="inline-flex whitespace-nowrap">$ {formatMoney(mainItem.total, "")}</span>
                        </span>
                        <span className="inline-flex rounded bg-slate-200/80 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                          {totalModeLabel}
                        </span>
                        <span
                          className={
                            mainItem.visibleInFinalQuote
                              ? "inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                              : "inline-flex rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          }
                        >
                          {mainItem.visibleInFinalQuote ? "Visible en PDF" : "Oculto en PDF"}
                        </span>
                      </div>
                        </>
                      )}
                    </div>
                    {canEdit && versionId && (
                      <div className="relative flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-start">
                        {editingMainBlockId !== mainItem.id && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenAddDropdownMainId(null);
                                setEditingMainBlockId(mainItem.id);
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap"
                            >
                              Editar bloque
                            </button>
                            <button
                              type="button"
                              disabled={duplicatingMainItemId === mainItem.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenAddDropdownMainId(null);
                                void marginLineInline.flushPending().then((ok) => {
                                  if (!ok || !versionId) return;
                                  setActionError(null);
                                  setDuplicatingMainItemId(mainItem.id);
                                  duplicateMainItem(quote.id, versionId, mainItem.id)
                                    .then(() => onRefreshVersion())
                                    .catch((err) =>
                                      setActionError(
                                        err instanceof Error ? err.message : "Error al duplicar bloque",
                                      ),
                                    )
                                    .finally(() => setDuplicatingMainItemId(null));
                                });
                              }}
                              className="btn-secondary px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50"
                              title="Copia el grupo y todas sus líneas al final de la cotización"
                            >
                              {duplicatingMainItemId === mainItem.id ? "Duplicando…" : "Duplicar bloque"}
                            </button>
                          </>
                        )}
                        <div className="relative" ref={openAddDropdownMainId === mainItem.id ? addDropdownRef : undefined}>
                        <button
                          type="button"
                          disabled={editingMainBlockId === mainItem.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenAddDropdownMainId((prev) => (prev === mainItem.id ? null : mainItem.id));
                          }}
                          className="btn-primary px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Agregar subitem ▾
                        </button>
                        {openAddDropdownMainId === mainItem.id && (
                          <div className="absolute right-0 top-full z-20 mt-1 min-w-[12rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-800">
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                              onClick={() => {
                                setMainItemIdForLine(mainItem.id);
                                setModalAddManual(true);
                                setOpenAddDropdownMainId(null);
                              }}
                            >
                              Línea manual
                            </button>
                            <button
                              type="button"
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
                              onClick={() => {
                                setMainItemIdForLine(mainItem.id);
                                setModalAddProduct(true);
                                setOpenAddDropdownMainId(null);
                              }}
                            >
                              Desde catálogo
                            </button>
                          </div>
                        )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Subitems (líneas) del grupo */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-slate-700">
                      <div className="overflow-x-auto pl-3 md:pl-4">
                        <table className="min-w-[860px] w-full text-left text-sm">
                          <thead className="border-b border-slate-200 bg-slate-100/60 dark:border-slate-700 dark:bg-slate-700/40">
                            <tr>
                              <th className="py-2 pl-2 pr-4 font-medium text-slate-600 dark:text-slate-400 md:pl-4">Subitem / Descripción</th>
                              <th className="px-4 py-2 font-medium text-slate-600 dark:text-slate-400">Origen</th>
                              <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Cant.</th>
                              <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">P. unit.</th>
                              {isMarginQuote && (
                                <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">C. unit.</th>
                              )}
                              {isMarginQuote && (
                                <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Costo línea</th>
                              )}
                              {isMarginQuote && (
                                <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Utilidad</th>
                              )}
                              {isMarginQuote && (
                                <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Margen %</th>
                              )}
                              <th className="px-4 py-2 font-medium text-slate-600 text-right whitespace-nowrap">Total venta</th>
                              {canEdit && <th className="px-4 py-2 font-medium text-slate-600 w-28">En PDF</th>}
                                  {canEdit && <th className="px-4 py-2 font-medium text-slate-600 min-w-[9rem]">Acciones</th>}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {mainItem.lines.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={canEdit ? (isMarginQuote ? 11 : 7) : isMarginQuote ? 9 : 5}
                                  className="py-3 pl-2 text-center text-sm text-slate-500 md:pl-4"
                                >
                                  Sin subitems. Use <strong>Agregar subitem</strong> para añadir una línea manual o desde catálogo.
                                </td>
                              </tr>
                            ) : (
                              mainItem.lines.map((line) => {
                                const lineNameTrim = (line.productNameSnapshot ?? "").trim();
                                const sameAsGroup = mainNameTrim && lineNameTrim && mainNameTrim === lineNameTrim;
                                const desc = (line.productDescriptionSnapshot ?? "").trim();
                                const primaryText = sameAsGroup && desc ? desc : sameAsGroup ? "(mismo que el grupo)" : line.productNameSnapshot;
                                const secondaryText = sameAsGroup && desc ? "(mismo nombre que el grupo)" : sameAsGroup ? line.productNameSnapshot : line.productDescriptionSnapshot;
                                return (
                                <tr key={line.id} className="bg-white dark:bg-slate-800">
                                  <td className="py-2 pl-2 pr-4 md:pl-4">
                                    <div className={primaryText === "(mismo que el grupo)" ? "text-sm italic text-slate-500 dark:text-slate-400" : "font-medium text-slate-800 dark:text-slate-100"}>
                                      {primaryText}
                                    </div>
                                    {secondaryText && (
                                      <div className="text-xs text-slate-500 dark:text-slate-400">{secondaryText}</div>
                                    )}
                                  </td>
                                  <td className="px-4 py-2">
                                    <span
                                      className={
                                        line.productId
                                          ? "inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                                          : "inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                                      }
                                    >
                                      {line.productId
                                        ? QUOTE_ITEM_ORIGIN_LABEL.FROM_CATALOG
                                        : QUOTE_ITEM_ORIGIN_LABEL.MANUAL}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2 text-right whitespace-nowrap">
                                    {canEdit && isMarginQuote && versionId ? (
                                      <MarginInlineLineCell
                                        field="quantity"
                                        lineId={line.id}
                                        active={marginLineInline.isActive(line.id, "quantity")}
                                        displayContent={line.quantity}
                                        draft={
                                          marginLineInline.edit?.lineId === line.id &&
                                          marginLineInline.edit.field === "quantity"
                                            ? marginLineInline.edit.draft
                                            : String(line.quantity)
                                        }
                                        error={
                                          marginLineInline.isActive(line.id, "quantity")
                                            ? marginLineInline.error
                                            : null
                                        }
                                        saving={marginLineInline.savingLineId === line.id}
                                        disabled={
                                          marginLineInline.savingLineId !== null ||
                                          duplicatingLineId === line.id ||
                                          togglingLineId === line.id
                                        }
                                        onActivate={() => void marginLineInline.activate(line, "quantity")}
                                        onDraftChange={marginLineInline.setDraft}
                                        onBlur={marginLineInline.handleBlur}
                                        onEnter={marginLineInline.handleEnter}
                                        onEscape={marginLineInline.cancelWithSkipBlur}
                                      />
                                    ) : (
                                      line.quantity
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    {canEdit && isMarginQuote && versionId ? (
                                      <MarginInlineLineCell
                                        field="unitPrice"
                                        lineId={line.id}
                                        active={marginLineInline.isActive(line.id, "unitPrice")}
                                        displayContent={
                                          <span className="inline-flex whitespace-nowrap">
                                            $ {formatMoney(line.unitPriceSnapshot, "")}
                                          </span>
                                        }
                                        draft={
                                          marginLineInline.edit?.lineId === line.id &&
                                          marginLineInline.edit.field === "unitPrice"
                                            ? marginLineInline.edit.draft
                                            : String(
                                                typeof line.unitPriceSnapshot === "number"
                                                  ? line.unitPriceSnapshot
                                                  : Number(line.unitPriceSnapshot),
                                              )
                                        }
                                        error={
                                          marginLineInline.isActive(line.id, "unitPrice")
                                            ? marginLineInline.error
                                            : null
                                        }
                                        saving={marginLineInline.savingLineId === line.id}
                                        disabled={
                                          marginLineInline.savingLineId !== null ||
                                          duplicatingLineId === line.id ||
                                          togglingLineId === line.id
                                        }
                                        onActivate={() => void marginLineInline.activate(line, "unitPrice")}
                                        onDraftChange={(v) =>
                                          marginLineInline.setDraft(
                                            currency === "CLP" ? onMoneyIntegerInputChange(v) : v,
                                          )
                                        }
                                        onBlur={marginLineInline.handleBlur}
                                        onEnter={marginLineInline.handleEnter}
                                        onEscape={marginLineInline.cancelWithSkipBlur}
                                        inputClassName="min-w-[6.5rem] w-28"
                                      />
                                    ) : (
                                      <span className="inline-flex whitespace-nowrap">
                                        $ {formatMoney(line.unitPriceSnapshot, "")}
                                      </span>
                                    )}
                                  </td>
                                  {isMarginQuote && (
                                    <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                                      {canEdit && versionId ? (
                                        <MarginInlineLineCell
                                          field="unitCost"
                                          lineId={line.id}
                                          active={marginLineInline.isActive(line.id, "unitCost")}
                                          displayContent={
                                            line.unitCostSnapshot != null ? (
                                              <span className="inline-flex whitespace-nowrap">
                                                $ {formatMoney(line.unitCostSnapshot, "")}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 dark:text-slate-500">—</span>
                                            )
                                          }
                                          draft={
                                            marginLineInline.edit?.lineId === line.id &&
                                            marginLineInline.edit.field === "unitCost"
                                              ? marginLineInline.edit.draft
                                              : line.unitCostSnapshot != null
                                                ? String(
                                                    typeof line.unitCostSnapshot === "number"
                                                      ? line.unitCostSnapshot
                                                      : Number(line.unitCostSnapshot),
                                                  )
                                                : ""
                                          }
                                          error={
                                            marginLineInline.isActive(line.id, "unitCost")
                                              ? marginLineInline.error
                                              : null
                                          }
                                          saving={marginLineInline.savingLineId === line.id}
                                          disabled={
                                            marginLineInline.savingLineId !== null ||
                                            duplicatingLineId === line.id ||
                                            togglingLineId === line.id
                                          }
                                          onActivate={() => void marginLineInline.activate(line, "unitCost")}
                                          onDraftChange={(v) =>
                                            marginLineInline.setDraft(
                                              currency === "CLP" ? onMoneyIntegerInputChange(v) : v,
                                            )
                                          }
                                          onBlur={marginLineInline.handleBlur}
                                          onEnter={marginLineInline.handleEnter}
                                          onEscape={marginLineInline.cancelWithSkipBlur}
                                          inputClassName="min-w-[6.5rem] w-28"
                                          placeholder="Vacío = sin costo"
                                        />
                                      ) : line.unitCostSnapshot != null ? (
                                        <span>$ {formatMoney(line.unitCostSnapshot, "")}</span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  )}
                                  {isMarginQuote && (
                                    <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                                      {line.lineCostTotal != null ? (
                                        <span>$ {formatMoney(line.lineCostTotal, "")}</span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  )}
                                  {isMarginQuote && (
                                    <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                                      {line.lineUtility != null ? (
                                        <span>$ {formatMoney(line.lineUtility, "")}</span>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                  )}
                                  {isMarginQuote && (
                                    <td className="px-4 py-2 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                                      {line.lineMarginPercent != null && line.lineMarginPercent !== undefined
                                        ? `${Number(line.lineMarginPercent).toFixed(2)} %`
                                        : "—"}
                                    </td>
                                  )}
                                  <td className="px-4 py-2 text-right font-medium">
                                    <span className="inline-flex whitespace-nowrap">$ {formatMoney(line.lineTotalSnapshot, "")}</span>
                                  </td>
                                  {canEdit && (
                                    <td className="px-4 py-2">
                                      <button
                                        type="button"
                                        disabled={togglingLineId === line.id}
                                        onClick={() => {
                                          void marginLineInline.flushPending().then((ok) => {
                                            if (!ok) return;
                                            setActionError(null);
                                            setTogglingLineId(line.id);
                                            updateLine(quote.id, versionId!, line.id, {
                                              visibleInFinalQuote: !line.visibleInFinalQuote,
                                            })
                                              .then(() => onRefreshVersion())
                                              .catch((e) =>
                                                setActionError(e instanceof Error ? e.message : "Error al actualizar visibilidad"),
                                              )
                                              .finally(() => setTogglingLineId(null));
                                          });
                                        }}
                                        className={`inline-flex rounded px-2 py-1 text-xs font-medium transition-opacity ${
                                          line.visibleInFinalQuote
                                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200"
                                            : "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-200"
                                        } ${togglingLineId === line.id ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
                                        title={line.visibleInFinalQuote ? "Clic para ocultar en PDF" : "Clic para mostrar en PDF"}
                                      >
                                        {togglingLineId === line.id ? "…" : line.visibleInFinalQuote ? "Visible en PDF" : "Oculto en PDF"}
                                      </button>
                                    </td>
                                  )}
                                  {canEdit && (
                                    <td className="px-4 py-2">
                                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                                        <button
                                          type="button"
                                        onClick={() => {
                                          void marginLineInline.flushPending().then((ok) => {
                                            if (!ok) return;
                                            setEditingLine(line);
                                            setModalEditLine(true);
                                          });
                                        }}
                                          className="text-amber-600 hover:text-amber-700"
                                        >
                                          Editar
                                        </button>
                                        <button
                                          type="button"
                                          disabled={duplicatingLineId === line.id}
                                          onClick={() => {
                                            void marginLineInline.flushPending().then((ok) => {
                                              if (!ok) return;
                                              setActionError(null);
                                              setDuplicatingLineId(line.id);
                                              duplicateLine(quote.id, versionId!, line.id)
                                                .then(() => onRefreshVersion())
                                                .catch((e) =>
                                                  setActionError(e instanceof Error ? e.message : "Error al duplicar línea"),
                                                )
                                                .finally(() => setDuplicatingLineId(null));
                                            });
                                          }}
                                          className="text-slate-600 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
                                          title="Copia la línea al final de este bloque"
                                        >
                                          {duplicatingLineId === line.id ? "…" : "Duplicar"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void marginLineInline.flushPending().then((ok) => {
                                              if (!ok) return;
                                              if (
                                                !confirm(
                                                  `¿Eliminar la línea «${line.productNameSnapshot}»? Esta acción no se puede deshacer.`,
                                                )
                                              ) {
                                                return;
                                              }
                                              setActionError(null);
                                              deleteLine(quote.id, versionId!, line.id)
                                                .then(() => onRefreshVersion())
                                                .catch((e) =>
                                                  setActionError(e instanceof Error ? e.message : "Error al eliminar"),
                                                );
                                            });
                                          }}
                                          className="text-red-600 hover:text-red-700"
                                        >
                                          Eliminar
                                        </button>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

          {/* 4. Tabla de ítems (solo lectura cuando la versión tiene mainItems) */}
          {versionDetail && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-700">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Ítems de la versión
              </h3>
              {(versionDetail.mainItems?.length ?? 0) > 0 && (
                <p className="mt-0.5 text-sm text-amber-700" role="status">
                  Solo lectura. La edición de ítems se realiza en la vista jerárquica de arriba.
                </p>
              )}
            </div>
            {canEdit && (versionDetail.mainItems?.length ?? 0) === 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalAddProduct(true)}
                  className="btn-primary"
                >
                  Agregar desde producto
                </button>
                <button
                  type="button"
                  onClick={() => setModalAddManual(true)}
                  className="btn-secondary"
                >
                  Agregar manual
                </button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            {versionDetail.items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {(versionDetail.mainItems?.length ?? 0) > 0
                  ? "En versiones jerárquicas los ítems se gestionan en la vista de arriba."
                  : "Aún no hay ítems en esta versión. Agregue desde producto o ítem manual."}
              </div>
            ) : (
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-700/50">
                  <tr>
                    <th className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-300">Producto / Descripción</th>
                    <th className="px-5 py-2.5 font-medium text-slate-700 dark:text-slate-300">Origen</th>
                    <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">Cant.</th>
                    <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">P. unit.</th>
                    {isMarginQuote && (
                      <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">C. unit.</th>
                    )}
                    {isMarginQuote && (
                      <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">Costo línea</th>
                    )}
                    {isMarginQuote && (
                      <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">Utilidad</th>
                    )}
                    {isMarginQuote && (
                      <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">Margen %</th>
                    )}
                    <th className="px-5 py-2.5 font-medium text-slate-700 text-right whitespace-nowrap">Total venta</th>
                    {canEdit && (versionDetail.mainItems?.length ?? 0) === 0 && (
                      <th className="px-6 py-3 font-medium text-slate-700 w-24" />
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versionDetail.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/50">
                      <td className="px-5 py-2.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{item.productNameSnapshot}</div>
                        {item.productDescriptionSnapshot && (
                          <div className="text-xs text-slate-500">{item.productDescriptionSnapshot}</div>
                        )}
                      </td>
                      <td className="px-5 py-2.5">
                        <span
                          className={
                            item.productId
                              ? "inline-flex rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800"
                              : "inline-flex rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          }
                        >
                          {item.productId
                            ? QUOTE_ITEM_ORIGIN_LABEL.FROM_CATALOG
                            : QUOTE_ITEM_ORIGIN_LABEL.MANUAL}
                        </span>
                      </td>
                      <td className="px-5 py-2.5 text-right whitespace-nowrap">{item.quantity}</td>
                      <td className="px-5 py-2.5 text-right">
                        <span className="inline-flex whitespace-nowrap">$ {formatMoney(item.unitPriceSnapshot, "")}</span>
                      </td>
                      {isMarginQuote && (
                        <td className="px-5 py-2.5 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {item.unitCostSnapshot != null ? `$ ${formatMoney(item.unitCostSnapshot, "")}` : "—"}
                        </td>
                      )}
                      {isMarginQuote && (
                        <td className="px-5 py-2.5 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {item.lineCostTotal != null ? `$ ${formatMoney(item.lineCostTotal, "")}` : "—"}
                        </td>
                      )}
                      {isMarginQuote && (
                        <td className="px-5 py-2.5 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {item.lineUtility != null ? `$ ${formatMoney(item.lineUtility, "")}` : "—"}
                        </td>
                      )}
                      {isMarginQuote && (
                        <td className="px-5 py-2.5 text-right whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {item.lineMarginPercent != null && item.lineMarginPercent !== undefined
                            ? `${Number(item.lineMarginPercent).toFixed(2)} %`
                            : "—"}
                        </td>
                      )}
                      <td className="px-5 py-2.5 text-right font-medium">
                        <span className="inline-flex whitespace-nowrap">$ {formatMoney(item.lineTotalSnapshot, "")}</span>
                      </td>
                      {canEdit && (versionDetail.mainItems?.length ?? 0) === 0 && (
                        <td className="px-5 py-2.5">
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => openEditItem(item)}
                              className="text-amber-600 hover:text-amber-700"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item)}
                              className="text-red-600 hover:text-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          </div>
          )}

        </div>

        {/* 5. Columna lateral derecha: Resumen económico + Estado/Versión + Acciones (sticky unificado) */}
        <div className="w-full min-h-0 flex flex-col">
          <div className="xl:sticky xl:top-20 self-start flex w-full flex-col gap-3">
            {versionDetail && (
              <>
                <div className="card p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                      Resumen económico — Versión {versionDetail.versionNumber}
                    </h3>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => setModalEditVersion(true)}
                        className="text-sm font-medium text-amber-600 hover:text-amber-700"
                      >
                        Editar parámetros
                      </button>
                    )}
                  </div>

                  {isMarginQuote && versionDetail.marginEconomicsSummary && (
                    <div className="mb-4 rounded-lg border border-violet-200 bg-violet-50/60 p-3 text-sm dark:border-violet-800 dark:bg-violet-950/20">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-violet-800 dark:text-violet-300">
                        Economía MARGIN (antes de IVA)
                      </p>
                      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">Costo total (líneas)</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">
                            $ {formatMoney(versionDetail.marginEconomicsSummary.costTotal, "")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">Venta neta (subtotal − desc.)</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">
                            $ {formatMoney(versionDetail.marginEconomicsSummary.saleNetBeforeTax, "")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">Utilidad total</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">
                            $ {formatMoney(versionDetail.marginEconomicsSummary.utilityTotal, "")}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-slate-500 dark:text-slate-400">Margen % sobre venta neta</dt>
                          <dd className="font-medium text-slate-900 dark:text-slate-100">
                            {versionDetail.marginEconomicsSummary.marginPercentOnSaleNet != null
                              ? `${Number(versionDetail.marginEconomicsSummary.marginPercentOnSaleNet).toFixed(2)} %`
                              : "—"}
                          </dd>
                        </div>
                      </dl>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        IVA y total final siguen la misma lógica que en cotización STANDARD.
                      </p>
                    </div>
                  )}
                  <dl className="grid grid-cols-1 gap-x-5 gap-y-2.5 sm:grid-cols-3 sm:gap-x-6">
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Subtotal neto</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        <span className="inline-flex whitespace-nowrap">$ {formatMoney(versionDetail.subtotal, "")}</span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">IVA ({versionDetail.vatPercent}%)</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        <span className="inline-flex whitespace-nowrap">$ {formatMoney(versionDetail.taxesTotal, "")}</span>
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500 dark:text-slate-400">Total final</dt>
                      <dd className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                        <span className="inline-flex whitespace-nowrap">$ {formatMoney(versionDetail.total, "")}</span>
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                    Moneda: {currency}
                  </p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <dl className="grid gap-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Estado comercial</dt>
                      <dd>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${quoteCommercialStatusBadgeClass(quoteStatus)}`}
                          title={
                            quoteStatus === "ARCHIVADA"
                              ? "Archivada: fuera de la bandeja activa; datos conservados."
                              : quoteStatus === "ANULADA"
                                ? "Anulada o cancelada; ya no cuenta como oportunidad activa."
                                : undefined
                          }
                        >
                          {COMMERCIAL_STATUS_LABELS[quoteStatus] ?? quoteStatus}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Estado de versión</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">
                        {STATUS_LABELS[versionDetail.status] ?? versionDetail.status}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-500">Versión</dt>
                      <dd className="font-medium text-slate-900 dark:text-slate-100">{versionDetail.versionNumber}</dd>
                    </div>
                  </dl>
                  {canEdit && (
                    <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                        Gestionar estado comercial
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          className="input-field text-sm"
                          value={commercialStatus}
                          onChange={(e) => setCommercialStatus(e.target.value)}
                          disabled={savingCommercialStatus}
                        >
                          {COMMERCIAL_STATUS_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                              {COMMERCIAL_STATUS_LABELS[value] ?? value}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleSaveCommercialStatus}
                          disabled={savingCommercialStatus || commercialStatus === savedCommercialStatus}
                          className="inline-flex shrink-0 justify-center rounded-lg border border-amber-500 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                        >
                          {savingCommercialStatus ? "Guardando..." : "Guardar"}
                        </button>
                      </div>
                      {commercialStatusError && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{commercialStatusError}</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Panel Acciones de cotización — mismo estándar visual, siempre visible */}
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Acciones de cotización
              </h3>
              <div className="flex flex-col gap-2">
                {canEdit && (
                  <Link
                    href={`/cotizaciones/${quote.id}/editar`}
                    className="inline-flex justify-center rounded-lg border border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                  >
                    Editar cotización
                  </Link>
                )}
                {versionId && (
                  <Link
                    href={`/cotizaciones/${quote.id}/vista-previa?versionId=${versionId}`}
                    className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    Vista previa
                  </Link>
                )}
                {versionId && !fromStudy && fvCalculation && (
                  <button
                    type="button"
                    onClick={() => setModalCalculoFv(true)}
                    className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  >
                    Ver cálculo FV (legado)
                  </button>
                )}
                {versionId && !fromStudy && !fvCalculation && canCreateFvStudy && (
                  <Link
                    href={`/estudios-fv/nuevo?clientId=${encodeURIComponent(quote.clientId)}&quoteId=${encodeURIComponent(quote.id)}`}
                    className="inline-flex justify-center rounded-lg border border-amber-500 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
                  >
                    Estudio FV e implementación
                  </Link>
                )}
                {versionId && fromStudy && (
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                    Cálculo FV desde estudio vinculado. Edite el estudio para cambiar el resumen.
                  </p>
                )}
                <Link
                  href="/cotizaciones"
                  className="inline-flex justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Volver al listado
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen ejecutivo — cierre de lectura (técnico, energético y económico) */}
      <CotizacionResumenEjecutivo
        quote={quote}
        versionDetail={versionDetail}
        fvStudySummary={fvStudySummary}
        fvCalculation={fvCalculation}
      />

      {/* Modales */}
      <ModalAgregarProducto
        open={modalAddProduct}
        onClose={() => {
          setModalAddProduct(false);
          setMainItemIdForLine(null);
        }}
        quoteId={quote.id}
        versionId={versionId!}
        currency={currency}
        canPriceOverride={canPriceOverride}
        onSuccess={onRefreshVersion}
        mainItemId={mainItemIdForLine ?? undefined}
      />
      <ModalAgregarManual
        open={modalAddManual}
        onClose={() => {
          setModalAddManual(false);
          setMainItemIdForLine(null);
        }}
        quoteId={quote.id}
        versionId={versionId!}
        defaultCurrency={currency}
        onSuccess={onRefreshVersion}
        mainItemId={mainItemIdForLine ?? undefined}
        isMarginQuote={isMarginQuote}
      />
      <ModalCrearPrincipal
        open={modalCrearPrincipal}
        onClose={() => setModalCrearPrincipal(false)}
        quoteId={quote.id}
        versionId={versionId!}
        onSuccess={onRefreshVersion}
      />
      <Modal
        open={modalSaveValorizada}
        onClose={() => {
          if (!saveValorizadaSaving) setModalSaveValorizada(false);
        }}
        title="Guardar plantilla valorizada"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Se guardará la jerarquía actual (bloques y líneas con precios, costos y totales) como su última plantilla
            valorizada reutilizable. No modifica los parámetros técnicos base de la cotización.
          </p>
          <div>
            <label htmlFor="save-valorizada-name" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre *
            </label>
            <input
              id="save-valorizada-name"
              type="text"
              value={saveValorizadaName}
              onChange={(e) => setSaveValorizadaName(e.target.value)}
              className="input-field w-full"
              maxLength={200}
              disabled={saveValorizadaSaving}
            />
          </div>
          <div>
            <label
              htmlFor="save-valorizada-desc"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Descripción (opcional)
            </label>
            <textarea
              id="save-valorizada-desc"
              value={saveValorizadaDescription}
              onChange={(e) => setSaveValorizadaDescription(e.target.value)}
              rows={2}
              className="input-field w-full"
              maxLength={2000}
              disabled={saveValorizadaSaving}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              className="btn-secondary"
              disabled={saveValorizadaSaving}
              onClick={() => setModalSaveValorizada(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary bg-violet-600 hover:bg-violet-700"
              disabled={saveValorizadaSaving || !versionId || !saveValorizadaName.trim()}
              onClick={() => {
                if (!versionId) return;
                setSaveValorizadaSaving(true);
                setActionError(null);
                void createMarginTemplateSnapshotFromVersion(quote.id, versionId, {
                  name: saveValorizadaName.trim(),
                  description: saveValorizadaDescription.trim() || undefined,
                })
                  .then((created) => {
                    setMarginLatestSnapshot(created);
                    setModalSaveValorizada(false);
                    onRefreshVersion();
                  })
                  .catch((e) => {
                    setActionError(e instanceof Error ? e.message : "Error al guardar plantilla valorizada");
                  })
                  .finally(() => setSaveValorizadaSaving(false));
              }}
            >
              {saveValorizadaSaving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={modalApplyCleanMargin}
        onClose={() => {
          if (!applyCleanMarginSaving) setModalApplyCleanMargin(false);
        }}
        title="Cargar plantilla limpia MARGIN"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Crea bloques y subítems desde la plantilla base del sistema. No modifica los parámetros técnicos base que ya guardó
            en la cotización (referencia, tipo de sistema, montaje, etc.).
          </p>
          <div>
            <label htmlFor="clean-margin-system" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo de sistema
            </label>
            <select
              id="clean-margin-system"
              value={cleanMarginSystemType}
              onChange={(e) => setCleanMarginSystemType(e.target.value as "ON_GRID" | "HYBRID" | "OFF_GRID")}
              className="input-field w-full"
              disabled={applyCleanMarginSaving}
            >
              <option value="ON_GRID">On grid</option>
              <option value="HYBRID">Híbrido</option>
              <option value="OFF_GRID">Off grid</option>
            </select>
          </div>
          <div>
            <label
              htmlFor="clean-margin-mount"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Tipo de estructura de montaje
            </label>
            <select
              id="clean-margin-mount"
              value={cleanMarginMountStructureType}
              onChange={(e) =>
                setCleanMarginMountStructureType(e.target.value as "STANDARD" | "ANGULAR" | "MIXTA")
              }
              className="input-field w-full"
              disabled={applyCleanMarginSaving}
            >
              <option value="STANDARD">Estructura estándar</option>
              <option value="ANGULAR">Estructura angular (incluye base + angular)</option>
              <option value="MIXTA">Mixta (base + angular)</option>
            </select>
          </div>
          {(versionDetail?.mainItems?.length ?? 0) > 0 && (
            <div
              className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200"
              role="status"
            >
              Esta versión ya tiene {versionDetail!.mainItems!.length} bloque(s). Al aplicar se reemplazará toda la
              jerarquía; confirme en el siguiente paso.
            </div>
          )}
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button
              type="button"
              className="btn-secondary"
              disabled={applyCleanMarginSaving}
              onClick={() => setModalApplyCleanMargin(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={applyCleanMarginSaving || !versionId}
              onClick={() => {
                if (!versionId) return;
                const hasHierarchy = (versionDetail?.mainItems?.length ?? 0) > 0;
                if (hasHierarchy) {
                  if (
                    !window.confirm(
                      "¿Reemplazar toda la jerarquía existente por la plantilla limpia? Esta acción no se puede deshacer.",
                    )
                  ) {
                    return;
                  }
                }
                setApplyCleanMarginSaving(true);
                setActionError(null);
                void applyCleanMarginHierarchy(quote.id, versionId, {
                  systemType: cleanMarginSystemType,
                  mountStructureType: cleanMarginMountStructureType,
                  replaceExisting: hasHierarchy,
                })
                  .then(() => {
                    setModalApplyCleanMargin(false);
                    onRefreshVersion();
                  })
                  .catch((e) => {
                    setActionError(e instanceof Error ? e.message : "Error al cargar plantilla limpia");
                  })
                  .finally(() => setApplyCleanMarginSaving(false));
              }}
            >
              {applyCleanMarginSaving ? "Aplicando…" : "Aplicar plantilla"}
            </button>
          </div>
        </div>
      </Modal>
      <ModalEditarLinea
        open={modalEditLine}
        onClose={() => {
          setModalEditLine(false);
          setEditingLine(null);
        }}
        quoteId={quote.id}
        versionId={versionId!}
        line={editingLine}
        onSuccess={onRefreshVersion}
        isMarginQuote={isMarginQuote}
      />
      <ModalEditarItem
        open={modalEditItem}
        onClose={closeEditItem}
        quoteId={quote.id}
        versionId={versionId!}
        item={editingItem}
        canPriceOverride={canPriceOverride}
        onSuccess={onRefreshVersion}
        isMarginQuote={isMarginQuote}
      />
      <ModalEditarVersion
        open={modalEditVersion}
        onClose={() => setModalEditVersion(false)}
        quoteId={quote.id}
        version={versionDetail}
        onSuccess={onRefreshVersion}
      />
      <CalculoFvModal
        open={modalCalculoFv}
        onClose={() => setModalCalculoFv(false)}
        quoteId={quote.id}
        versionId={versionId}
        quoteTitle={quote.title}
        defaultCurrency={currency}
        onSaved={() => {
          fetchFvCalculation(quote.id, versionId ?? undefined)
            .then(setFvCalculation)
            .catch(() => setFvCalculation(null));
        }}
      />
      <Modal
        open={modalEditCommercial}
        onClose={() => {
          setModalEditCommercial(false);
          setClientEditError(null);
        }}
        title="Datos comerciales y de contacto"
        maxWidth="xl"
      >
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-600 dark:bg-slate-800/50">
          <p className="font-medium text-slate-800 dark:text-slate-200">Qué edita cada parte</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600 dark:text-slate-400">
            <li>
              <strong>Cotización</strong> (abajo): título, tipo de proyecto, vendedor asignado, validez,
              plazos, notas de la cotización, etc.
            </li>
            <li>
              <strong>Cliente</strong>: RUT, correo, teléfono, dirección y notas del cliente (ficha
              maestra compartida).
            </li>
          </ul>
          {canEditClient && (
            <button
              type="button"
              disabled={clientEditLoading}
              onClick={() => {
                setClientEditError(null);
                setClientEditLoading(true);
                fetchClient(quote.clientId)
                  .then((c) => {
                    setClientForEdit(c);
                    setModalEditClient(true);
                  })
                  .catch((e) =>
                    setClientEditError(
                      e instanceof Error ? e.message : "No se pudo cargar el cliente",
                    ),
                  )
                  .finally(() => setClientEditLoading(false));
              }}
              className="btn-secondary mt-3 disabled:opacity-50"
            >
              {clientEditLoading ? "Cargando cliente…" : "Editar ficha del cliente…"}
            </button>
          )}
          {clientEditError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {clientEditError}
            </p>
          )}
        </div>
        <CotizacionForm
          key={`${quote.id}-${quote.updatedAt}-${quote.salespersonId ?? ""}-${quote.client?.taxId ?? ""}-${quote.client?.email ?? ""}`}
          mode="edit"
          initial={quote}
          onSubmit={async (data) => {
            await updateQuote(quote.id, data);
            await onQuoteRefresh();
            setModalEditCommercial(false);
          }}
        />
      </Modal>
      <Modal
        open={modalEditClient && clientForEdit != null}
        onClose={() => {
          setModalEditClient(false);
          setClientForEdit(null);
        }}
        title="Ficha del cliente"
        maxWidth="xl"
      >
        {clientForEdit && (
          <ClienteForm
            key={`${clientForEdit.id}-${clientForEdit.updatedAt}`}
            mode="edit"
            initial={clientForEdit}
            onCancel={() => {
              setModalEditClient(false);
              setClientForEdit(null);
            }}
            onSubmit={async (data) => {
              await updateClient(clientForEdit.id, data);
              await onQuoteRefresh();
              setModalEditClient(false);
              setClientForEdit(null);
            }}
          />
        )}
      </Modal>
      <ShareToChatModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        entityType="QUOTE"
        title={quote.title}
        sourceEntityId={quote.id}
        snapshot={{
          id: quote.id,
          commercialNumber: quote.commercialNumber,
          title: quote.title,
          clientName: quote.client?.name ?? null,
          currency: quote.currency,
          quoteKind: quote.quoteKind,
          status: quote.status,
        }}
        proposedImport={{
          quoteId: quote.id,
          mode: "REFERENCE_ONLY",
        }}
      />
    </div>
  );
}

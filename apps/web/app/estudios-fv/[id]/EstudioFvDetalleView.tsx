"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCan } from "../../../lib/useCan";
import { formatDate } from "../../../lib/format";
import {
  archiveFvStudy,
  createQuoteFromFvStudy,
  deleteFvStudy,
  fetchImplantationDesign,
  fetchImplantationScreenshotBlob,
  fetchQuotes,
  type FvStudy,
  type ImplantationDesign,
  type QuoteListItem,
} from "../../../lib/api";
import { COMMERCIAL_STATUS_LABELS } from "../../cotizaciones/constants";
import { EstudioFvKpis } from "../EstudioFvKpis";
import { EstudioFvTablaMensual } from "../EstudioFvTablaMensual";
import { EstudioFvGraficos } from "../EstudioFvGraficos";
import { EstudioFvInformeEjecutivo } from "../EstudioFvInformeEjecutivo";
import { GENERATION_SOURCE_LABELS, getMountingBusinessLabel, MOUNTING_TYPE_OPTIONS } from "../constants";
import { MARGIN_SYSTEM_TYPE_LABELS } from "../../../lib/margin-technical-basics";
import { normalizeFvStudySystemType } from "../fvStudySystemType";
import {
  formatSiNo,
  getExecutiveScenarioNarrative,
  getScenarioUserLabel,
  getStudyGridDisplayFlags,
  resolveScenarioFromStudy,
} from "../../../lib/fv-system-scenario";
import { SuccessBanner } from "../../../components/ui/SuccessBanner";
import { Modal } from "../../../components/ui/Modal";
import { ShareEntityToChatModal } from "../../../components/conversations/ShareEntityToChatModal";
import { geoJsonToPolygon } from "./diseno-implantacion/roofPolygonUtils";
import { polygonAreaM2, panelAreaTotalM2 } from "./diseno-implantacion/layoutMetrics";

function formatM2(value: number): string {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  VALIDADO: "Validado",
  COTIZADO: "Cotizado",
  ARCHIVADO: "Archivado",
};

const CONNECTION_LABELS: Record<string, string> = {
  MONOFASICO: "Monofásico",
  TRIFASICO: "Trifásico",
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  RESIDENCIAL: "Residencial",
  COMERCIAL: "Comercial",
  INDUSTRIAL: "Industrial",
};

type Props = {
  study: FvStudy;
  onArchived?: () => void;
};

export function EstudioFvDetalleView({ study, onArchived }: Props) {
  const router = useRouter();
  const canEdit = useCan("edit", "fvStudy");
  const canArchive = useCan("archive", "fvStudy");
  const canDeleteStudy = useCan("delete", "fvStudy");
  const canCreateQuote = useCan("create", "quote");
  const canEditQuote = useCan("edit", "quote");
  const [actionError, setActionError] = useState<string | null>(null);
  const [archiveSuccess, setArchiveSuccess] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deletingStudy, setDeletingStudy] = useState(false);
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [quoteTypeModalOpen, setQuoteTypeModalOpen] = useState(false);
  const [linkedQuotes, setLinkedQuotes] = useState<QuoteListItem[]>([]);
  const [linkedQuotesLoading, setLinkedQuotesLoading] = useState(false);
  const [linkedQuotesError, setLinkedQuotesError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [implantationDesign, setImplantationDesign] = useState<ImplantationDesign | null>(null);
  const [screenshotBlobUrl, setScreenshotBlobUrl] = useState<string | null>(null);
  const screenshotBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!study?.id) return;
    let cancelled = false;
    fetchImplantationDesign(study.id)
      .then((design) => {
        if (cancelled) return;
        setImplantationDesign(design ?? null);
        if (!design?.screenshotUrl) return null;
        return fetchImplantationScreenshotBlob(study.id);
      })
      .then((blob) => {
        if (cancelled || !blob) return;
        const url = URL.createObjectURL(blob);
        if (screenshotBlobUrlRef.current) URL.revokeObjectURL(screenshotBlobUrlRef.current);
        screenshotBlobUrlRef.current = url;
        setScreenshotBlobUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (screenshotBlobUrlRef.current) {
        URL.revokeObjectURL(screenshotBlobUrlRef.current);
        screenshotBlobUrlRef.current = null;
      }
    };
  }, [study?.id]);

  useEffect(() => {
    if (!quoteTypeModalOpen || !study.id) return;
    let cancelled = false;
    setLinkedQuotesLoading(true);
    setLinkedQuotesError(null);
    fetchQuotes({ sourceFvStudyId: study.id, includeInactive: true })
      .then((list) => {
        if (!cancelled) setLinkedQuotes(list);
      })
      .catch(() => {
        if (!cancelled) setLinkedQuotesError("No se pudieron cargar las cotizaciones vinculadas a este estudio.");
      })
      .finally(() => {
        if (!cancelled) setLinkedQuotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteTypeModalOpen, study.id]);

  const isArchived = study.status === "ARCHIVADO";
  const showEdit = canEdit && !isArchived;
  const showArchive = canArchive && !isArchived;

  const gridFlags = getStudyGridDisplayFlags(study);
  const resolvedScenario = resolveScenarioFromStudy(study);
  const modoSistemaLabel = getScenarioUserLabel(resolvedScenario);
  const configuracionRedNarrative = getExecutiveScenarioNarrative(resolvedScenario);

  const handleArchive = async () => {
    if (
      !confirm(
        "¿Archivar este estudio FV?\n\n" +
          "• Quedará solo lectura (no se podrá editar).\n" +
          "• Sigue visible en listados y en cotizaciones que lo referencien.\n\n" +
          "¿Continuar?",
      )
    ) {
      return;
    }
    setArchiving(true);
    setActionError(null);
    setArchiveSuccess(false);
    try {
      await archiveFvStudy(study.id);
      setArchiveSuccess(true);
      onArchived?.();
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "No se pudo archivar el estudio. Revise permisos o estado.",
      );
    } finally {
      setArchiving(false);
    }
  };

  const handleDeleteStudy = async () => {
    if (
      !confirm(
        "¿Eliminar permanentemente este estudio FV?\n\n" +
          "• Se borrarán el estudio, la tabla mensual y el diseño de implantación asociados.\n" +
          "• Las cotizaciones que estaban vinculadas seguirán existiendo; solo dejarán de apuntar a este estudio.\n\n" +
          "Esta acción no se puede deshacer.\n\n" +
          "¿Continuar?",
      )
    ) {
      return;
    }
    setDeletingStudy(true);
    setActionError(null);
    try {
      await deleteFvStudy(study.id);
      router.push("/estudios-fv?success=deleted");
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "No se pudo eliminar el estudio. Revise permisos o dependencias.",
      );
    } finally {
      setDeletingStudy(false);
    }
  };

  return (
    <div className="space-y-6">
      {archiveSuccess && (
        <SuccessBanner
          message="Estudio archivado correctamente. Ya no se puede editar; puede seguir consultándolo o desde cotizaciones vinculadas."
          onDismiss={() => setArchiveSuccess(false)}
        />
      )}
      {isArchived && (
        <div className="rounded-lg border-2 border-slate-400 bg-slate-100 p-4 text-slate-800" role="status">
          <p className="font-semibold">Estudio archivado</p>
          <p className="text-sm">Este estudio está cerrado. No está disponible la edición ni volver a archivarlo.</p>
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          {actionError}
          <button type="button" onClick={() => setActionError(null)} className="ml-2 underline">
            Cerrar
          </button>
        </div>
      )}

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{study.title}</h1>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
                  isArchived
                    ? "bg-slate-300 text-slate-800"
                    : study.status === "VALIDADO"
                    ? "bg-green-100 text-green-800"
                    : study.status === "COTIZADO"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-600 dark:text-slate-300"
                }`}
              >
                {STATUS_LABELS[study.status] ?? study.status}
              </span>
              <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {GENERATION_SOURCE_LABELS[study.generationSource ?? "INTERNAL"] ?? "Estimación interna"}
              </span>
            </div>
            <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              <div>
                <span className="text-slate-500">Cliente:</span>{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{study.client?.name ?? "—"}</span>
              </div>
              <div>
                <span className="text-slate-500">Conexión:</span>{" "}
                {CONNECTION_LABELS[study.connectionType] ?? study.connectionType}
              </div>
              <div>
                <span className="text-slate-500">Tipo proyecto:</span>{" "}
                {PROJECT_TYPE_LABELS[study.tipoProyecto] ?? study.tipoProyecto}
              </div>
              <div>
                <span className="text-slate-500">Tipo de sistema:</span>{" "}
                {MARGIN_SYSTEM_TYPE_LABELS[normalizeFvStudySystemType(study.systemType)] ??
                  study.systemType ??
                  "—"}
              </div>
              <div>
                <span className="text-slate-500">Propietario:</span>{" "}
                {study.owner?.name ?? study.owner?.email ?? "—"}
              </div>
              <div>
                <span className="text-slate-500">Actualizado:</span> {formatDate(study.updatedAt)}
              </div>
            </dl>

            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-600">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Configuración de red
              </h3>
              <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                <div>
                  <span className="text-slate-500">Red disponible:</span>{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatSiNo(gridFlags.utilityGridAvailable)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Inyección a red:</span>{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatSiNo(gridFlags.gridExportEnabled)}
                  </span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500">Modo del sistema:</span>{" "}
                  <span className="font-medium text-slate-800 dark:text-slate-200">{modoSistemaLabel}</span>
                </div>
              </dl>
              {configuracionRedNarrative && (
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {configuracionRedNarrative}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {showEdit && (
              <Link href={`/estudios-fv/${study.id}/editar`} className="btn-primary">
                Editar
              </Link>
            )}
            {showArchive && (
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiving || deletingStudy}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {archiving ? "Archivando…" : "Archivar"}
              </button>
            )}
            {canDeleteStudy && (
              <button
                type="button"
                onClick={handleDeleteStudy}
                disabled={deletingStudy || archiving}
                className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                {deletingStudy ? "Eliminando…" : "Eliminar estudio"}
              </button>
            )}
            <Link href="/estudios-fv" className="btn-secondary">
              Volver al listado
            </Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShareOpen(true)}
            >
              Compartir
            </button>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-slate-800 dark:text-slate-200">Ubicación del proyecto</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Ficha consolidada del proyecto para recurso solar y Explorador Solar.
        </p>
        <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Dirección</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {study.client?.address?.trim() ? study.client.address : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Latitud</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {study.latitude != null && study.latitude !== undefined
                ? String(study.latitude)
                : implantationDesign?.centerLat != null
                  ? String(implantationDesign.centerLat)
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Longitud</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {study.longitude != null && study.longitude !== undefined
                ? String(study.longitude)
                : implantationDesign?.centerLng != null
                  ? String(implantationDesign.centerLng)
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Tipo de panel</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {implantationDesign?.panelNameSnapshot?.trim() ? implantationDesign.panelNameSnapshot : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Inclinación (°)</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {study.tiltDegrees != null && study.tiltDegrees !== undefined ? String(study.tiltDegrees) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500 dark:text-slate-400">Tipo de montaje</dt>
            <dd className="font-medium text-slate-800 dark:text-slate-200">
              {getMountingBusinessLabel(study.mountingType ?? undefined)}
            </dd>
          </div>
        </dl>

        {implantationDesign && (
          <>
            <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Diseño de implantación</h3>
            <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              {(() => {
                const points = geoJsonToPolygon(implantationDesign.roofPolygonGeoJson);
                const roofAreaM2 = points ? polygonAreaM2(points) : 0;
                if (roofAreaM2 > 0) {
                  return (
                    <div>
                      <dt className="text-slate-500 dark:text-slate-400">Área techo / paño (m²)</dt>
                      <dd className="font-medium text-slate-800 dark:text-slate-200">{formatM2(roofAreaM2)}</dd>
                    </div>
                  );
                }
                return null;
              })()}
              {implantationDesign.placements.length > 0 && (
                <>
                  <div>
                    <dt className="text-slate-500 dark:text-slate-400">Cantidad total de paneles</dt>
                    <dd className="font-medium text-slate-800 dark:text-slate-200">
                      {implantationDesign.placements.length}
                    </dd>
                  </div>
                  {implantationDesign.panelLengthMmSnapshot != null &&
                    implantationDesign.panelWidthMmSnapshot != null && (
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">Área paneles (m²)</dt>
                        <dd className="font-medium text-slate-800 dark:text-slate-200">
                          {formatM2(
                            panelAreaTotalM2(
                              implantationDesign.placements.length,
                              implantationDesign.panelLengthMmSnapshot,
                              implantationDesign.panelWidthMmSnapshot,
                            ),
                          )}
                        </dd>
                      </div>
                    )}
                </>
              )}
            </dl>
            {implantationDesign.placements.length > 0 && (() => {
              const byString = new Map<string, number>();
              const angles = new Set<number>();
              for (const p of implantationDesign.placements) {
                const sid = p.stringId?.trim() || "—";
                byString.set(sid, (byString.get(sid) ?? 0) + 1);
                if (p.orientationDeg != null) angles.add(Math.round(p.orientationDeg));
              }
              if (byString.size === 0 && angles.size === 0) return null;
              return (
                <div className="mb-4 space-y-2 text-sm">
                  {byString.size > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Por string: </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {Array.from(byString.entries())
                          .sort(([a], [b]) => (a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b)))
                          .map(([sid, n]) => (sid === "—" ? `Sin asignar: ${n}` : `String ${sid}: ${n}`))
                          .join(" · ")}
                      </span>
                    </div>
                  )}
                  {angles.size > 0 && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Orientación / ángulo: </span>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {Array.from(angles).sort((a, b) => a - b).join("°, ")}°
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
            {screenshotBlobUrl && (
              <div className="mb-4">
                <dt className="mb-1 text-slate-500 dark:text-slate-400">Captura del layout</dt>
                <dd>
                  <img
                    src={screenshotBlobUrl}
                    alt="Vista previa del diseño de implantación"
                    className="max-h-40 w-auto rounded border border-slate-200 object-contain dark:border-slate-600"
                  />
                </dd>
              </div>
            )}
          </>
        )}

        <Link
          href={`/estudios-fv/${study.id}/diseno-implantacion`}
          className="inline-flex items-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
        >
          Abrir diseño de implantación
        </Link>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-slate-800">Recurso solar</h2>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Fuente de generación</dt>
            <dd className="font-medium text-slate-800">
              {GENERATION_SOURCE_LABELS[study.generationSource ?? "INTERNAL"] ?? "Estimación interna"}
            </dd>
          </div>
          {(() => {
            const hasSolarData =
              study.latitude != null ||
              study.longitude != null ||
              study.mountingType != null ||
              study.tiltDegrees != null ||
              study.azimuthDegrees != null ||
              (study.solarResourceProvider != null && study.solarResourceProvider !== "");
            if (!hasSolarData) return null;
            const mountingLabel = MOUNTING_TYPE_OPTIONS.find((o) => o.value === study.mountingType)?.label ?? study.mountingType;
            return (
              <>
              {study.latitude != null && (
                <div>
                  <dt className="text-slate-500">Latitud</dt>
                  <dd className="font-medium text-slate-800">{study.latitude}</dd>
                </div>
              )}
              {study.longitude != null && (
                <div>
                  <dt className="text-slate-500">Longitud</dt>
                  <dd className="font-medium text-slate-800">{study.longitude}</dd>
                </div>
              )}
              {study.mountingType != null && study.mountingType !== "" && (
                <div>
                  <dt className="text-slate-500">Tipo montaje</dt>
                  <dd className="font-medium text-slate-800">{mountingLabel}</dd>
                </div>
              )}
              {study.tiltDegrees != null && (
                <div>
                  <dt className="text-slate-500">Inclinación (°)</dt>
                  <dd className="font-medium text-slate-800">{study.tiltDegrees}</dd>
                </div>
              )}
              {study.azimuthDegrees != null && (
                <div>
                  <dt className="text-slate-500">Azimut (°)</dt>
                  <dd className="font-medium text-slate-800">{study.azimuthDegrees}</dd>
                </div>
              )}
              {study.solarResourceProvider != null && study.solarResourceProvider !== "" && (
                <div>
                  <dt className="text-slate-500">Proveedor recurso</dt>
                  <dd className="font-medium text-slate-800">{study.solarResourceProvider}</dd>
                </div>
              )}
              </>
            );
          })()}
        </dl>
      </div>

      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-slate-800">Resumen técnico-comercial</h2>
        <EstudioFvKpis
          study={study}
          panelCountOverride={
            implantationDesign && implantationDesign.placements.length > 0
              ? implantationDesign.placements.length
              : undefined
          }
        />
      </div>

      {study.months && study.months.length > 0 && (
        <>
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-medium text-slate-800">Tabla mensual</h2>
            <EstudioFvTablaMensual months={study.months} currency={study.currency ?? ""} />
          </div>
          <div className="card p-6">
            <h2 className="mb-4 text-lg font-medium text-slate-800">Gráficos</h2>
            <EstudioFvGraficos
              months={study.months}
              currency={study.currency ?? ""}
              valorKwhConsumo={study.valorKwhConsumo}
              valorKwhInyeccion={study.valorKwhInyeccion}
            />
          </div>
        </>
      )}

      <EstudioFvInformeEjecutivo
        study={study}
        panelCountOverride={
          implantationDesign && implantationDesign.placements.length > 0
            ? implantationDesign.placements.length
            : undefined
        }
      />

      <div className="card border-2 border-slate-200 bg-slate-50/50 p-6 dark:border-slate-600 dark:bg-slate-700/40">
        <h2 className="mb-2 text-lg font-medium text-slate-800">Siguiente paso del flujo</h2>
        <p className="mb-4 text-sm text-slate-600">
          Cree una cotización a partir de este estudio. La cotización quedará vinculada al estudio y el resumen FV se mostrará en la vista previa y PDF.
        </p>
        {canCreateQuote ? (
          <>
            <button
              type="button"
              disabled={creatingQuote}
              onClick={() => {
                setActionError(null);
                setQuoteTypeModalOpen(true);
              }}
              className="btn-primary disabled:opacity-50"
            >
              Crear cotización desde este estudio
            </button>
            <Modal
              open={quoteTypeModalOpen}
              onClose={() => !creatingQuote && setQuoteTypeModalOpen(false)}
              title="Tipo de cotización"
              maxWidth="md"
            >
              <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                Elija cómo desea generar la cotización. La cotización quedará vinculada a este estudio FV.
              </p>
              {(linkedQuotesLoading || linkedQuotesError || linkedQuotes.length > 0) && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-700/60 dark:bg-amber-950/30">
                  {linkedQuotesLoading && (
                    <p className="text-slate-600 dark:text-slate-400">Buscando cotizaciones ya vinculadas…</p>
                  )}
                  {linkedQuotesError && (
                    <p className="text-red-700 dark:text-red-300" role="alert">
                      {linkedQuotesError}
                    </p>
                  )}
                  {!linkedQuotesLoading && linkedQuotes.length > 0 && (
                    <>
                      <p className="font-medium text-slate-800 dark:text-slate-200">
                        Ya existe al menos una cotización asociada a este estudio
                      </p>
                      <p className="mt-1 text-slate-600 dark:text-slate-400">
                        Abra o edite la existente para evitar duplicar, o cree otra con las opciones de abajo si corresponde.
                      </p>
                      <ul className="mt-2 space-y-2 border-t border-amber-200/80 pt-2 dark:border-amber-800/50">
                        {linkedQuotes.map((q) => (
                          <li
                            key={q.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-slate-700 dark:text-slate-300"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                                {q.commercialNumber ?? q.id.slice(0, 8)}
                              </span>
                              <span className="mx-1.5 text-slate-400">·</span>
                              <span className="font-medium">{q.title}</span>
                              <span className="ml-2 text-xs text-slate-500">
                                {COMMERCIAL_STATUS_LABELS[q.status] ?? q.status}
                                {q.quoteKind === "MARGIN" ? " · Margen" : ""}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-wrap gap-2">
                              <Link
                                href={`/cotizaciones/${q.id}`}
                                className="text-sm font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                              >
                                Abrir
                              </Link>
                              {canEditQuote && (
                                <Link
                                  href={`/cotizaciones/${q.id}/editar`}
                                  className="text-sm font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                                >
                                  Editar
                                </Link>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={creatingQuote}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-amber-300 hover:bg-amber-50/80 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-amber-600 dark:hover:bg-slate-700/80"
                  onClick={async () => {
                    setCreatingQuote(true);
                    setActionError(null);
                    try {
                      const { quote, version } = await createQuoteFromFvStudy(study.id, {
                        quoteKind: "STANDARD",
                        createWithSuggestedItems: true,
                      });
                      setQuoteTypeModalOpen(false);
                      router.push(`/cotizaciones/${quote.id}?success=created&versionId=${version.id}`);
                    } catch (e) {
                      setActionError(e instanceof Error ? e.message : "Error al crear cotización");
                    } finally {
                      setCreatingQuote(false);
                    }
                  }}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Estándar</span>
                  <span className="mt-0.5 block text-slate-600 dark:text-slate-400">
                    Cotización clásica con ítems sugeridos según el estudio.
                  </span>
                </button>
                <button
                  type="button"
                  disabled={creatingQuote}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-amber-300 hover:bg-amber-50/80 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-amber-600 dark:hover:bg-slate-700/80"
                  onClick={async () => {
                    setCreatingQuote(true);
                    setActionError(null);
                    try {
                      const { quote, version } = await createQuoteFromFvStudy(study.id, {
                        quoteKind: "MARGIN",
                        createWithSuggestedItems: true,
                      });
                      setQuoteTypeModalOpen(false);
                      router.push(`/cotizaciones/${quote.id}?success=created&versionId=${version.id}`);
                    } catch (e) {
                      setActionError(e instanceof Error ? e.message : "Error al crear cotización");
                    } finally {
                      setCreatingQuote(false);
                    }
                  }}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Por margen</span>
                  <span className="mt-0.5 block text-slate-600 dark:text-slate-400">
                    Misma vinculación al estudio, con estructura de cotización por margen.
                  </span>
                </button>
                <button
                  type="button"
                  disabled={creatingQuote}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-sm shadow-sm transition hover:border-amber-300 hover:bg-amber-50/80 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-amber-600 dark:hover:bg-slate-700/80"
                  onClick={() => {
                    setQuoteTypeModalOpen(false);
                    const q = new URLSearchParams({
                      fvStudyId: study.id,
                      clientId: study.clientId,
                      currency: study.currency || "CLP",
                    });
                    router.push(`/cotizaciones/desde-plantilla?${q.toString()}`);
                  }}
                >
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Desde plantilla</span>
                  <span className="mt-0.5 block text-slate-600 dark:text-slate-400">
                    Elija una plantilla; la cotización se creará ya vinculada a este estudio.
                  </span>
                </button>
              </div>
              {creatingQuote && (
                <p className="mt-4 text-center text-sm text-slate-500">Creando cotización…</p>
              )}
            </Modal>
          </>
        ) : (
          <p className="text-sm text-slate-500">No tiene permiso para crear cotizaciones.</p>
        )}
      </div>
      <ShareEntityToChatModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        entityType="FV_STUDY"
        title={study.title}
        sourceEntityId={study.id}
        snapshot={{
          title: study.title,
          clientName: study.client?.name ?? null,
          status: study.status,
          connectionType: study.connectionType,
          tipoProyecto: study.tipoProyecto,
        }}
        proposedImport={{
          title: study.title,
          clientId: study.clientId,
          status: study.status,
        }}
      />
    </div>
  );
}

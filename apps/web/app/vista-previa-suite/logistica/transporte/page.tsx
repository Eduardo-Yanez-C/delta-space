"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "../../../../lib/auth-context";
import { LogisticsTransportStatusesModal } from "../../../../components/logistica/LogisticsTransportStatusesModal";
import { TransportCommercialDealModal } from "../../../../components/logistica/transport-commercial-deal-modal";
import {
  TransportKanbanBoard,
  type TransportKanbanColumn,
} from "../../../../components/logistica/transport-kanban-board";
import {
  applyInventoryTransportBulk,
  applyInventoryTransportGroup,
  fetchInventoryTransportOverview,
  fetchLogisticsSnapshots,
  fetchSuiteProjects,
  fetchSuppliers,
  fetchSuiteProject,
  fetchTransportCommercialDealsBatch,
  type InventoryTransportOverview,
  type InventoryTransportOverviewGroup,
  type InventoryTransportSummary,
  type LogisticsSnapshotListRow,
  type SuiteProjectDetail,
  type SuiteProjectRow,
  type Supplier,
  type TransportGroupCommercialDeal,
} from "../../../../lib/api";
import { hasSuiteNavGrant } from "../../../../lib/suite-nav-grants";
import {
  logisticsTransportStatusBucket,
  logisticsTransportStatusPill,
  normalizeLogisticsTransportStatusConfig,
  resolveLogisticsTransportStatusId,
  sortStatusDefs,
} from "../../../../lib/suite-logistics-transport-status-config";
import {
  buildTruckClusters,
  groupHasTruckIdentity,
} from "../../../../lib/logistics-truck-cluster";
import { formatChileRutInput } from "../../../../lib/chile-rut-format";
import type { TaskStatusConfig } from "../../../../lib/suite-task-status-config";

/** Siguiente número de viaje sugerido a partir de valores ya guardados en el proyecto (o global si no hay filtro). */
function suggestNextTripNumber(
  groups: InventoryTransportOverviewGroup[],
  projectIdFilter: string,
): string {
  let maxN = 0;
  let any = false;
  const want = projectIdFilter.trim();
  for (const g of groups) {
    if (want && g.project?.id !== want) continue;
    const raw = g.inventoryTransportSummary?.tripNumber?.trim();
    if (!raw) continue;
    any = true;
    if (/^\d+$/.test(raw)) {
      const n = parseInt(raw, 10);
      if (!Number.isNaN(n)) maxN = Math.max(maxN, n);
      continue;
    }
    const nums = raw.match(/\d+/g);
    if (nums) {
      for (const x of nums) {
        const n = parseInt(x, 10);
        if (!Number.isNaN(n)) maxN = Math.max(maxN, n);
      }
    }
  }
  if (!any) return "1";
  return String(maxN + 1);
}

const CHILE_PLATE_TITLE =
  "Chile: Mercosur AAAA00 (ej. KLPG89), antigua AA0000, moto ABC12; amarilla típica XX·1234 (punto medio).";

function emptyInvSummary(): InventoryTransportSummary {
  return {
    tripNumber: null,
    guideNumber: null,
    truckPlate: null,
    trailerPlate: null,
    conductor: null,
    driverRut: null,
    driverPhone: null,
    transportCompany: null,
    logisticsTransportStatus: null,
    pickupOrigin: null,
    deliveryDestination: null,
    deliveryObservation: null,
  };
}

/** Actualiza solo el estado en memoria (evita recarga completa del tablero). */
function patchOverviewTransportStatus(
  overview: InventoryTransportOverview,
  groupKeys: Set<string>,
  statusValue: string | null,
): InventoryTransportOverview {
  return {
    ...overview,
    groups: overview.groups.map((g) => {
      if (!groupKeys.has(g.groupKey)) return g;
      const prev = g.inventoryTransportSummary ?? emptyInvSummary();
      return {
        ...g,
        inventoryTransportSummary: {
          ...prev,
          logisticsTransportStatus: statusValue,
        },
      };
    }),
  };
}

const INVENTARIO = "/vista-previa-suite/logistica/inventario";
const OPERACION_INTL = "/vista-previa-suite/logistica/operacion-internacional";
const PROVEEDORES = "/vista-previa-suite/logistica/proveedores";
const TRANSPORTE_COMERCIAL = "/vista-previa-suite/logistica/transporte-comercial";
const TRANSPORTE_CONTRATOS = "/vista-previa-suite/logistica/transporte-contratos";
const TRANSPORTE_VARIABLES = "/vista-previa-suite/logistica/transporte-variables";
const TRANSPORTE_VIAJES_COMERCIAL = "/vista-previa-suite/logistica/transporte-viajes-comercial";

function formatCommercialMoney(n: number, currency: string): string {
  const c = (currency || "CLP").trim() || "CLP";
  try {
    return new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: c === "USD" || c === "EUR" || c === "CLP" ? c : "CLP",
      maximumFractionDigits: c === "CLP" ? 0 : 2,
    }).format(n);
  } catch {
    return `${n.toLocaleString("es-CL")} ${c}`;
  }
}

function commercialPill(deal: TransportGroupCommercialDeal | undefined): {
  label: string;
  className: string;
} {
  if (!deal) {
    return {
      label: "Sin comercial",
      className: "text-slate-500 dark:text-slate-400",
    };
  }
  const st = (deal.commercialStatus ?? "DRAFT").toUpperCase();
  if (deal.agreedAmount != null && !Number.isNaN(deal.agreedAmount)) {
    const m = formatCommercialMoney(deal.agreedAmount, deal.currency);
    if (st === "AGREED")
      return { label: m, className: "text-emerald-400 font-semibold" };
    return { label: m, className: "text-amber-300 font-medium" };
  }
  return {
    label: st === "SUBMITTED" ? "Enviado" : "Borrador",
    className: "text-slate-400",
  };
}

function buildOperacionHref(
  snapshotId: string,
  logisticaTab: "transporte" | "trazabilidad" | "resumen",
) {
  const q = new URLSearchParams();
  q.set("snapshotId", snapshotId);
  if (logisticaTab !== "resumen") q.set("logisticaTab", logisticaTab);
  return `${OPERACION_INTL}?${q.toString()}`;
}

function inventarioHref(
  project: { id: string } | null,
  palletId: string | null,
): string {
  const q = new URLSearchParams();
  if (project?.id) q.set("projectId", project.id);
  if (palletId?.trim()) q.set("pallet", palletId.trim());
  const s = q.toString();
  return s ? `${INVENTARIO}?${s}` : INVENTARIO;
}

function groundTransportPreview(row: Record<string, unknown> | null): string {
  if (!row) return "";
  let transportista = "";
  let conductor = "";
  let patente = "";
  for (const [k, v] of Object.entries(row)) {
    const lk = k.toLowerCase();
    const val = String(v ?? "").trim();
    if (!val) continue;
    if (lk.includes("transportista")) transportista = val;
    if (lk === "conductor" || (lk.includes("conductor") && !lk.includes("rut")))
      conductor = val;
    if (lk.includes("patente") && lk.includes("camion")) patente = val;
  }
  return [transportista, conductor, patente].filter(Boolean).join(" · ");
}

type TransportFormState = {
  transportCompany: string;
  conductor: string;
  driverRut: string;
  driverPhone: string;
  truckPlate: string;
  trailerPlate: string;
  tripNumber: string;
  guideNumber: string;
  logisticsTransportStatus: string;
  pickupOrigin: string;
  deliveryDestination: string;
  deliveryObservation: string;
};

function splitDestinations(raw: string): string[] {
  const s = (raw ?? "").trim();
  if (!s) return [];
  return s
    .split(/→|>|·|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function formatDestinationsForValue(destinations: string[]): string {
  const clean = destinations.map((d) => d.trim()).filter(Boolean);
  return clean.join(" → ");
}

function destinationsMetaText(
  destinations: string[],
  options: Array<{ value: string; text: string; title: string }>,
): string {
  const byValue = new Map(options.map((o) => [o.value.toLowerCase(), o]));
  const lines = destinations
    .map((v, i) => {
      const o = byValue.get(v.toLowerCase());
      if (!o) return null;
      const meta = (o.title ?? "").trim();
      return meta ? `${i + 1}. ${v}: ${meta}` : `${i + 1}. ${v}`;
    })
    .filter(Boolean) as string[];
  return lines.join("\n");
}

function emptyTransportForm(): TransportFormState {
  return {
    transportCompany: "",
    conductor: "",
    driverRut: "",
    driverPhone: "",
    truckPlate: "",
    trailerPlate: "",
    tripNumber: "",
    guideNumber: "",
    logisticsTransportStatus: "",
    pickupOrigin: "",
    deliveryDestination: "",
    deliveryObservation: "",
  };
}

function missingBulkRequiredFields(form: TransportFormState): string[] {
  const miss: string[] = [];
  if (!form.transportCompany.trim()) miss.push("Transportista");
  if (!form.conductor.trim()) miss.push("Conductor");
  if (!form.driverRut.trim()) miss.push("RUT conductor");
  if (!form.driverPhone.trim()) miss.push("Teléfono conductor");
  if (!form.truckPlate.trim()) miss.push("Pat. camión");
  if (!form.trailerPlate.trim()) miss.push("Pat. rampla");
  if (!form.guideNumber.trim()) miss.push("Guía");
  if (!form.tripNumber.trim()) miss.push("Viaje");
  if (!form.logisticsTransportStatus.trim()) miss.push("Estado logístico");
  if (!form.pickupOrigin.trim()) miss.push("Origen");
  if (!form.deliveryDestination.trim()) miss.push("Destino");
  // deliveryObservation NO es obligatorio
  return miss;
}

function DestinationPickerModal({
  open,
  onClose,
  title,
  subtitle,
  options,
  initialDestinations,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  options: Array<{ value: string; text: string; title: string }>;
  initialDestinations: string[];
  onApply: (destinations: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setSelected(initialDestinations);
  }, [open, initialDestinations]);

  const metaObservation = useMemo(() => {
    const byValue = new Map(options.map((o) => [o.value, o]));
    const lines = selected
      .map((v, i) => {
        const o = byValue.get(v);
        if (!o) return null;
        // muestra solo la metadata (dirección/coords) como “observación”
        const meta = (o.title ?? "").trim();
        return meta ? `${i + 1}. ${v}: ${meta}` : `${i + 1}. ${v}`;
      })
      .filter(Boolean) as string[];
    return lines.join("\n");
  }, [options, selected]);

  const toggle = useCallback((v: string) => {
    setSelected((prev) => {
      const has = prev.some((x) => x.toLowerCase() === v.toLowerCase());
      if (has) return prev.filter((x) => x.toLowerCase() !== v.toLowerCase());
      return [...prev, v];
    });
  }, []);

  const moveOne = useCallback((idx: number, delta: -1 | 1) => {
    setSelected((prev) => {
      const next = [...prev];
      const j = idx + delta;
      if (idx < 0 || idx >= next.length) return prev;
      if (j < 0 || j >= next.length) return prev;
      const tmp = next[idx]!;
      next[idx] = next[j]!;
      next[j] = tmp;
      return next;
    });
  }, []);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
  <div className="fixed left-1/2 top-1/2 z-[85] w-[min(100vw-24px,760px)] max-h-[min(90vh,760px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            ✕
          </button>
        </div>

        <div className="grid max-h-[min(76vh,620px)] grid-cols-1 gap-3 overflow-hidden p-3 md:grid-cols-2">
          <div className="suite-scroll overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
            <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
              Ubicaciones del proyecto
            </p>
            <ul className="space-y-1">
              {options.map((o) => {
                const checked = selected.some((x) => x.toLowerCase() === o.value.toLowerCase());
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      onClick={() => toggle(o.value)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        checked
                          ? "border-primary-400 bg-white dark:border-primary-500 dark:bg-slate-950"
                          : "border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-950"
                      }`}
                      title={o.title}
                    >
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        {o.value}{" "}
                        <span className="ml-2 text-[10px] font-bold text-slate-500">
                          {checked ? "Seleccionado" : "—"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{o.text.replace(`${o.value} · `, "")}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Orden
              </p>
            </div>
            <div className="suite-scroll max-h-[min(48vh,360px)] overflow-y-auto p-3">
              {selected.length ? (
                <ul className="space-y-2">
                  {selected.map((v, i) => (
                    <li key={`${v}-${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/40">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {i + 1}. {v}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveOne(i, -1)}
                          disabled={i === 0}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          title="Subir"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          onClick={() => moveOne(i, +1)}
                          disabled={i === selected.length - 1}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          title="Bajar"
                        >
                          ↓
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Seleccione al menos un destino.</p>
              )}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              <p className="font-semibold">Observación (dirección + coordenadas)</p>
              <pre className="mt-1 whitespace-pre-wrap font-mono text-[11px] text-slate-600 dark:text-slate-300">
                {metaObservation || "—"}
              </pre>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(selected);
              onClose();
            }}
            disabled={selected.length === 0}
            className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-50 dark:bg-primary-500"
          >
            Usar destinos
          </button>
        </div>
      </div>
    </>
  );
}

function SupplierPickerModal({
  open,
  onClose,
  suppliers,
  initialValue,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  initialValue: string;
  onApply: (value: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = suppliers
      .map((s) => String(s.name ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    if (!needle) return rows;
    return rows.filter((n) => n.toLowerCase().includes(needle));
  }, [suppliers, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm"
        aria-label="Cerrar"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-[85] w-[min(100vw-24px,560px)] max-h-[min(90vh,660px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Transportista (proveedores)</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Seleccione un proveedor o cierre para escribir uno manual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2 py-1 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            ✕
          </button>
        </div>
        <div className="p-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input-field-sm w-full"
            placeholder="Buscar proveedor…"
            autoFocus
          />
          <div className="suite-scroll mt-3 max-h-[min(62vh,480px)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/40">
            {filtered.length ? (
              <ul className="space-y-1">
                {filtered.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        onApply(name);
                        onClose();
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        name.toLowerCase() === initialValue.trim().toLowerCase()
                          ? "border-primary-400 bg-white dark:border-primary-500 dark:bg-slate-950"
                          : "border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900/40 dark:hover:bg-slate-950"
                      }`}
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2 py-2 text-sm text-slate-500">Sin resultados.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TransportHelpDetails({
  overview,
}: {
  overview: InventoryTransportOverview | null;
}) {
  return (
    <details className="relative shrink-0">
      <summary
        className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-sm font-bold text-slate-600 shadow-sm outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-400 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"
        aria-label="Ayuda"
      >
        ?
      </summary>
      <div
        className="absolute right-0 z-[60] mt-1 max-h-[min(70vh,520px)] w-[min(calc(100vw-2rem),22rem)] space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3 text-left text-[11px] leading-relaxed text-slate-700 shadow-xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Esta pantalla
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Use{" "}
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              aplicación masiva
            </strong>
            : cargue una vez transportista, conductor, guía, viaje y patentes;
            filtre la tabla, marque pallets y aplique a todos. También puede
            usar{" "}
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              Gestionar
            </strong>{" "}
            en una fila. Los cambios se aplican a{" "}
            <strong className="font-medium">
              todas las líneas de inventario
            </strong>{" "}
            de cada grupo; si elige una importación, también se actualiza la
            hoja Excel vinculada.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Aplicación masiva
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Transportista desde proveedores (lista + texto libre). El estado
            sigue el flujo del proyecto. Marque filas en la lista y pulse
            Aplicar.
          </p>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Sin proyecto en el filtro superior se usan estados por defecto.
            Elija un proyecto para personalizar estados y el botón Editar.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Comercial
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Use «Comercial» por fila para plantilla + % o monto manual. Las
            plantillas se administran en Logística → Transporte comercial.
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Lista y tableros
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            La lista muestra lo esencial en pocas líneas; los SKU detallados
            quedan bajo «Series». El cambio rápido de estado en lista requiere
            patente o empresa + viaje (defínalo en masivo).
          </p>
          {overview ? (
            <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
              <span className="font-medium">Totales:</span>{" "}
              {overview.totals.inventoryLinesScanned} líneas analizadas;{" "}
              {overview.totals.linesIncluded} incluidas en esta vista;{" "}
              {overview.totals.groupCount} grupos (proyecto + pallet).
            </p>
          ) : null}
        </div>
      </div>
    </details>
  );
}

function listStripeFromStatus(
  raw: string | null | undefined,
  cfg: TaskStatusConfig,
): string {
  const bucket = logisticsTransportStatusBucket(raw, cfg);
  if (bucket === "__legacy__") return "border-l-[#A855F7]";
  if (bucket === "__empty__") return "border-l-[#64748B]";
  const def = cfg.statuses.find((s) => s.id === bucket);
  if (!def) return "border-l-[#64748B]";
  if (def.category === "not_started") return "border-l-[#EAB308]";
  if (def.category === "active") return "border-l-[#3B82F6]";
  return "border-l-[#22C55E]";
}

function summaryToForm(
  s: InventoryTransportOverviewGroup["inventoryTransportSummary"],
  statusCfg: TaskStatusConfig,
): TransportFormState {
  const raw = s?.logisticsTransportStatus ?? "";
  const id = raw.trim()
    ? (resolveLogisticsTransportStatusId(raw, statusCfg) ?? raw.trim())
    : "";
  return {
    transportCompany: s?.transportCompany ?? "",
    conductor: s?.conductor ?? "",
    driverRut: s?.driverRut ?? "",
    driverPhone: s?.driverPhone ?? "",
    truckPlate: s?.truckPlate ?? "",
    trailerPlate: s?.trailerPlate ?? "",
    tripNumber: s?.tripNumber ?? "",
    guideNumber: s?.guideNumber ?? "",
    logisticsTransportStatus: id,
    pickupOrigin: s?.pickupOrigin ?? "",
    deliveryDestination: s?.deliveryDestination ?? "",
    deliveryObservation: s?.deliveryObservation ?? "",
  };
}

function LogisticaTransporteInner() {
  const searchParams = useSearchParams();
  const urlProjectId = searchParams.get("projectId")?.trim() ?? "";
  const { user, loading: authLoading } = useAuth();
  const canSee = useMemo(
    () =>
      hasSuiteNavGrant(user?.suiteNavGrants ?? null, user?.roles, "logistica"),
    [user?.suiteNavGrants, user?.roles],
  );
  const canWrite = useMemo(() => {
    const r = user?.roles ?? [];
    return [
      "ADMIN_DEV",
      "ADMIN",
      "VENDEDOR_TECNICO",
      "INGENIERIA",
      "VENTAS",
    ].some((x) => r.includes(x));
  }, [user?.roles]);

  const [projects, setProjects] = useState<SuiteProjectRow[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<string>(urlProjectId);
  const [overview, setOverview] = useState<InventoryTransportOverview | null>(
    null,
  );
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<LogisticsSnapshotListRow[]>([]);
  const [snapshotsLoading, setSnapshotsLoading] = useState(true);
  const [snapshotsError, setSnapshotsError] = useState<string | null>(null);

  const [manageGroup, setManageGroup] =
    useState<InventoryTransportOverviewGroup | null>(null);
  const [formTransport, setFormTransport] = useState<TransportFormState | null>(
    null,
  );
  const [syncSnapshotId, setSyncSnapshotId] = useState<string>("");
  const [savingManage, setSavingManage] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  const [bulkForm, setBulkForm] = useState<TransportFormState>(() =>
    emptyTransportForm(),
  );
  const [bulkSyncSnapshotId, setBulkSyncSnapshotId] = useState<string>("");
  const [rowFilter, setRowFilter] = useState("");
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [projectTransportDetail, setProjectTransportDetail] =
    useState<SuiteProjectDetail | null>(null);
  const [statusCfgModalOpen, setStatusCfgModalOpen] = useState(false);
  const [transportViewMode, setTransportViewMode] = useState<
    "list" | "board-pallets" | "board-trucks"
  >("list");
  const [quickStatusSaving, setQuickStatusSaving] = useState<string | null>(
    null,
  );
  const [expandedListSkus, setExpandedListSkus] = useState<Set<string>>(
    () => new Set(),
  );
  const [destPickerBulkOpen, setDestPickerBulkOpen] = useState(false);
  const [destPickerManageOpen, setDestPickerManageOpen] = useState(false);
  const [originPickerBulkOpen, setOriginPickerBulkOpen] = useState(false);
  const [originPickerManageOpen, setOriginPickerManageOpen] = useState(false);
  const [supplierPickerBulkOpen, setSupplierPickerBulkOpen] = useState(false);
  const [supplierPickerManageOpen, setSupplierPickerManageOpen] = useState(false);
  const [commercialDealsByKey, setCommercialDealsByKey] = useState<
    Record<string, TransportGroupCommercialDeal>
  >({});
  const [commercialGroup, setCommercialGroup] =
    useState<InventoryTransportOverviewGroup | null>(null);

  const logisticsStatusCfg = useMemo(
    () =>
      normalizeLogisticsTransportStatusConfig(
        projectTransportDetail?.logisticsTransportStatusConfig ?? null,
      ),
    [projectTransportDetail?.logisticsTransportStatusConfig],
  );

  const filteredGroups = useMemo(() => {
    const g = overview?.groups;
    if (!g?.length) return [];
    const q = rowFilter.trim().toLowerCase();
    if (!q) return g;
    return g.filter((row) => {
      const hay = [
        row.project?.code,
        row.project?.name,
        row.palletId,
        row.orderRef,
        row.sampleSkus.join(" "),
        row.traceabilityLabels.join(" "),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [overview?.groups, rowFilter]);

  const bulkTableVisibleKeys = useMemo(
    () => filteredGroups.map((g) => g.groupKey),
    [filteredGroups],
  );
  const allVisibleBulkSelected =
    bulkTableVisibleKeys.length > 0 &&
    bulkTableVisibleKeys.every((k) => selectedGroupKeys.has(k));

  const boardColumns = useMemo((): TransportKanbanColumn[] => {
    const defs = sortStatusDefs(logisticsStatusCfg.statuses);
    const cols: TransportKanbanColumn[] = [
      { key: "__empty__", label: "Sin estado", chrome: "empty" },
    ];
    for (const s of defs)
      cols.push({ key: s.id, label: s.label, chrome: s.category });
    let hasLegacy = false;
    for (const g of filteredGroups) {
      const inv = g.inventoryTransportSummary;
      if (
        logisticsTransportStatusBucket(
          inv?.logisticsTransportStatus,
          logisticsStatusCfg,
        ) === "__legacy__"
      ) {
        hasLegacy = true;
        break;
      }
    }
    if (hasLegacy)
      cols.push({ key: "__legacy__", label: "Texto libre", chrome: "legacy" });
    return cols;
  }, [filteredGroups, logisticsStatusCfg]);

  const truckClusters = useMemo(
    () => buildTruckClusters(filteredGroups, logisticsStatusCfg),
    [filteredGroups, logisticsStatusCfg],
  );

  const suggestedTripNumber = useMemo(
    () => suggestNextTripNumber(overview?.groups ?? [], filterProjectId),
    [overview?.groups, filterProjectId],
  );

  const suggestedTripForManage = useMemo(() => {
    if (!manageGroup?.project?.id || !overview) return "1";
    return suggestNextTripNumber(overview.groups, manageGroup.project.id);
  }, [manageGroup?.project?.id, overview]);

  const tripUserLockedRef = useRef(false);

  useEffect(() => {
    tripUserLockedRef.current = false;
  }, [filterProjectId]);

  useEffect(() => {
    if (!overview) return;
    if (tripUserLockedRef.current) return;
    setBulkForm((f) => ({ ...f, tripNumber: suggestedTripNumber }));
  }, [overview, suggestedTripNumber]);

  useEffect(() => {
    if (urlProjectId && !filterProjectId) setFilterProjectId(urlProjectId);
  }, [urlProjectId, filterProjectId]);

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const o = await fetchInventoryTransportOverview({
        projectId: filterProjectId.trim() || null,
      });
      setOverview(o);
    } catch (e) {
      setOverviewError(
        e instanceof Error
          ? e.message
          : "Error al cargar agrupaciones desde inventario",
      );
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, [filterProjectId]);

  const reloadCommercialDeals = useCallback(async (groups: InventoryTransportOverviewGroup[]) => {
    if (!groups.length) {
      setCommercialDealsByKey({});
      return;
    }
    try {
      const keys = groups.map((g) => g.groupKey);
      const deals = await fetchTransportCommercialDealsBatch(keys);
      const next: Record<string, TransportGroupCommercialDeal> = {};
      for (const d of deals) next[d.groupKey] = d;
      setCommercialDealsByKey(next);
    } catch {
      setCommercialDealsByKey({});
    }
  }, []);

  useEffect(() => {
    if (!overview?.groups.length) {
      setCommercialDealsByKey({});
      return;
    }
    void reloadCommercialDeals(overview.groups);
  }, [overview, reloadCommercialDeals]);

  const loadSnapshots = useCallback(async () => {
    setSnapshotsLoading(true);
    setSnapshotsError(null);
    try {
      const list = await fetchLogisticsSnapshots(
        filterProjectId.trim() || undefined,
      );
      setSnapshots(list);
    } catch (e) {
      setSnapshotsError(
        e instanceof Error ? e.message : "Error al cargar importaciones",
      );
      setSnapshots([]);
    } finally {
      setSnapshotsLoading(false);
    }
  }, [filterProjectId]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    void loadOverview();
  }, [authLoading, user, canSee, loadOverview]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    void (async () => {
      try {
        const plist = await fetchSuiteProjects().catch(
          () => [] as SuiteProjectRow[],
        );
        setProjects(plist);
      } catch {
        setProjects([]);
      }
    })();
  }, [authLoading, user, canSee]);

  useEffect(() => {
    if (authLoading || !user || !canSee) return;
    void loadSnapshots();
  }, [authLoading, user, canSee, loadSnapshots]);

  useEffect(() => {
    if (!canWrite || !user || !canSee) return;
    void fetchSuppliers({ active: true })
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, [canWrite, user, canSee]);

  useEffect(() => {
    if (authLoading || !user || !canSee || !filterProjectId.trim()) {
      setProjectTransportDetail(null);
      return;
    }
    void (async () => {
      try {
        const d = await fetchSuiteProject(filterProjectId.trim());
        setProjectTransportDetail(d);
      } catch {
        setProjectTransportDetail(null);
      }
    })();
  }, [authLoading, user, canSee, filterProjectId]);

  const projectDestinationOptions = useMemo(() => {
    const locs = projectTransportDetail?.locations ?? [];
    const seen = new Set<string>();
    const out: Array<{
      value: string; // lo que se inserta en "Destino"
      text: string; // lo que se ve en la lista
      title: string; // tooltip con dirección/coords
    }> = [];

    for (const l of locs) {
      const label = (l.label ?? "").trim();
      if (!label) continue;
      const k = label.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      const addr = (l.address ?? "").trim();
      const coords =
        l.latitude != null && l.longitude != null
          ? `${Number(l.latitude).toFixed(6)},${Number(l.longitude).toFixed(6)}`
          : "";
      const hintParts = [addr, coords].filter(Boolean);
      out.push({
        value: label,
        text: hintParts.length ? `${label} · ${hintParts.join(" · ")}` : label,
        title: hintParts.length ? hintParts.join(" · ") : label,
      });
    }
    return out;
  }, [projectTransportDetail?.locations]);

  // (Destino) Por ahora no auto-sugerimos; se define con + o texto libre.

  const snapshotsForModal = useMemo(() => {
    const g = manageGroup;
    if (!g?.project?.id) return snapshots;
    return snapshots.filter(
      (s) => !s.projectId || s.projectId === g.project!.id,
    );
  }, [manageGroup, snapshots]);

  function openManage(g: InventoryTransportOverviewGroup) {
    setManageGroup(g);
    setFormTransport(
      summaryToForm(g.inventoryTransportSummary, logisticsStatusCfg),
    );
    setSyncSnapshotId(g.logisticsSnapshotId ?? "");
    setManageError(null);
  }

  async function quickSetGroupStatus(
    g: InventoryTransportOverviewGroup,
    statusId: string,
  ) {
    if (!g.project?.id || !canWrite || !groupHasTruckIdentity(g)) return;
    const v = statusId.trim();
    const prevOverview = overview;
    if (overview) {
      setOverview(
        patchOverviewTransportStatus(
          overview,
          new Set([g.groupKey]),
          v || null,
        ),
      );
    }
    setQuickStatusSaving(g.groupKey);
    try {
      await applyInventoryTransportGroup({
        projectId: g.project.id,
        palletId: g.palletId,
        snapshotId: null,
        patch: { logisticsTransportStatus: v || null },
      });
    } catch {
      if (prevOverview) setOverview(prevOverview);
    } finally {
      setQuickStatusSaving(null);
    }
  }

  const applyStatusToGroupKeys = useCallback(
    async (groupKeys: string[], statusId: string | null) => {
      if (!canWrite || !overview || groupKeys.length === 0) return;
      const keySet = new Set(groupKeys);
      const rows = overview.groups.filter((gr) => keySet.has(gr.groupKey));
      if (rows.some((r) => !groupHasTruckIdentity(r))) return;
      const targets = rows
        .filter((gr) => gr.project?.id)
        .map((gr) => ({ projectId: gr.project!.id, palletId: gr.palletId }));
      if (!targets.length) return;
      const nextVal = statusId?.trim() || null;
      const prevOverview = overview;
      setOverview(patchOverviewTransportStatus(overview, keySet, nextVal));
      try {
        await applyInventoryTransportBulk({
          targets,
          snapshotId: null,
          patch: { logisticsTransportStatus: nextVal },
        });
      } catch {
        if (prevOverview) setOverview(prevOverview);
      }
    },
    [canWrite, overview],
  );

  function patchFromForm(form: TransportFormState) {
    return {
      transportCompany: form.transportCompany.trim() || null,
      conductor: form.conductor.trim() || null,
      driverRut: form.driverRut.trim() || null,
      driverPhone: form.driverPhone.trim() || null,
      truckPlate: form.truckPlate.trim() || null,
      trailerPlate: form.trailerPlate.trim() || null,
      tripNumber: form.tripNumber.trim() || null,
      guideNumber: form.guideNumber.trim() || null,
      logisticsTransportStatus: form.logisticsTransportStatus.trim() || null,
      pickupOrigin: form.pickupOrigin.trim() || null,
      deliveryDestination: form.deliveryDestination.trim() || null,
      deliveryObservation: form.deliveryObservation.trim() || null,
    };
  }

  async function saveBulk() {
    if (!canWrite) return;
    const keys = selectedGroupKeys;
    if (!overview || keys.size === 0) {
      setBulkError("Seleccione al menos un pallet (fila) en la tabla.");
      return;
    }

    const missing = missingBulkRequiredFields(bulkForm);
    if (missing.length) {
      setBulkError(`Complete antes de aplicar: ${missing.join(", ")}. (Observación es opcional)`);
      return;
    }

    const rows = overview.groups.filter((gr) => keys.has(gr.groupKey));
    const targets = rows
      .filter((gr) => gr.project?.id)
      .map((gr) => ({ projectId: gr.project!.id, palletId: gr.palletId }));
    const skipped = rows.length - targets.length;
    if (!targets.length) {
      setBulkError(
        "Las filas seleccionadas no tienen proyecto asignado; no se puede aplicar.",
      );
      return;
    }
    setSavingBulk(true);
    setBulkError(null);
    setBulkNotice(null);
    try {
      const res = await applyInventoryTransportBulk({
        targets,
        snapshotId: bulkSyncSnapshotId.trim() || null,
        patch: patchFromForm(bulkForm),
      });
      const extra =
        skipped > 0 ? ` (${skipped} fila(s) sin proyecto omitidas)` : "";
      setBulkNotice(
        `Actualizadas ${res.updatedInventoryLines} línea(s) de inventario en ${targets.length} grupo(s).` +
          (res.palletsUpdatedInSnapshot > 0
            ? ` Planilla Excel: ${res.palletsUpdatedInSnapshot} pallet(s) en la importación elegida.`
            : "") +
          extra,
      );
      setSelectedGroupKeys(new Set());
      tripUserLockedRef.current = false;
      await loadOverview();
    } catch (e) {
      setBulkError(
        e instanceof Error ? e.message : "Error al aplicar en bloque",
      );
    } finally {
      setSavingBulk(false);
    }
  }

  async function saveManage() {
    const g = manageGroup;
    const form = formTransport;
    if (!g || !form) return;
    if (!g.project?.id) {
      setManageError(
        "El grupo no tiene proyecto asignado; no se puede guardar desde aquí.",
      );
      return;
    }
    if (!canWrite) return;
    setSavingManage(true);
    setManageError(null);
    const missing = missingBulkRequiredFields(form);
    if (missing.length) {
      setManageError(`Complete antes de guardar: ${missing.join(", ")}. (Observación es opcional)`);
      setSavingManage(false);
      return;
    }
    try {
      await applyInventoryTransportGroup({
        projectId: g.project.id,
        palletId: g.palletId,
        snapshotId: syncSnapshotId.trim() || null,
        patch: patchFromForm(form),
      });
      setManageGroup(null);
      setFormTransport(null);
      await loadOverview();
    } catch (e) {
      setManageError(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSavingManage(false);
    }
  }

  if (authLoading) {
    return (
      <p className="p-6 text-sm text-slate-600 dark:text-slate-400">
        Cargando…
      </p>
    );
  }

  if (!user) {
    return (
      <p className="p-6 text-sm">
        <Link href="/login" className="text-amber-600 underline">
          Inicie sesión
        </Link>
      </p>
    );
  }

  if (!canSee) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        No tiene permiso para ver Logística.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[92rem] space-y-4 px-3 py-3 md:px-4">
      <datalist id="suite-transport-suppliers-datalist">
        {suppliers.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      <header className="space-y-2 border-b border-slate-200 pb-3 dark:border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Logística
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Transporte
            </h1>
          </div>
          <TransportHelpDetails
            overview={overview && !overviewLoading ? overview : null}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
            Proyecto
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className="mt-1 block w-full min-w-[220px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            >
              <option value="">Todos los proyectos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link
              href={
                filterProjectId
                  ? `${INVENTARIO}?projectId=${encodeURIComponent(filterProjectId)}`
                  : INVENTARIO
              }
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Inventario
            </Link>
            <Link
              href={PROVEEDORES}
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Proveedores
            </Link>
            <Link
              href={
                filterProjectId
                  ? `${OPERACION_INTL}?projectId=${encodeURIComponent(filterProjectId)}`
                  : OPERACION_INTL
              }
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Operación internacional
            </Link>
            <Link
              href={
                filterProjectId
                  ? `${TRANSPORTE_COMERCIAL}?projectId=${encodeURIComponent(filterProjectId)}`
                  : TRANSPORTE_COMERCIAL
              }
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Transporte comercial
            </Link>
            <Link
              href={
                filterProjectId
                  ? `${TRANSPORTE_CONTRATOS}?projectId=${encodeURIComponent(filterProjectId)}`
                  : TRANSPORTE_CONTRATOS
              }
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Contratos transporte
            </Link>
            <Link href={TRANSPORTE_VARIABLES} className="font-medium text-primary-600 underline dark:text-primary-400">
              Variables transporte
            </Link>
            <Link
              href={TRANSPORTE_VIAJES_COMERCIAL}
              className="font-medium text-primary-600 underline dark:text-primary-400"
            >
              Viajes comerciales
            </Link>
          </div>
        </div>
      </header>

      <DestinationPickerModal
        open={destPickerBulkOpen}
        onClose={() => setDestPickerBulkOpen(false)}
        title="Destinos (orden de descarga)"
        subtitle="Seleccione uno o más destinos y ordénelos (1 = primera descarga)."
        options={projectDestinationOptions}
        initialDestinations={splitDestinations(bulkForm.deliveryDestination)}
        onApply={(destinations) => {
          setBulkForm((f) => ({
            ...f,
            deliveryDestination: formatDestinationsForValue(destinations),
          }));
        }}
      />
      <DestinationPickerModal
        open={originPickerBulkOpen}
        onClose={() => setOriginPickerBulkOpen(false)}
        title="Orígenes (orden de carga)"
        subtitle="Seleccione uno o más orígenes y ordénelos (1 = primer punto de carga)."
        options={projectDestinationOptions}
        initialDestinations={splitDestinations(bulkForm.pickupOrigin)}
        onApply={(origins) => {
          setBulkForm((f) => ({
            ...f,
            pickupOrigin: formatDestinationsForValue(origins),
          }));
        }}
      />
      <SupplierPickerModal
        open={supplierPickerBulkOpen}
        onClose={() => setSupplierPickerBulkOpen(false)}
        suppliers={suppliers}
        initialValue={bulkForm.transportCompany}
        onApply={(v) => setBulkForm((f) => ({ ...f, transportCompany: v }))}
      />
      <DestinationPickerModal
        open={destPickerManageOpen}
        onClose={() => setDestPickerManageOpen(false)}
        title="Destinos (orden de descarga)"
        subtitle="Seleccione uno o más destinos y ordénelos (1 = primera descarga)."
        options={projectDestinationOptions}
        initialDestinations={splitDestinations(formTransport?.deliveryDestination ?? "")}
        onApply={(destinations) => {
          setFormTransport((f) =>
            f
              ? {
                  ...f,
                  deliveryDestination: formatDestinationsForValue(destinations),
                }
              : f,
          );
        }}
      />
      <DestinationPickerModal
        open={originPickerManageOpen}
        onClose={() => setOriginPickerManageOpen(false)}
        title="Orígenes (orden de carga)"
        subtitle="Seleccione uno o más orígenes y ordénelos (1 = primer punto de carga)."
        options={projectDestinationOptions}
        initialDestinations={splitDestinations(formTransport?.pickupOrigin ?? "")}
        onApply={(origins) => {
          setFormTransport((f) =>
            f
              ? {
                  ...f,
                  pickupOrigin: formatDestinationsForValue(origins),
                }
              : f,
          );
        }}
      />
      <SupplierPickerModal
        open={supplierPickerManageOpen}
        onClose={() => setSupplierPickerManageOpen(false)}
        suppliers={suppliers}
        initialValue={formTransport?.transportCompany ?? ""}
        onApply={(v) =>
          setFormTransport((f) => (f ? { ...f, transportCompany: v } : f))
        }
      />
      <TransportCommercialDealModal
        open={Boolean(commercialGroup)}
        onClose={() => setCommercialGroup(null)}
        group={commercialGroup}
        initialDeal={
          commercialGroup ? commercialDealsByKey[commercialGroup.groupKey] : undefined
        }
        onSaved={(deal) => {
          setCommercialDealsByKey((prev) => ({ ...prev, [deal.groupKey]: deal }));
        }}
      />

      {overviewError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {overviewError}
        </div>
      ) : null}

      {canWrite ? (
        <section
          id="panel-transporte-masivo"
          className="rounded-xl border border-slate-200 bg-white/70 p-2.5 shadow-sm backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/55"
        >
          <h2 className="text-[11px] font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            Aplicación masiva
          </h2>
          {bulkError ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 p-1.5 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {bulkError}
            </p>
          ) : null}
          {bulkNotice ? (
            <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-1.5 text-[11px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
              {bulkNotice}
            </p>
          ) : null}

          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-12">
            <label className="sm:col-span-4">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Transportista (proveedores)
              </span>
              <div className="mt-0.5 flex gap-2">
                <input
                  value={bulkForm.transportCompany}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      transportCompany: e.target.value,
                    }))
                  }
                  className="input-field-sm w-full"
                  placeholder="Escriba o seleccione…"
                  list="suite-transport-suppliers-datalist"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setSupplierPickerBulkOpen(true)}
                  disabled={!suppliers.length}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  title={suppliers.length ? "Seleccionar proveedor" : "No hay proveedores cargados"}
                >
                  +
                </button>
              </div>
            </label>
            <label className="sm:col-span-2">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Conductor
              </span>
              <input
                value={bulkForm.conductor}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, conductor: e.target.value }))
                }
                className="input-field-sm mt-0.5 w-full"
                autoComplete="name"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                RUT conductor
              </span>
              <input
                value={bulkForm.driverRut}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    driverRut: formatChileRutInput(e.target.value),
                  }))
                }
                className="input-field-sm mt-0.5 w-full max-w-[11rem] font-mono"
                placeholder="10.111.000-1"
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Teléfono conductor
              </span>
              <input
                value={bulkForm.driverPhone}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, driverPhone: e.target.value }))
                }
                className="input-field-sm mt-0.5 w-full max-w-[10.5rem]"
                placeholder="+56 9 …"
                inputMode="tel"
              />
            </label>
            <label className="sm:col-span-2">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Estado logístico
              </span>
              <div className="mt-0.5 flex gap-1">
                <select
                  value={bulkForm.logisticsTransportStatus}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      logisticsTransportStatus: e.target.value,
                    }))
                  }
                  className="select-field-sm min-w-0 flex-1"
                >
                  <option value="">— Limpiar</option>
                  {sortStatusDefs(logisticsStatusCfg.statuses).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  title="Definir estados del proyecto"
                  disabled={!filterProjectId.trim()}
                  onClick={() => setStatusCfgModalOpen(true)}
                  className="shrink-0 rounded border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900/40"
                >
                  Editar
                </button>
              </div>
            </label>

            <label className="sm:col-span-2 sm:max-w-[9.5rem]">
              <span
                className="text-[10px] font-medium text-slate-600 dark:text-slate-300"
                title={CHILE_PLATE_TITLE}
              >
                Pat. camión
              </span>
              <input
                value={bulkForm.truckPlate}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    truckPlate: e.target.value.toUpperCase(),
                  }))
                }
                className="input-field-sm mt-0.5 w-full font-mono uppercase"
                placeholder="KLPG89"
                maxLength={12}
                title={CHILE_PLATE_TITLE}
              />
            </label>
            <label className="sm:col-span-2 sm:max-w-[9.5rem]">
              <span
                className="text-[10px] font-medium text-slate-600 dark:text-slate-300"
                title={CHILE_PLATE_TITLE}
              >
                Pat. rampla
              </span>
              <input
                value={bulkForm.trailerPlate}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    trailerPlate: e.target.value.toUpperCase(),
                  }))
                }
                className="input-field-sm mt-0.5 w-full font-mono uppercase"
                placeholder="KCSF56"
                maxLength={12}
                title={CHILE_PLATE_TITLE}
              />
            </label>
            <label className="sm:col-span-2 sm:max-w-[8.5rem]">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Guía
              </span>
              <input
                value={bulkForm.guideNumber}
                onChange={(e) =>
                  setBulkForm((f) => ({ ...f, guideNumber: e.target.value }))
                }
                className="input-field-sm mt-0.5 w-full max-w-[8.5rem]"
                maxLength={32}
              />
            </label>
            <label className="sm:col-span-2 sm:max-w-[6rem]">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Viaje
              </span>
              <input
                value={bulkForm.tripNumber}
                onChange={(e) => {
                  tripUserLockedRef.current = true;
                  setBulkForm((f) => ({ ...f, tripNumber: e.target.value }));
                }}
                className="input-field-sm mt-0.5 w-full max-w-[6rem] font-mono"
                maxLength={12}
              />
              <span className="mt-0.5 block text-[9px] leading-tight text-slate-500">
                Sugerido:{" "}
                <span className="font-mono text-slate-600 dark:text-slate-400">
                  {suggestedTripNumber}
                </span>
                {bulkForm.tripNumber.trim() !== suggestedTripNumber ? (
                  <button
                    type="button"
                    className="ml-1.5 font-semibold text-primary-700 underline dark:text-primary-300"
                    onClick={() => {
                      tripUserLockedRef.current = false;
                      setBulkForm((f) => ({
                        ...f,
                        tripNumber: suggestedTripNumber,
                      }));
                    }}
                  >
                    Aplicar
                  </button>
                ) : null}
              </span>
            </label>
            <label className="sm:col-span-4">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Sincronizar importación
              </span>
              <select
                value={bulkSyncSnapshotId}
                onChange={(e) => setBulkSyncSnapshotId(e.target.value)}
                className="select-field-sm mt-0.5 w-full"
              >
                <option value="">No (solo inventario)</option>
                {snapshots.map((sn) => (
                  <option key={sn.id} value={sn.id}>
                    {sn.orderRef ?? sn.title} (
                    {new Date(sn.createdAt).toLocaleDateString()})
                  </option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-8">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Origen
              </span>
              <div className="mt-0.5 flex gap-2">
                <input
                  value={bulkForm.pickupOrigin}
                  onChange={(e) =>
                    setBulkForm((f) => ({ ...f, pickupOrigin: e.target.value }))
                  }
                  className="input-field-sm w-full"
                  placeholder="Escriba o agregue con +…"
                />
                <button
                  type="button"
                  onClick={() => setOriginPickerBulkOpen(true)}
                  disabled={!projectDestinationOptions.length}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  title={
                    projectDestinationOptions.length
                      ? "Agregar orígenes del proyecto"
                      : "Este proyecto no tiene ubicaciones"
                  }
                >
                  +
                </button>
              </div>
              {splitDestinations(bulkForm.pickupOrigin).length > 0 ? (
                <pre className="mt-1 whitespace-pre-wrap text-[10px] leading-tight text-slate-500">
                  {destinationsMetaText(
                    splitDestinations(bulkForm.pickupOrigin),
                    projectDestinationOptions,
                  ) || "—"}
                </pre>
              ) : null}
            </label>

            <label className="sm:col-span-8">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Destino
              </span>
              <div className="mt-0.5 flex gap-2">
                <input
                  value={bulkForm.deliveryDestination}
                  onChange={(e) =>
                    setBulkForm((f) => ({
                      ...f,
                      deliveryDestination: e.target.value,
                    }))
                  }
                  className="input-field-sm w-full"
                  placeholder="Escriba o seleccione…"
                />
                <button
                  type="button"
                  onClick={() => setDestPickerBulkOpen(true)}
                  disabled={!projectDestinationOptions.length}
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                  title={
                    projectDestinationOptions.length
                      ? "Agregar destinos del proyecto"
                      : "Este proyecto no tiene ubicaciones"
                  }
                >
                  +
                </button>
              </div>
              {splitDestinations(bulkForm.deliveryDestination).length > 0 ? (
                <pre className="mt-1 whitespace-pre-wrap text-[10px] leading-tight text-slate-500">
                  {destinationsMetaText(
                    splitDestinations(bulkForm.deliveryDestination),
                    projectDestinationOptions,
                  ) || "—"}
                </pre>
              ) : null}
            </label>
            <label className="sm:col-span-4">
              <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                Observación
              </span>
              <input
                value={bulkForm.deliveryObservation}
                onChange={(e) =>
                  setBulkForm((f) => ({
                    ...f,
                    deliveryObservation: e.target.value,
                  }))
                }
                className="input-field-sm mt-0.5 w-full"
                placeholder="Ej. descarga AM / contacto…"
              />
            </label>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={
                savingBulk ||
                selectedGroupKeys.size === 0 ||
                missingBulkRequiredFields(bulkForm).length > 0
              }
              className="rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
              onClick={() => void saveBulk()}
            >
              {savingBulk
                ? "Aplicando…"
                : `Aplicar (${selectedGroupKeys.size})`}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-600"
              onClick={() => {
                tripUserLockedRef.current = false;
                const t = suggestNextTripNumber(
                  overview?.groups ?? [],
                  filterProjectId,
                );
                setBulkForm({ ...emptyTransportForm(), tripNumber: t });
              }}
            >
              Vaciar
            </button>
            <span className="text-[10px] text-slate-500">
              Sel. {selectedGroupKeys.size} · Visibles {filteredGroups.length}
            </span>
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Carga desde inventario
          </h2>
          {overview && overview.groups.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 p-0.5 text-[10px] dark:border-slate-600">
              <button
                type="button"
                className={`rounded-md px-2 py-1 font-semibold ${
                  transportViewMode === "list"
                    ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100"
                    : "text-slate-600 dark:text-slate-400"
                }`}
                onClick={() => setTransportViewMode("list")}
              >
                Lista
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 font-semibold ${
                  transportViewMode === "board-pallets"
                    ? "bg-sky-600 text-white shadow-sm dark:bg-sky-500"
                    : "text-slate-600 dark:text-slate-400"
                }`}
                onClick={() => setTransportViewMode("board-pallets")}
                title="Tarjeta = un pallet / grupo de líneas"
              >
                Tablero · Pallets
              </button>
              <button
                type="button"
                className={`rounded-md px-2 py-1 font-semibold ${
                  transportViewMode === "board-trucks"
                    ? "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                    : "text-slate-600 dark:text-slate-400"
                }`}
                onClick={() => setTransportViewMode("board-trucks")}
                title="Bloque = mismo camión (patente + viaje + transportista)"
              >
                Tablero · Camiones
              </button>
            </div>
          ) : null}
        </div>
        {overviewLoading ? (
          <p className="mt-3 text-sm text-slate-500">Cargando agrupaciones…</p>
        ) : null}
        {!overviewLoading && overview && overview.groups.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            No hay filas de inventario clasificadas como OQC, BOM proveedor o
            importación para este filtro. Cargue paneles por informe OQC,
            importe BOM o la operación internacional vinculada al proyecto.
          </p>
        ) : null}
        {!overviewLoading && overview && overview.groups.length > 0 ? (
          <div className="mt-3 space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-[200px] flex-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                Filtrar (proyecto, pallet, SKU, orden…)
                <input
                  value={rowFilter}
                  onChange={(e) => setRowFilter(e.target.value)}
                  className="input-field-sm mt-0.5 w-full"
                  placeholder="Ej. 2026123 o código proyecto"
                />
              </label>
              {canWrite ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium dark:border-slate-600"
                    onClick={() => {
                      setSelectedGroupKeys((prev) => {
                        const next = new Set(prev);
                        if (allVisibleBulkSelected) {
                          bulkTableVisibleKeys.forEach((k) => next.delete(k));
                        } else {
                          bulkTableVisibleKeys.forEach((k) => next.add(k));
                        }
                        return next;
                      });
                    }}
                  >
                    {allVisibleBulkSelected
                      ? "Desmarcar visibles"
                      : "Seleccionar visibles"}
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium dark:border-slate-600"
                    onClick={() => setSelectedGroupKeys(new Set())}
                  >
                    Limpiar selección
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    onClick={() => {
                      document
                        .getElementById("panel-transporte-masivo")
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    Ir al formulario masivo
                  </button>
                </div>
              ) : null}
            </div>
            {filteredGroups.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Ningún grupo coincide con el filtro.
              </p>
            ) : transportViewMode === "board-pallets" ||
              transportViewMode === "board-trucks" ? (
              <TransportKanbanBoard
                mode={
                  transportViewMode === "board-pallets" ? "pallets" : "trucks"
                }
                columns={boardColumns}
                palletGroups={filteredGroups}
                truckClusters={truckClusters}
                logisticsStatusCfg={logisticsStatusCfg}
                canWrite={canWrite}
                onDrop={(groupKeys, statusId) =>
                  void applyStatusToGroupKeys(groupKeys, statusId)
                }
                onQuickStatusPallet={(g, id) => void quickSetGroupStatus(g, id)}
              />
            ) : (
              <div className="max-h-[min(72vh,680px)] space-y-1 overflow-y-auto pr-0.5">
                {canWrite ? (
                  <div className="sticky top-0 z-[1] flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100/95 px-2 py-1 text-[10px] dark:border-slate-700 dark:bg-slate-800/95">
                    <label className="inline-flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={allVisibleBulkSelected}
                        onChange={() => {
                          setSelectedGroupKeys((prev) => {
                            const next = new Set(prev);
                            if (allVisibleBulkSelected) {
                              bulkTableVisibleKeys.forEach((k) =>
                                next.delete(k),
                              );
                            } else {
                              bulkTableVisibleKeys.forEach((k) => next.add(k));
                            }
                            return next;
                          });
                        }}
                      />
                      Todas (visibles)
                    </label>
                  </div>
                ) : null}
                {filteredGroups.map((g: InventoryTransportOverviewGroup) => {
                  const tripOk = g.linesWithTripNumber >= g.lineCount;
                  const excelOk = Boolean(g.groundTransportRow);
                  const inv = g.inventoryTransportSummary ?? {
                    tripNumber: null,
                    guideNumber: null,
                    truckPlate: null,
                    trailerPlate: null,
                    conductor: null,
                    driverRut: null,
                    driverPhone: null,
                    transportCompany: null,
                    logisticsTransportStatus: null,
                    deliveryDestination: null,
                  };
                  const invPreview = [
                    inv.transportCompany,
                    inv.conductor,
                    inv.truckPlate,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  const rowSelectable = Boolean(g.project?.id);
                  const invStatusResolved = resolveLogisticsTransportStatusId(
                    inv.logisticsTransportStatus,
                    logisticsStatusCfg,
                  );
                  const invStatusSelectVal =
                    invStatusResolved &&
                    logisticsStatusCfg.statuses.some(
                      (x) => x.id === invStatusResolved,
                    )
                      ? invStatusResolved
                      : "";
                  const invPill = logisticsTransportStatusPill(
                    inv.logisticsTransportStatus,
                    logisticsStatusCfg,
                  );
                  const stripe = listStripeFromStatus(
                    inv.logisticsTransportStatus,
                    logisticsStatusCfg,
                  );
                  const skuOpen = expandedListSkus.has(g.groupKey);
                  const deal = commercialDealsByKey[g.groupKey];
                  const cPill = commercialPill(deal);
                  return (
                    <article
                      key={g.groupKey}
                      className={`flex gap-2 rounded-lg border border-slate-700/60 bg-slate-900/50 py-1.5 pl-1.5 pr-2 shadow-sm dark:bg-slate-950/80 ${stripe} border-l-4`}
                    >
                      {canWrite ? (
                        <div className="flex shrink-0 flex-col justify-start pt-1">
                          <input
                            type="checkbox"
                            className="rounded border-slate-500"
                            checked={selectedGroupKeys.has(g.groupKey)}
                            disabled={!rowSelectable}
                            title={rowSelectable ? undefined : "Sin proyecto"}
                            onChange={() => {
                              setSelectedGroupKeys((prev) => {
                                const next = new Set(prev);
                                if (next.has(g.groupKey))
                                  next.delete(g.groupKey);
                                else next.add(g.groupKey);
                                return next;
                              });
                            }}
                          />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
                          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0">
                            <span className="text-[12px] font-bold leading-tight text-white">
                              {g.project?.code ?? "—"}
                            </span>
                            <span className="font-mono text-[10px] font-semibold leading-tight text-sky-300">
                              {g.palletId ?? "Sin pallet"}
                            </span>
                            {g.project?.name ? (
                              <span className="max-w-[min(100%,28rem)] truncate text-[10px] text-slate-500">
                                · {g.project.name}
                              </span>
                            ) : null}
                          </div>
                          <span
                            className={`shrink-0 ${invPill.className} rounded-full px-2 py-px text-[9px] font-bold`}
                          >
                            {invPill.text}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-slate-400">
                          {g.traceabilityLabels.length > 0 ? (
                            <span
                              className="max-w-[14rem] truncate sm:max-w-xs"
                              title={g.traceabilityLabels.join(", ")}
                            >
                              {g.traceabilityLabels.join(", ")}
                            </span>
                          ) : null}
                          <span
                            className={
                              tripOk
                                ? "shrink-0 text-emerald-400"
                                : "shrink-0 text-amber-300"
                            }
                          >
                            Viaje {g.linesWithTripNumber}/{g.lineCount}
                          </span>
                          <span className="shrink-0">
                            {g.lineCount} lín. · {g.quantitySum} u.
                          </span>
                          {g.orderRef ? (
                            <span className="shrink-0 text-slate-500">
                              Ord. {g.orderRef}
                            </span>
                          ) : null}
                          {invPreview ? (
                            <span className="max-w-[12rem] truncate text-slate-500 sm:max-w-sm">
                              {invPreview}
                            </span>
                          ) : null}
                          <span className="text-slate-600">
                            Planilla{" "}
                            {excelOk ? (
                              <span className="text-emerald-400">
                                {groundTransportPreview(g.groundTransportRow)}
                              </span>
                            ) : (
                              <span className="text-slate-500">sin fila</span>
                            )}
                          </span>
                          {g.sampleSkus.length ? (
                            <button
                              type="button"
                              className="shrink-0 font-semibold text-sky-400 hover:underline"
                              onClick={() => {
                                setExpandedListSkus((prev) => {
                                  const n = new Set(prev);
                                  if (n.has(g.groupKey)) n.delete(g.groupKey);
                                  else n.add(g.groupKey);
                                  return n;
                                });
                              }}
                            >
                              {skuOpen
                                ? "Ocultar series"
                                : `Series (${g.sampleSkus.length}+)`}
                            </button>
                          ) : null}
                        </div>
                        {skuOpen && g.sampleSkus.length ? (
                          <p className="mt-0.5 max-h-16 overflow-y-auto font-mono text-[9px] leading-snug text-slate-500">
                            {g.sampleSkus.join(", ")}…
                          </p>
                        ) : null}
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-700/30 pt-1">
                          {canWrite && g.project?.id ? (
                            <select
                              disabled={
                                quickStatusSaving === g.groupKey ||
                                !groupHasTruckIdentity(g)
                              }
                              title={
                                !groupHasTruckIdentity(g)
                                  ? "Defina patente o empresa + viaje en masivo antes de cambiar estado"
                                  : undefined
                              }
                              value={invStatusSelectVal}
                              onChange={(e) =>
                                void quickSetGroupStatus(g, e.target.value)
                              }
                              className="select-field-sm max-w-[11rem]"
                            >
                              <option value="">Estado…</option>
                              {sortStatusDefs(logisticsStatusCfg.statuses).map(
                                (s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.label}
                                  </option>
                                ),
                              )}
                            </select>
                          ) : null}
                          {canWrite ? (
                            <button
                              type="button"
                              onClick={() => openManage(g)}
                              className="rounded bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-500"
                            >
                              Gestionar
                            </button>
                          ) : null}
                          {g.project?.id ? (
                            <span
                              className={`text-[10px] ${cPill.className}`}
                              title="Precio acordado / estado comercial"
                            >
                              {cPill.label}
                            </span>
                          ) : null}
                          {canWrite && g.project?.id ? (
                            <button
                              type="button"
                              onClick={() => setCommercialGroup(g)}
                              className="rounded border border-slate-500/60 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-800/80"
                            >
                              Comercial
                            </button>
                          ) : null}
                          {canWrite ? (
                            <button
                              type="button"
                              className="text-[10px] font-medium text-amber-300/90 underline"
                              onClick={() => {
                                setBulkForm(
                                  summaryToForm(inv, logisticsStatusCfg),
                                );
                                document
                                  .getElementById("panel-transporte-masivo")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                  });
                              }}
                            >
                              → Masivo
                            </button>
                          ) : null}
                          <Link
                            href={inventarioHref(g.project, g.palletId)}
                            className="text-[10px] font-medium text-sky-400 underline"
                          >
                            Inventario
                          </Link>
                          {g.logisticsSnapshotId ? (
                            <Link
                              href={buildOperacionHref(
                                g.logisticsSnapshotId,
                                "transporte",
                              )}
                              className="text-[10px] text-violet-300 underline"
                            >
                              Excel
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">
          Operación internacional (BL, finanzas, planilla)
        </h2>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Importaciones recientes del libro Excel: embarques, pallets, paneles y
          registro terrestre completo.
        </p>
        {snapshotsError ? (
          <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {snapshotsError}
          </div>
        ) : null}
        {snapshotsLoading ? (
          <p className="mt-3 text-sm text-slate-500">Cargando…</p>
        ) : null}
        {!snapshotsLoading && snapshots.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No hay importaciones en este filtro.
          </p>
        ) : null}
        {!snapshotsLoading && snapshots.length > 0 ? (
          <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-700">
            {snapshots.map((sn) => (
              <li
                key={sn.id}
                className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {sn.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {sn.orderRef ?? "—"} ·{" "}
                    {new Date(sn.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={buildOperacionHref(sn.id, "transporte")}
                    className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    Planilla
                  </Link>
                  <Link
                    href={buildOperacionHref(sn.id, "trazabilidad")}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-600"
                  >
                    Trazabilidad
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {filterProjectId.trim() ? (
        <LogisticsTransportStatusesModal
          open={statusCfgModalOpen}
          onClose={() => setStatusCfgModalOpen(false)}
          projectId={filterProjectId.trim()}
          initialRaw={
            projectTransportDetail?.logisticsTransportStatusConfig ?? null
          }
          onSaved={async () => {
            try {
              const d = await fetchSuiteProject(filterProjectId.trim());
              setProjectTransportDetail(d);
            } catch {
              /* noop */
            }
          }}
        />
      ) : null}

      {manageGroup && formTransport ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Gestionar envío
            </h3>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Proyecto {manageGroup.project?.code ?? "—"} ·{" "}
              {manageGroup.lineCount} líneas
              {manageGroup.palletId ? (
                <>
                  {" "}
                  · Pallet{" "}
                  <span className="font-mono">{manageGroup.palletId}</span>
                </>
              ) : null}
            </p>
            {manageError ? (
              <p className="mt-2 rounded border border-red-200 bg-red-50 p-1.5 text-[11px] text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
                {manageError}
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <label className="col-span-2 block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Transportista (proveedores)
                </span>
                <div className="mt-0.5 flex gap-2">
                  <input
                    value={formTransport.transportCompany}
                    onChange={(e) =>
                      setFormTransport((f) =>
                        f ? { ...f, transportCompany: e.target.value } : f,
                      )
                    }
                    className="input-field-sm w-full"
                    list="suite-transport-suppliers-datalist"
                    autoComplete="off"
                    placeholder="Escriba o seleccione…"
                  />
                  <button
                    type="button"
                    onClick={() => setSupplierPickerManageOpen(true)}
                    disabled={!suppliers.length}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    title={suppliers.length ? "Seleccionar proveedor" : "No hay proveedores cargados"}
                  >
                    +
                  </button>
                </div>
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Conductor
                </span>
                <input
                  value={formTransport.conductor}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f ? { ...f, conductor: e.target.value } : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  RUT conductor
                </span>
                <input
                  value={formTransport.driverRut}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f
                        ? {
                            ...f,
                            driverRut: formatChileRutInput(e.target.value),
                          }
                        : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full max-w-[11rem] font-mono"
                  placeholder="10.111.000-1"
                  maxLength={14}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Teléfono conductor
                </span>
                <input
                  value={formTransport.driverPhone}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f ? { ...f, driverPhone: e.target.value } : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full"
                  placeholder="+56 9 …"
                />
              </label>
              <label className="block">
                <span
                  className="text-[10px] font-medium text-slate-600 dark:text-slate-300"
                  title={CHILE_PLATE_TITLE}
                >
                  Pat. camión
                </span>
                <input
                  value={formTransport.truckPlate}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f
                        ? { ...f, truckPlate: e.target.value.toUpperCase() }
                        : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full max-w-[9.5rem] font-mono uppercase"
                  placeholder="KLPG89"
                  maxLength={12}
                  title={CHILE_PLATE_TITLE}
                />
              </label>
              <label className="block">
                <span
                  className="text-[10px] font-medium text-slate-600 dark:text-slate-300"
                  title={CHILE_PLATE_TITLE}
                >
                  Pat. rampla
                </span>
                <input
                  value={formTransport.trailerPlate}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f
                        ? { ...f, trailerPlate: e.target.value.toUpperCase() }
                        : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full max-w-[9.5rem] font-mono uppercase"
                  placeholder="KCSF56"
                  maxLength={12}
                  title={CHILE_PLATE_TITLE}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Guía
                </span>
                <input
                  value={formTransport.guideNumber}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f ? { ...f, guideNumber: e.target.value } : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full max-w-[10rem]"
                  maxLength={32}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Viaje
                </span>
                <input
                  value={formTransport.tripNumber}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f ? { ...f, tripNumber: e.target.value } : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full max-w-[6.5rem] font-mono"
                  maxLength={12}
                />
                <button
                  type="button"
                  className="mt-1 text-[9px] font-semibold text-amber-700 underline dark:text-amber-400"
                  onClick={() =>
                    setFormTransport((f) =>
                      f ? { ...f, tripNumber: suggestedTripForManage } : f,
                    )
                  }
                >
                  Usar sugerencia ({suggestedTripForManage})
                </button>
              </label>
              <label className="col-span-2 block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Estado logístico
                </span>
                <select
                  value={formTransport.logisticsTransportStatus}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f
                        ? { ...f, logisticsTransportStatus: e.target.value }
                        : f,
                    )
                  }
                  className="select-field-sm mt-0.5 w-full"
                >
                  <option value="">— Limpiar</option>
                  {sortStatusDefs(logisticsStatusCfg.statuses).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-1 block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Origen
                </span>
                <div className="mt-0.5 flex gap-2">
                  <input
                    value={formTransport.pickupOrigin}
                    onChange={(e) =>
                      setFormTransport((f) =>
                        f ? { ...f, pickupOrigin: e.target.value } : f,
                      )
                    }
                    className="input-field-sm w-full"
                    placeholder="Escriba o agregue con +…"
                  />
                  <button
                    type="button"
                    onClick={() => setOriginPickerManageOpen(true)}
                    disabled={!projectDestinationOptions.length}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    title={
                      projectDestinationOptions.length
                        ? "Agregar orígenes del proyecto"
                        : "Este proyecto no tiene ubicaciones"
                    }
                  >
                    +
                  </button>
                </div>
                {splitDestinations(formTransport.pickupOrigin).length > 0 ? (
                  <pre className="mt-1 whitespace-pre-wrap text-[10px] leading-tight text-slate-500">
                    {destinationsMetaText(
                      splitDestinations(formTransport.pickupOrigin),
                      projectDestinationOptions,
                    ) || "—"}
                  </pre>
                ) : null}
              </label>
              <label className="col-span-1 block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Destino
                </span>
                <div className="mt-0.5 flex gap-2">
                  <input
                    value={formTransport.deliveryDestination}
                    onChange={(e) =>
                      setFormTransport((f) =>
                        f ? { ...f, deliveryDestination: e.target.value } : f,
                      )
                    }
                    className="input-field-sm w-full"
                    placeholder="Escriba o agregue con +…"
                  />
                  <button
                    type="button"
                    onClick={() => setDestPickerManageOpen(true)}
                    disabled={!projectDestinationOptions.length}
                    className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                    title={
                      projectDestinationOptions.length
                        ? "Agregar destinos del proyecto"
                        : "Este proyecto no tiene ubicaciones"
                    }
                  >
                    +
                  </button>
                </div>
                {splitDestinations(formTransport.deliveryDestination).length > 0 ? (
                  <pre className="mt-1 whitespace-pre-wrap text-[10px] leading-tight text-slate-500">
                    {destinationsMetaText(
                      splitDestinations(formTransport.deliveryDestination),
                      projectDestinationOptions,
                    ) || "—"}
                  </pre>
                ) : null}
              </label>
              <label className="col-span-1 block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Observación
                </span>
                <input
                  value={formTransport.deliveryObservation}
                  onChange={(e) =>
                    setFormTransport((f) =>
                      f ? { ...f, deliveryObservation: e.target.value } : f,
                    )
                  }
                  className="input-field-sm mt-0.5 w-full"
                  placeholder="Descarga / contacto…"
                />
              </label>
              <label className="col-span-2 block">
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300">
                  Sincronizar importación
                </span>
                <select
                  value={syncSnapshotId}
                  onChange={(e) => setSyncSnapshotId(e.target.value)}
                  className="select-field-sm mt-0.5 w-full"
                >
                  <option value="">No, solo inventario</option>
                  {snapshotsForModal.map((sn) => (
                    <option key={sn.id} value={sn.id}>
                      {sn.orderRef ?? sn.title} (
                      {new Date(sn.createdAt).toLocaleDateString()})
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Requiere ID de pallet. Actualiza o crea la fila del pallet en
                  el Excel guardado en el servidor.
                </span>
              </label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="btn-secondary rounded-lg px-4 py-2 text-sm"
                onClick={() => {
                  setManageGroup(null);
                  setFormTransport(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingManage}
                className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-50"
                onClick={() => void saveManage()}
              >
                {savingManage ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LogisticaTransportePage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-slate-600 dark:text-slate-400">
          Cargando…
        </p>
      }
    >
      <LogisticaTransporteInner />
    </Suspense>
  );
}

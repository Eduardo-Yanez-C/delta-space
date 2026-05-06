"use client";

import { useEffect, useRef, useState } from "react";
import type { InventoryTransportOverviewGroup } from "../../lib/api";
import { groupHasTruckIdentity, type TruckCluster } from "../../lib/logistics-truck-cluster";
import {
  logisticsTransportStatusBucket,
  resolveLogisticsTransportStatusId,
  sortStatusDefs,
} from "../../lib/suite-logistics-transport-status-config";
import type { TaskStatusCategory, TaskStatusConfig } from "../../lib/suite-task-status-config";

const DND_MIME = "application/x-pfv-transport-groups";

export type TransportKanbanColumn = {
  key: string;
  label: string;
  chrome: "empty" | "legacy" | TaskStatusCategory;
};

function headerBadgeClass(chrome: TransportKanbanColumn["chrome"]): string {
  switch (chrome) {
    case "not_started":
      return "bg-[#EAB308] text-slate-900 shadow-sm ring-1 ring-amber-400/50";
    case "active":
      return "bg-[#3B82F6] text-white shadow-sm ring-1 ring-sky-400/40";
    case "done":
      return "bg-[#22C55E] text-white shadow-sm ring-1 ring-emerald-400/40";
    case "legacy":
      return "bg-[#A855F7] text-white shadow-sm ring-1 ring-violet-400/40";
    default:
      return "bg-[#64748B] text-white shadow-sm ring-1 ring-slate-400/30";
  }
}

function columnTintClass(chrome: TransportKanbanColumn["chrome"]): string {
  switch (chrome) {
    case "not_started":
      return "border-amber-500/35 bg-gradient-to-b from-amber-500/12 via-transparent to-slate-950/20";
    case "active":
      return "border-sky-500/35 bg-gradient-to-b from-sky-500/14 via-transparent to-slate-950/20";
    case "done":
      return "border-emerald-500/35 bg-gradient-to-b from-emerald-500/12 via-transparent to-slate-950/20";
    case "legacy":
      return "border-violet-500/35 bg-gradient-to-b from-violet-500/12 via-transparent to-slate-950/20";
    default:
      return "border-slate-500/40 bg-gradient-to-b from-slate-600/15 via-transparent to-slate-950/30";
  }
}

function statusDotClass(resolvedId: string | null, cfg: TaskStatusConfig): string {
  if (!resolvedId || !cfg.statuses.some((s) => s.id === resolvedId)) return "bg-slate-500 ring-slate-400/40";
  const def = cfg.statuses.find((s) => s.id === resolvedId)!;
  if (def.category === "not_started") return "bg-[#EAB308] ring-amber-300/50";
  if (def.category === "active") return "bg-[#3B82F6] ring-sky-300/50";
  return "bg-[#22C55E] ring-emerald-300/50";
}

type PalletCardProps = {
  g: InventoryTransportOverviewGroup;
  logisticsStatusCfg: TaskStatusConfig;
  canWrite: boolean;
  onStatusChange: (group: InventoryTransportOverviewGroup, statusId: string) => void;
};

function PalletCard({ g, logisticsStatusCfg, canWrite, onStatusChange }: PalletCardProps) {
  const canMove = Boolean(canWrite && g.project?.id && groupHasTruckIdentity(g));
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

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
    pickupOrigin: null,
    deliveryDestination: null,
    deliveryObservation: null,
  };
  const resolved = resolveLogisticsTransportStatusId(inv.logisticsTransportStatus, logisticsStatusCfg);
  const selectVal = resolved && logisticsStatusCfg.statuses.some((x) => x.id === resolved) ? resolved : null;
  const plate = inv.truckPlate?.trim();
  const company = inv.transportCompany?.trim();

  return (
    <div
      draggable={canMove}
      onDragStart={(e) => {
        if (!canMove) return;
        e.dataTransfer.setData(DND_MIME, JSON.stringify({ groupKeys: [g.groupKey] }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`relative rounded-lg border border-slate-600/80 bg-slate-900/90 p-2 pb-2 pr-9 pt-2 shadow-md ring-1 ring-white/5 transition dark:bg-slate-950/95 ${
        canMove ? "cursor-grab hover:ring-sky-500/30 active:cursor-grabbing" : "opacity-90"
      }`}
    >
      {canMove ? (
        <div ref={wrapRef} className="absolute right-1.5 top-1.5 z-10">
          <button
            type="button"
            title="Elegir estado"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className={`h-6 w-6 shrink-0 rounded-full border-2 border-slate-800 ring-2 ring-offset-1 ring-offset-slate-900 ${statusDotClass(selectVal, logisticsStatusCfg)}`}
          />
          {menuOpen ? (
            <ul
              role="listbox"
              className="absolute right-0 z-20 mt-1 min-w-[156px] rounded-lg border border-slate-600 bg-slate-900 py-1 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <li>
                <button
                  type="button"
                  className="w-full px-2.5 py-1.5 text-left text-[10px] text-slate-300 hover:bg-slate-800"
                  onClick={() => {
                    onStatusChange(g, "");
                    setMenuOpen(false);
                  }}
                >
                  Sin estado
                </button>
              </li>
              {sortStatusDefs(logisticsStatusCfg.statuses).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full px-2.5 py-1.5 text-left text-[10px] hover:bg-slate-800"
                    onClick={() => {
                      onStatusChange(g, s.id);
                      setMenuOpen(false);
                    }}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="pr-8 text-[11px] font-bold leading-tight text-slate-100">{g.project?.code ?? "—"}</p>
      <p className="mt-0.5 font-mono text-[10px] leading-snug text-sky-300/90">{g.palletId ?? "Sin pallet"}</p>
      {(plate || company) && (
        <p className="mt-1 text-[9px] font-medium text-amber-200/90">
          {plate ? plate : ""}
          {plate && company ? " · " : ""}
          {company ?? ""}
        </p>
      )}
      <p className="mt-1 text-[9px] text-slate-500">
        {g.lineCount} lín. · {g.quantitySum} u.
      </p>
      {!selectVal && inv.logisticsTransportStatus?.trim() ? (
        <p className="mt-0.5 truncate text-[9px] italic text-violet-300" title={inv.logisticsTransportStatus}>
          {inv.logisticsTransportStatus}
        </p>
      ) : null}
      {!canMove && canWrite && g.project?.id ? (
        <p className="mt-1 text-[9px] text-amber-200/90">Patente o empresa+viaje en masivo para mover estado.</p>
      ) : null}
    </div>
  );
}

function transportBlockLines(cluster: TruckCluster): {
  plate: string;
  company: string;
  trip: string;
  guide: string;
  conductor: string;
  rut: string;
  rampla: string;
} {
  const inv0 = cluster.groups[0]?.inventoryTransportSummary;
  const inv = inv0 ?? {};
  return {
    plate: String(inv.truckPlate ?? "").trim(),
    company: String(inv.transportCompany ?? "").trim(),
    trip: String(inv.tripNumber ?? "").trim(),
    guide: String(inv.guideNumber ?? "").trim(),
    conductor: String(inv.conductor ?? "").trim(),
    rut: String(inv.driverRut ?? "").trim(),
    rampla: String(inv.trailerPlate ?? "").trim(),
  };
}

type TruckCardProps = {
  cluster: TruckCluster;
  canWrite: boolean;
};

function TruckCard({ cluster, canWrite }: TruckCardProps) {
  const t = transportBlockLines(cluster);
  const isUnassigned = cluster.isOrphanPallet && cluster.clusterKey.startsWith("orphans:");
  const draggable = canWrite && !isUnassigned;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData(DND_MIME, JSON.stringify({ groupKeys: cluster.groupKeys }));
        e.dataTransfer.effectAllowed = "move";
      }}
      className={`rounded-xl border-2 border-sky-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-3 shadow-lg ring-1 ring-sky-500/15 transition ${
        draggable ? "cursor-grab hover:border-sky-400/45 hover:ring-sky-400/20 active:cursor-grabbing" : "opacity-95"
      }`}
    >
      {isUnassigned ? (
        <>
          <p className="text-[13px] font-bold tracking-tight text-amber-100">{cluster.title}</p>
          <p className="mt-1 text-[10px] leading-snug text-amber-200/80">{cluster.subtitle}</p>
        </>
      ) : (
        <>
          <p className="font-mono text-[15px] font-bold leading-tight tracking-wide text-white">
            {t.plate || "Sin patente"}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-slate-200">{t.company || "—"}</p>
          <dl className="mt-2 space-y-1 border-t border-white/10 pt-2 text-[9px] text-slate-400">
            {t.trip ? (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">Viaje</dt>
                <dd className="truncate text-right text-slate-200">{t.trip}</dd>
              </div>
            ) : null}
            {t.guide ? (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">Guía</dt>
                <dd className="truncate text-right text-slate-200">{t.guide}</dd>
              </div>
            ) : null}
            {t.conductor ? (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">Conductor</dt>
                <dd className="truncate text-right text-slate-200">{t.conductor}</dd>
              </div>
            ) : null}
            {t.rut ? (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">RUT</dt>
                <dd className="truncate text-right text-slate-200">{t.rut}</dd>
              </div>
            ) : null}
            {t.rampla ? (
              <div className="flex justify-between gap-2">
                <dt className="shrink-0 text-slate-500">Rampla</dt>
                <dd className="truncate text-right font-mono text-slate-200">{t.rampla}</dd>
              </div>
            ) : null}
          </dl>
        </>
      )}

      <details className="mt-2.5 rounded-lg border border-white/10 bg-black/25 px-2 py-1.5">
        <summary className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-wide text-slate-300 hover:text-white">
          Carga · {cluster.groups.length} pallet{cluster.groups.length === 1 ? "" : "s"}
        </summary>
        <ul className="mt-2 max-h-44 space-y-1 overflow-y-auto border-t border-white/5 pt-2 text-[9px]">
          {cluster.groups.map((g) => (
            <li key={g.groupKey} className="flex flex-col gap-0.5 rounded border border-white/5 bg-slate-950/50 px-1.5 py-1">
              <span className="font-semibold text-slate-200">{g.project?.code ?? "—"}</span>
              <span className="font-mono text-sky-300/90">{g.palletId ?? "—"}</span>
              <span className="text-slate-500">
                {g.lineCount} líneas · {g.quantitySum} u.
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

type TransportKanbanBoardProps = {
  mode: "pallets" | "trucks";
  columns: TransportKanbanColumn[];
  palletGroups: InventoryTransportOverviewGroup[];
  truckClusters: TruckCluster[];
  logisticsStatusCfg: TaskStatusConfig;
  canWrite: boolean;
  onDrop: (groupKeys: string[], statusId: string | null) => void;
  onQuickStatusPallet: (g: InventoryTransportOverviewGroup, statusId: string) => void;
};

export function TransportKanbanBoard({
  mode,
  columns,
  palletGroups,
  truckClusters,
  logisticsStatusCfg,
  canWrite,
  onDrop,
  onQuickStatusPallet,
}: TransportKanbanBoardProps) {
  const colW = mode === "trucks" ? "w-[min(92vw,300px)]" : "w-[min(100vw-2rem,240px)]";

  return (
    <div className="max-h-[min(74vh,680px)] overflow-x-auto rounded-xl border border-slate-700/80 bg-slate-950/40 p-2 dark:bg-slate-950/60">
      <div className="flex min-h-[240px] gap-3 pb-1">
        {columns.map((col) => {
          const palletCards =
            mode === "pallets"
              ? palletGroups.filter((g) => {
                  const b = logisticsTransportStatusBucket(
                    g.inventoryTransportSummary?.logisticsTransportStatus,
                    logisticsStatusCfg,
                  );
                  return b === col.key;
                })
              : [];
          const truckCards =
            mode === "trucks"
              ? truckClusters.filter((c) => {
                  return c.bucketKey === col.key;
                })
              : [];

          const count = mode === "pallets" ? palletCards.length : truckCards.length;

          const droppable =
            canWrite && col.key !== "__legacy__" && (col.key === "__empty__" || logisticsStatusCfg.statuses.some((s) => s.id === col.key));

          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (!droppable) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                if (!droppable) return;
                e.preventDefault();
                const raw = e.dataTransfer.getData(DND_MIME);
                if (!raw) return;
                try {
                  const { groupKeys } = JSON.parse(raw) as { groupKeys: string[] };
                  if (!Array.isArray(groupKeys) || !groupKeys.length) return;
                  const statusId = col.key === "__empty__" ? null : col.key;
                  void onDrop(groupKeys, statusId);
                } catch {
                  /* noop */
                }
              }}
              className={`flex ${colW} shrink-0 flex-col overflow-hidden rounded-xl border-2 ${columnTintClass(col.chrome)}`}
            >
              <header className="flex items-center justify-between gap-2 border-b border-white/5 px-2.5 py-2">
                <span
                  className={`inline-flex max-w-[min(220px,75vw)] items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${headerBadgeClass(col.chrome)}`}
                >
                  <span className="truncate">{col.label}</span>
                </span>
                <span className="shrink-0 rounded-md bg-black/25 px-1.5 py-0.5 text-[11px] font-semibold text-slate-200">
                  {count}
                </span>
              </header>
              <div className="max-h-[min(60vh,560px)] space-y-2.5 overflow-y-auto p-2">
                {mode === "pallets"
                  ? palletCards.map((g) => (
                      <PalletCard
                        key={g.groupKey}
                        g={g}
                        logisticsStatusCfg={logisticsStatusCfg}
                        canWrite={canWrite}
                        onStatusChange={onQuickStatusPallet}
                      />
                    ))
                  : truckCards.map((c) => (
                      <TruckCard key={c.clusterKey} cluster={c} canWrite={canWrite} />
                    ))}
              </div>
            </div>
          );
        })}
      </div>
      {canWrite ? (
        <p className="px-1 pb-1 text-[10px] text-slate-500">
          {mode === "trucks"
            ? "Arrastre el bloque del camión entre columnas. Abra «Carga» para ver los pallets. Sin desplegable: el estado lo marca la columna."
            : "Arrastre la tarjeta o use el círculo para cambiar de estado."}
        </p>
      ) : null}
    </div>
  );
}

import type { InventoryTransportOverviewGroup } from "./api";
import { logisticsTransportStatusBucket } from "./suite-logistics-transport-status-config";
import type { TaskStatusConfig } from "./suite-task-status-config";

/** Bloque de camión: varios pallets comparten transportista + patente + viaje (u huerfanos 1:1). */
export type TruckCluster = {
  clusterKey: string;
  title: string;
  subtitle: string;
  groups: InventoryTransportOverviewGroup[];
  groupKeys: string[];
  /** Columna del tablero donde se muestra (voto mayoritario entre pallets del bloque). */
  bucketKey: string;
  isOrphanPallet: boolean;
};

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Clave de camión: sin patente ni par empresa+viaje → cada pallet es su propio bloque (huerfano).
 */
/** Patente o (empresa + viaje): mínimo para considerar transporte asignado y permitir mover estado en tablero. */
export function groupHasTruckIdentity(g: InventoryTransportOverviewGroup): boolean {
  const inv = g.inventoryTransportSummary;
  const plate = norm(inv?.truckPlate);
  const company = norm(inv?.transportCompany);
  const trip = norm(inv?.tripNumber);
  return Boolean(plate || (company && trip));
}

export function truckClusterKey(g: InventoryTransportOverviewGroup): string {
  if (!groupHasTruckIdentity(g)) {
    return `orphan:${g.groupKey}`;
  }
  const inv = g.inventoryTransportSummary;
  const plate = norm(inv?.truckPlate);
  const company = norm(inv?.transportCompany);
  const trip = norm(inv?.tripNumber);
  return `truck:${company}|${plate}|${trip}`;
}

function majorityBucket(
  groups: InventoryTransportOverviewGroup[],
  cfg: TaskStatusConfig,
): string {
  const counts = new Map<string, number>();
  for (const g of groups) {
    const b = logisticsTransportStatusBucket(g.inventoryTransportSummary?.logisticsTransportStatus, cfg);
    counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  let best = "__empty__";
  let n = -1;
  for (const [k, c] of counts) {
    if (c > n) {
      n = c;
      best = k;
    }
  }
  return best;
}

function clusterTitle(groups: InventoryTransportOverviewGroup[]): { title: string; subtitle: string; orphan: boolean } {
  const g0 = groups[0];
  const inv = g0.inventoryTransportSummary;
  const plate = String(inv?.truckPlate ?? "").trim();
  const company = String(inv?.transportCompany ?? "").trim();
  const trip = String(inv?.tripNumber ?? "").trim();
  const conductor = String(inv?.conductor ?? "").trim();
  const orphan = truckClusterKey(g0).startsWith("orphan:");
  if (orphan) {
    return {
      title: g0.palletId ? `Pallet ${g0.palletId}` : "Sin pallet",
      subtitle: [g0.project?.code, g0.lineCount ? `${g0.lineCount} líneas` : ""].filter(Boolean).join(" · "),
      orphan: true,
    };
  }
  const main = plate ? plate : company ? company : "Camión";
  const sub = [company && !plate ? company : null, trip ? `Viaje ${trip}` : null, conductor, `${groups.length} pallet(s)`]
    .filter(Boolean)
    .join(" · ");
  return { title: main, subtitle: sub, orphan: false };
}

const ORPHANS_BULK_KEY = "orphans:unassigned";

export function buildTruckClusters(
  groups: InventoryTransportOverviewGroup[],
  cfg: TaskStatusConfig,
): TruckCluster[] {
  const m = new Map<string, InventoryTransportOverviewGroup[]>();
  for (const g of groups) {
    const k = truckClusterKey(g);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(g);
  }
  const out: TruckCluster[] = [];
  const orphanBulk: InventoryTransportOverviewGroup[] = [];
  for (const [clusterKey, gs] of m) {
    if (clusterKey.startsWith("orphan:")) {
      orphanBulk.push(...gs);
      continue;
    }
    const { title, subtitle, orphan } = clusterTitle(gs);
    out.push({
      clusterKey,
      title,
      subtitle,
      groups: gs,
      groupKeys: gs.map((x) => x.groupKey),
      bucketKey: majorityBucket(gs, cfg),
      isOrphanPallet: orphan,
    });
  }
  if (orphanBulk.length) {
    out.push({
      clusterKey: ORPHANS_BULK_KEY,
      title: "Sin camión asignado",
      subtitle: `${orphanBulk.length} pallet(s) · defina transporte en masivo`,
      groups: orphanBulk,
      groupKeys: orphanBulk.map((x) => x.groupKey),
      bucketKey: majorityBucket(orphanBulk, cfg),
      isOrphanPallet: true,
    });
  }
  out.sort((a, b) => {
    if (a.clusterKey === ORPHANS_BULK_KEY) return 1;
    if (b.clusterKey === ORPHANS_BULK_KEY) return -1;
    return a.title.localeCompare(b.title, "es");
  });
  return out;
}

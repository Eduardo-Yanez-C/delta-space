/**
 * Líder LAN único (automático, una BD activa compartida):
 * - Semillas: caché, peers vistos, mismo host que la URL, luego locales (Nest embebido :4000).
 * - Expansión: GET /lan/discovery por cada Nest sano (UDP multicast entre instancias).
 * - Si el cluster tiene algún API no loopback, el líder nunca es 127.0.0.1 (evita BDs divergentes).
 * - Orden determinista host+puerto; sticky mientras el líder esté sano; failover al siguiente sano.
 * - Shell empaquetado participa igual; `getApiBase()` debe usar `pv_quoting_lan_auto_resolved`.
 *
 * No importa `api.ts` (evita ciclos).
 */

import {
  clearAutoResolvedBase,
  getAutoResolvedEntry,
  getRoutingIntent,
  getSeenPeerBases,
  isLoopbackApiBaseUrl,
  normalizeApiBase,
  peerDiscoveryToApiBase,
  setAutoResolvedBase,
  setSeenPeerBases,
  buildLocalApiBaseCandidates,
  buildSameOriginLanApiCandidates,
} from "./lan-routing";

const DISCOVERY_TIMEOUT_MS = 8000;
const HEALTH_TIMEOUT_MS = 5000;
const SUBNET_SCAN_KEY = "pv_quoting_lan_subnet_scan_v1";

type DiscoveryJson = {
  peers?: Array<{ address: string; apiPort: number }>;
};

async function probeHealth(apiBase: string): Promise<boolean> {
  const base = normalizeApiBase(apiBase);
  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/health`, {
      signal: ac.signal,
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return false;
    const j = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return j?.ok === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(t);
  }
}

async function fetchDiscoveryRaw(apiBase: string): Promise<DiscoveryJson | null> {
  const base = normalizeApiBase(apiBase);
  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/lan/discovery`, { signal: ac.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json().catch(() => null)) as DiscoveryJson | null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

function mergeSeenPeers(current: string[], fromDiscovery: string[]): string[] {
  const set = new Set<string>();
  for (const u of [...current, ...fromDiscovery]) {
    const n = normalizeApiBase(u);
    if (n) set.add(n);
  }
  return [...set].slice(0, 48);
}

function compareStableApiBase(a: string, b: string): number {
  try {
    const ua = new URL(a.startsWith("http") ? a : `http://${a}`);
    const ub = new URL(b.startsWith("http") ? b : `http://${b}`);
    const pa = ua.port || (ua.protocol === "https:" ? "443" : "80");
    const pb = ub.port || (ub.protocol === "https:" ? "443" : "80");
    const sa = `${ua.hostname}\0${pa}`;
    const sb = `${ub.hostname}\0${pb}`;
    return sa.localeCompare(sb, "en");
  } catch {
    return normalizeApiBase(a).localeCompare(normalizeApiBase(b));
  }
}

/** Orden del líder: estable; excluye loopback si hay al menos un API rutabale en el cluster. */
function sortedLeaderCandidates(healthy: Set<string>, excludeLoopback: boolean): string[] {
  const all = [...healthy].sort(compareStableApiBase);
  if (!excludeLoopback) return all;
  const routable = all.filter((x) => !isLoopbackApiBaseUrl(x));
  return routable.length > 0 ? routable : all;
}

/** Expande desde semillas: cualquier Nest que responda health aporta su tabla UDP de peers. */
async function collectHealthyClusterFromSeeds(seedBases: string[]): Promise<Set<string>> {
  const healthy = new Set<string>();
  let frontier = [...new Set(seedBases.map((s) => normalizeApiBase(s)).filter(Boolean))];

  for (let round = 0; round < 6 && frontier.length > 0; round++) {
    const next: string[] = [];
    await Promise.all(
      frontier.map(async (raw) => {
        const n = normalizeApiBase(raw);
        if (healthy.has(n)) return;
        if (!(await probeHealth(n))) return;
        healthy.add(n);
        const disc = await fetchDiscoveryRaw(n);
        for (const p of disc?.peers ?? []) {
          const u = normalizeApiBase(peerDiscoveryToApiBase(p.address, p.apiPort));
          if (u && !healthy.has(u)) next.push(u);
        }
      }),
    );
    frontier = [...new Set(next.map((x) => normalizeApiBase(x)).filter(Boolean))].filter(
      (x) => !healthy.has(x),
    );
  }

  return healthy;
}

function privateLanIpv4(hostname: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname.trim());
  if (!m) return false;
  const a = +m[1];
  const b = +m[2];
  if (a > 255 || b > 255 || +m[3] > 255 || +m[4] > 255) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function subnetProbeOrder(hostname: string): string[] {
  if (!privateLanIpv4(hostname)) return [];
  const parts = hostname.split(".").map(Number);
  const prefix = `${parts[0]}.${parts[1]}.${parts[2]}.`;
  const self = parts[3];
  const octets: number[] = [];
  const add = (from: number, to: number) => {
    for (let o = from; o <= to; o++) {
      if (o !== self && o >= 1 && o <= 254) octets.push(o);
    }
  };
  add(1, 40);
  add(90, 140);
  add(180, 230);
  add(240, 254);
  return [...new Set(octets)].map((o) => normalizeApiBase(`http://${prefix}${o}:4000/api`));
}

async function probeFirstHitParallel(bases: string[], concurrency: number): Promise<string | null> {
  for (let i = 0; i < bases.length; i += concurrency) {
    const slice = bases.slice(i, i + concurrency);
    const hits = await Promise.all(slice.map(async (b) => ((await probeHealth(b)) ? b : null)));
    const found = hits.find((x) => x != null);
    if (found) return found;
  }
  return null;
}

function subnetScanAlreadyDone(): boolean {
  try {
    return sessionStorage.getItem(SUBNET_SCAN_KEY) === "1";
  } catch {
    return true;
  }
}

function markSubnetScanDone(): void {
  try {
    sessionStorage.setItem(SUBNET_SCAN_KEY, "1");
  } catch {
    /* no-op */
  }
}

function dispatchApiBaseChanged(): void {
  try {
    window.dispatchEvent(new Event("pvquoting:api-base-changed"));
  } catch {
    /* no-op */
  }
}

/**
 * Ejecuta un ciclo si `routingIntent === automatic` (navegador y shell empaquetado).
 */
export async function runLanBackendResolution(bumpRouting: () => void): Promise<void> {
  if (typeof window === "undefined") return;
  if (getRoutingIntent() !== "automatic") return;

  const cached = getAutoResolvedEntry()?.baseUrl;
  /** Priorizar caché y peers LAN antes que loopback local para expandir el cluster antes de elegir líder. */
  const seedsUnique = [
    ...(cached ? [normalizeApiBase(cached)] : []),
    ...getSeenPeerBases().map(normalizeApiBase),
    ...buildSameOriginLanApiCandidates(),
    ...buildLocalApiBaseCandidates(),
  ];

  const seeds = [...new Set(seedsUnique.map(normalizeApiBase).filter(Boolean))];

  let healthy = await collectHealthyClusterFromSeeds(seeds);

  if (healthy.size === 0 && !subnetScanAlreadyDone()) {
    const host = window.location.hostname;
    const subnetBases = subnetProbeOrder(host);
    markSubnetScanDone();
    if (subnetBases.length > 0) {
      const hit = await probeFirstHitParallel(subnetBases, 14);
      if (hit) {
        healthy = await collectHealthyClusterFromSeeds([hit]);
      }
    }
  }

  const hasRoutableLanBackend = [...healthy].some((x) => !isLoopbackApiBaseUrl(x));
  const sorted = sortedLeaderCandidates(healthy, hasRoutableLanBackend);
  const prevNorm = cached ? normalizeApiBase(cached) : null;
  let winner: string | null = null;

  if (prevNorm && healthy.has(prevNorm)) {
    const stickyIsLoopback = isLoopbackApiBaseUrl(prevNorm);
    const hasRoutable = sorted.some((x) => !isLoopbackApiBaseUrl(x));
    if (hasRoutableLanBackend && stickyIsLoopback && hasRoutable) {
      winner = sorted[0]!;
    } else {
      winner = prevNorm;
    }
  } else if (sorted.length > 0) {
    winner = sorted[0]!;
  }

  if (winner) {
    const prev = getAutoResolvedEntry()?.baseUrl;
    setAutoResolvedBase(winner);
    const discovery = await fetchDiscoveryRaw(winner);
    const peerUrls =
      discovery?.peers?.map((p) => peerDiscoveryToApiBase(p.address, p.apiPort)) ?? [];
    if (peerUrls.length > 0) {
      setSeenPeerBases(mergeSeenPeers(getSeenPeerBases(), peerUrls));
    }
    if (prev !== winner) {
      bumpRouting();
      dispatchApiBaseChanged();
    }
  } else {
    const had = getAutoResolvedEntry() != null;
    clearAutoResolvedBase();
    if (had) {
      bumpRouting();
      dispatchApiBaseChanged();
    }
  }
}

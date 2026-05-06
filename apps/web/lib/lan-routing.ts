/**
 * Enrutamiento opcional del front hacia un API en otro equipo de la LAN (ETAPA 2).
 * Independiente de `pv_quoting_install_config` para no pisar la URL de /setup al volver a "automático".
 */

import { getLocalConfig } from "./local-config";

const STORAGE_KEY = "pv_quoting_lan_routing";
const ROUTING_INTENT_KEY = "pv_quoting_lan_routing_intent";
const AUTO_RESOLVED_KEY = "pv_quoting_lan_auto_resolved";
const SEEN_PEERS_KEY = "pv_quoting_lan_seen_peer_bases";

export type RoutingIntent = "automatic" | "manual";

export type LanRoutingState = {
  mode: "auto" | "lan_peer";
  /** Base del API, ej. http://192.168.1.10:4000/api (sin barra final). */
  peerBaseUrl?: string;
  peerHostname?: string;
  peerAddress?: string;
  chosenAt?: string;
};

export function normalizeApiBase(u: string): string {
  return u.trim().replace(/\/$/, "");
}

/** True si la base apunta a localhost / 127.0.0.1 / ::1 (una BD distinta por máquina; no es líder LAN compartido). */
export function isLoopbackApiBaseUrl(base: string): boolean {
  try {
    const u = new URL(base.includes("://") ? base : `http://${base}`);
    const h = u.hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
  } catch {
    return false;
  }
}

function computeEnvFallbackApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL;
  const envUrl =
    typeof raw === "string" && raw.trim() !== ""
      ? raw.trim().replace(/\/$/, "")
      : null;
  if (envUrl && !envUrl.startsWith("/")) return envUrl;
  return "http://localhost:4000/api";
}

/**
 * Candidatos «locales» para modo automático (orden de prueba del resolver).
 * Alineado con la cadena de fallback de `getApiBase` sin usar caché de resolución.
 */
export function buildLocalApiBaseCandidates(): string[] {
  if (typeof window === "undefined") {
    return [computeEnvFallbackApiBase()];
  }
  const list: string[] = [];
  const isLocalNextDev =
    process.env.NODE_ENV === "development" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (!isLocalNextDev) {
    const c = getLocalConfig();
    if (c?.apiBaseUrl) {
      list.push(normalizeApiBase(c.apiBaseUrl));
    }
  }
  list.push(normalizeApiBase(computeEnvFallbackApiBase()));
  return [...new Set(list.filter(Boolean))];
}

/**
 * Si la web se sirve desde una IP o nombre de la LAN (no localhost), el API suele estar en el mismo host :4000.
 */
export function buildSameOriginLanApiCandidates(): string[] {
  if (typeof window === "undefined") return [];
  const { hostname } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return [];
  const host = hostname.includes(":") && !hostname.startsWith("[") ? `[${hostname}]` : hostname;
  return [normalizeApiBase(`http://${host}:4000/api`)];
}

export function getLanRouting(): LanRoutingState {
  if (typeof window === "undefined") return { mode: "auto" };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { mode: "auto" };
    const o = JSON.parse(raw) as Partial<LanRoutingState>;
    if (o.mode === "lan_peer" && typeof o.peerBaseUrl === "string" && o.peerBaseUrl.trim() !== "") {
      return {
        mode: "lan_peer",
        peerBaseUrl: normalizeApiBase(o.peerBaseUrl),
        peerHostname: typeof o.peerHostname === "string" ? o.peerHostname : undefined,
        peerAddress: typeof o.peerAddress === "string" ? o.peerAddress : undefined,
        chosenAt: typeof o.chosenAt === "string" ? o.chosenAt : undefined,
      };
    }
  } catch {
    /* no-op */
  }
  return { mode: "auto" };
}

export function getRoutingIntent(): RoutingIntent {
  if (typeof window === "undefined") return "manual";
  try {
    const raw = window.localStorage.getItem(ROUTING_INTENT_KEY);
    if (raw === "automatic") {
      window.localStorage.setItem(ROUTING_INTENT_KEY, "manual");
      clearAutoResolvedBase();
      notifyApiBaseChanged();
    }
    if (raw === "manual" || raw === "automatic") {
      return "manual";
    }
  } catch {
    /* no-op */
  }
  const lan = getLanRouting();
  if (lan.mode === "lan_peer" && lan.peerBaseUrl) {
    return "manual";
  }
  return "manual";
}

export function setRoutingIntent(intent: RoutingIntent): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ROUTING_INTENT_KEY, intent);
}

/** @deprecated El backend ya no se elige por líder LAN automático; use `setRoutingIntent("manual")` y `clearLanPeerRouting`. */
export function setRoutingIntentAutomatic(): void {
  setRoutingIntent("manual");
  clearAutoResolvedBase();
}

/** Notifica a la app (p. ej. reconexión de socket) tras cambiar la base del API en este perfil. */
export function notifyApiBaseChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("pvquoting:api-base-changed"));
}

export type AutoResolvedEntry = { baseUrl: string; savedAt: number };

export function getAutoResolvedEntry(): AutoResolvedEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTO_RESOLVED_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<AutoResolvedEntry>;
    if (typeof o.baseUrl === "string" && o.baseUrl.trim() !== "" && typeof o.savedAt === "number") {
      return { baseUrl: normalizeApiBase(o.baseUrl), savedAt: o.savedAt };
    }
  } catch {
    /* no-op */
  }
  return null;
}

export function setAutoResolvedBase(baseUrl: string): void {
  if (typeof window === "undefined") return;
  const entry: AutoResolvedEntry = {
    baseUrl: normalizeApiBase(baseUrl),
    savedAt: Date.now(),
  };
  window.localStorage.setItem(AUTO_RESOLVED_KEY, JSON.stringify(entry));
}

export function clearAutoResolvedBase(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTO_RESOLVED_KEY);
}

export function getSeenPeerBases(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_PEERS_KEY);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(normalizeApiBase);
  } catch {
    return [];
  }
}

export function setSeenPeerBases(bases: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SEEN_PEERS_KEY, JSON.stringify(bases));
}

/**
 * Valida URL manual de API para routing LAN.
 * Reglas MVP: URL absoluta http/https y path final `/api`.
 */
export function parseManualApiBase(input: string): { ok: true; apiBaseUrl: string } | { ok: false; error: string } {
  const raw = normalizeApiBase(input);
  if (!raw) return { ok: false, error: "Ingrese una URL de API." };
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "Formato inválido. Use una URL completa, ej. http://192.168.1.45:4000/api" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "La URL debe comenzar con http:// o https://." };
  }
  if (u.pathname.replace(/\/+$/, "") !== "/api") {
    return { ok: false, error: "La URL debe apuntar al API y terminar en /api." };
  }
  return { ok: true, apiBaseUrl: normalizeApiBase(u.toString()) };
}

/** URL base del API para un peer descubierto (HTTP en LAN). */
export function peerDiscoveryToApiBase(address: string, apiPort: number): string {
  const host = address.includes(":") && !address.startsWith("[") ? `[${address}]` : address;
  return normalizeApiBase(`http://${host}:${apiPort}/api`);
}

export function setLanPeerRouting(peer: {
  peerBaseUrl: string;
  peerHostname?: string;
  peerAddress?: string;
}): void {
  if (typeof window === "undefined") return;
  const peerBaseUrl = normalizeApiBase(peer.peerBaseUrl);
  if (!peerBaseUrl) return;
  const s: LanRoutingState = {
    mode: "lan_peer",
    peerBaseUrl,
    peerHostname: peer.peerHostname,
    peerAddress: peer.peerAddress,
    chosenAt: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  setRoutingIntent("manual");
  notifyApiBaseChanged();
}

export function clearLanPeerRouting(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  notifyApiBaseChanged();
}

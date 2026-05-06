"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import {
  fetchLanDiscovery,
  probeApiHealth,
  healthUrl,
  getApiBase,
  isDesktopPackagedWebShell,
  isLikelyLocalApiBase,
  type LanDiscoveryResponse,
} from "../../lib/api";
import {
  getLanRouting,
  setLanPeerRouting,
  clearLanPeerRouting,
  clearAutoResolvedBase,
  setRoutingIntent,
  peerDiscoveryToApiBase,
  parseManualApiBase,
  getRoutingIntent,
  type LanRoutingState,
  type RoutingIntent,
} from "../../lib/lan-routing";

export type LanRoutingSnapshot = LanRoutingState & { intent: RoutingIntent };

export type ConnLabel = "offline" | "lan_peer" | "local" | "other";

function classifyConnection(apiUp: boolean, snapshot: LanRoutingSnapshot, base: string): ConnLabel {
  if (!apiUp) return "offline";
  if (snapshot.mode === "lan_peer") return "lan_peer";
  if (isLikelyLocalApiBase(base)) return "local";
  return "other";
}

export type UseLanConnectivityResult = {
  discovery: LanDiscoveryResponse | null;
  discoveryErr: string | null;
  apiUp: boolean;
  routingSnapshot: LanRoutingSnapshot;
  routingTick: number;
  bumpRouting: () => void;
  syncRouting: () => void;
  refreshDiscovery: () => void;
  panelMessage: string | null;
  setPanelMessage: (m: string | null) => void;
  panelSuccess: string | null;
  setPanelSuccess: (m: string | null) => void;
  connectingKey: string | null;
  connectToPeer: (
    p: LanDiscoveryResponse["peers"][number],
    options: { logoutAfter: boolean; onSuccess?: () => void },
  ) => Promise<void>;
  connectToManual: (
    inputApiBaseUrl: string,
    options: { logoutAfter: boolean; onSuccess?: () => void },
  ) => Promise<void>;
  revertToLocalNode: (options: { logoutAfter: boolean; onSuccess?: () => void }) => void;
  base: string;
  packaged: boolean;
  conn: ConnLabel;
  statusLine: string;
  shortBadge: string;
  badgeColor: string;
};

export function useLanConnectivity(): UseLanConnectivityResult {
  const { logout } = useAuth();
  const [discovery, setDiscovery] = useState<LanDiscoveryResponse | null>(null);
  const [discoveryErr, setDiscoveryErr] = useState<string | null>(null);
  const [apiUp, setApiUp] = useState(false);
  const [routingSnapshot, setRoutingSnapshot] = useState<LanRoutingSnapshot>(() => ({
    ...getLanRouting(),
    intent: getRoutingIntent(),
  }));
  const [routingTick, setRoutingTick] = useState(0);
  const [connectingKey, setConnectingKey] = useState<string | null>(null);
  const [panelMessage, setPanelMessage] = useState<string | null>(null);
  /** Confirmación (p. ej. login sin cerrar sesión). */
  const [panelSuccess, setPanelSuccess] = useState<string | null>(null);

  const bumpRouting = useCallback(() => setRoutingTick((x) => x + 1), []);

  const syncRouting = useCallback(() => {
    setRoutingSnapshot({ ...getLanRouting(), intent: getRoutingIntent() });
  }, []);

  useEffect(() => {
    syncRouting();
  }, [routingTick, syncRouting]);

  const refreshDiscovery = useCallback(() => {
    const ac = new AbortController();
    const t = window.setTimeout(() => ac.abort(), 8000);
    fetchLanDiscovery(ac.signal)
      .then((d) => {
        window.clearTimeout(t);
        setDiscovery(d);
        setDiscoveryErr(null);
      })
      .catch((e) => {
        window.clearTimeout(t);
        setDiscovery(null);
        setDiscoveryErr(e instanceof Error ? e.message : "No se pudo obtener discovery");
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      refreshDiscovery();
    };
    run();
    const id = window.setInterval(run, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [refreshDiscovery]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      const ac = new AbortController();
      fetch(healthUrl(), { signal: ac.signal, cache: "no-store", credentials: "omit" })
        .then(async (r) => {
          if (cancelled) return;
          if (!r.ok) {
            setApiUp(false);
            return;
          }
          const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
          setApiUp(j?.ok === true);
        })
        .catch(() => {
          if (!cancelled) setApiUp(false);
        });
    };
    run();
    const id = window.setInterval(run, 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [routingTick]);

  const base = getApiBase();
  const packaged = isDesktopPackagedWebShell();
  const conn = classifyConnection(apiUp, routingSnapshot, base);

  const statusLine =
    conn === "offline"
      ? "Sin conexión con la aplicación"
      : conn === "lan_peer"
        ? "Nodo de datos remoto (supervisión)"
        : "Nodo de datos: este equipo";

  const shortBadge =
    conn === "offline" ? "Sin conexión" : conn === "lan_peer" ? "Nodo remoto" : "Local";

  const badgeColor =
    conn === "offline"
      ? "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      : conn === "lan_peer"
        ? "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-700 dark:bg-violet-950/50 dark:text-violet-100"
        : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-100";

  const connectToPeer = useCallback(
    async (
      p: LanDiscoveryResponse["peers"][number],
      options: { logoutAfter: boolean; onSuccess?: () => void },
    ) => {
      setPanelMessage(null);
      setPanelSuccess(null);
      const peerBase = peerDiscoveryToApiBase(p.address, p.apiPort);
      const rowKey = `${p.instanceId}:${p.address}`;
      setConnectingKey(rowKey);
      try {
        const ac = new AbortController();
        const to = window.setTimeout(() => ac.abort(), 10_000);
        const probe = await probeApiHealth(peerBase, ac.signal);
        window.clearTimeout(to);
        if (!probe.ok) {
          setPanelMessage(
            `No se pudo validar el nodo (${probe.error ?? "fallo"}). Compruebe firewall, CORS_ORIGIN en el servidor remoto y que exponga GET /api/health.`,
          );
          return;
        }
        setLanPeerRouting({
          peerBaseUrl: peerBase,
          peerHostname: p.hostname,
          peerAddress: p.address,
        });
        bumpRouting();
        syncRouting();
        if (!options.logoutAfter) {
          setPanelSuccess(
            "Conectado al nodo de datos remoto. Use credenciales válidas en ese servidor. El chat LAN sigue en su red.",
          );
        }
        options.onSuccess?.();
        if (options.logoutAfter) logout();
      } finally {
        setConnectingKey(null);
      }
    },
    [bumpRouting, syncRouting, logout],
  );

  const connectToManual = useCallback(
    async (inputApiBaseUrl: string, options: { logoutAfter: boolean; onSuccess?: () => void }) => {
      setPanelMessage(null);
      setPanelSuccess(null);
      const parsed = parseManualApiBase(inputApiBaseUrl);
      if (!parsed.ok) {
        setPanelMessage(parsed.error);
        return;
      }
      const apiBaseUrl = parsed.apiBaseUrl;
      setConnectingKey("manual");
      try {
        const ac = new AbortController();
        const to = window.setTimeout(() => ac.abort(), 10_000);
        const probe = await probeApiHealth(apiBaseUrl, ac.signal);
        window.clearTimeout(to);
        if (!probe.ok) {
          setPanelMessage(`No se pudo validar la URL manual (${probe.error ?? "fallo"}).`);
          return;
        }
        const u = new URL(apiBaseUrl);
        setLanPeerRouting({
          peerBaseUrl: apiBaseUrl,
          peerHostname: u.hostname,
          peerAddress: u.hostname,
        });
        bumpRouting();
        syncRouting();
        if (!options.logoutAfter) {
          setPanelSuccess(
            "URL de API aplicada. Inicie sesión con un usuario de ese nodo si aún no lo ha hecho.",
          );
        }
        options.onSuccess?.();
        if (options.logoutAfter) logout();
      } finally {
        setConnectingKey(null);
      }
    },
    [bumpRouting, syncRouting, logout],
  );

  const revertToLocalNode = useCallback(
    (options: { logoutAfter: boolean; onSuccess?: () => void }) => {
      setPanelMessage(null);
      setPanelSuccess(null);
      clearLanPeerRouting();
      clearAutoResolvedBase();
      setRoutingIntent("manual");
      bumpRouting();
      syncRouting();
      if (!options.logoutAfter) {
        setPanelSuccess("Volvió al nodo de datos de este equipo (cotizaciones y catálogo locales).");
      }
      options.onSuccess?.();
      if (options.logoutAfter) logout();
    },
    [bumpRouting, syncRouting, logout],
  );

  return {
    discovery,
    discoveryErr,
    apiUp,
    routingSnapshot,
    routingTick,
    bumpRouting,
    syncRouting,
    refreshDiscovery,
    panelMessage,
    setPanelMessage,
    panelSuccess,
    setPanelSuccess,
    connectingKey,
    connectToPeer,
    connectToManual,
    revertToLocalNode,
    base,
    packaged,
    conn,
    statusLine,
    shortBadge,
    badgeColor,
  };
}

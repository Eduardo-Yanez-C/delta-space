"use client";

import { useState } from "react";
import type { LanDiscoveryResponse } from "../../lib/api";
import { normalizeApiBase, peerDiscoveryToApiBase } from "../../lib/lan-routing";
import type { UseLanConnectivityResult } from "./useLanConnectivity";

export type LanNodeSelectorPanelProps = {
  connectivity: UseLanConnectivityResult;
  logoutAfterRoutingChange: boolean;
  onRoutingApplied?: () => void;
  /** Texto del pie (CORS / sesión). */
  footerNote?: string;
  className?: string;
  enableManualUrlInput?: boolean;
  audience?: "technical" | "user";
};

export function LanNodeSelectorPanel({
  connectivity,
  logoutAfterRoutingChange,
  onRoutingApplied,
  footerNote,
  className = "",
  enableManualUrlInput = false,
  audience = "technical",
}: LanNodeSelectorPanelProps) {
  const {
    discovery,
    discoveryErr,
    routingSnapshot,
    connectingKey,
    panelMessage,
    panelSuccess,
    connectToPeer,
    connectToManual,
    revertToLocalNode,
    base,
    packaged,
    statusLine,
  } = connectivity;
  const [manualUrl, setManualUrl] = useState("");

  const handleConnectPeer = async (p: LanDiscoveryResponse["peers"][number]) => {
    await connectToPeer(p, {
      logoutAfter: logoutAfterRoutingChange,
      onSuccess: onRoutingApplied,
    });
  };

  const handleBackToLocal = () => {
    revertToLocalNode({
      logoutAfter: logoutAfterRoutingChange,
      onSuccess: onRoutingApplied,
    });
  };

  const handleConnectManual = async () => {
    await connectToManual(manualUrl, {
      logoutAfter: logoutAfterRoutingChange,
      onSuccess: onRoutingApplied,
    });
  };

  const isUserAudience = audience === "user";

  const defaultFooter = logoutAfterRoutingChange
    ? "Tras conectar a otro nodo o volver al local se cerrará la sesión: inicie sesión de nuevo. El servidor remoto debe permitir CORS (CORS_ORIGIN)."
    : "Las cotizaciones y el catálogo salen del API indicado. El servidor remoto debe permitir CORS desde este origen (CORS_ORIGIN). El chat LAN no usa este enlace.";

  return (
    <div className={className}>
      <p className="font-medium text-slate-800 dark:text-slate-100">
        {isUserAudience ? "Elija con qué equipo trabajar" : statusLine}
      </p>
      {isUserAudience ? (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Nodo de datos:{" "}
          {routingSnapshot.mode === "lan_peer" ? "servidor remoto (supervisión)" : "este equipo (local)"}
        </p>
      ) : (
        <>
          <p className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Nodo de datos: </span>
            {routingSnapshot.mode === "lan_peer" ? "remoto (elegido manualmente)" : "local (este equipo)"}
          </p>
          <p className="mt-0.5 break-all text-xs text-slate-500 dark:text-slate-400">API activa: {base}</p>
        </>
      )}

      {packaged && (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
          En escritorio, los datos de negocio salen del API embebido en este equipo salvo que conecte manualmente a otro
          nodo. No hay sincronización automática de cotizaciones entre equipos.
        </p>
      )}

      {routingSnapshot.mode === "lan_peer" && (
        <button type="button" onClick={handleBackToLocal} className="btn-secondary mt-3 w-full py-2 text-xs">
          Volver al nodo de datos de este equipo
        </button>
      )}

      {!packaged && enableManualUrlInput && (
        <div className="mt-3 rounded border border-slate-200 bg-slate-50/90 p-2 dark:border-slate-700 dark:bg-slate-900">
          <label htmlFor="manual-api-url" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">
            {isUserAudience ? "Conectar manualmente" : "URL manual de API"}
          </label>
          <input
            id="manual-api-url"
            type="text"
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder={isUserAudience ? "Ej: http://192.168.1.45:4000/api" : "http://192.168.1.45:4000/api"}
            className="input-field w-full text-xs"
          />
          <button
            type="button"
            onClick={handleConnectManual}
            disabled={connectingKey !== null}
            className="btn-primary mt-2 w-full py-1.5 text-xs disabled:opacity-50"
          >
            {connectingKey === "manual"
              ? "Validando…"
              : isUserAudience
                ? "Conectar manualmente"
                : "Conectar por URL manual"}
          </button>
        </div>
      )}

      {panelSuccess && (
        <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
          {panelSuccess}
        </p>
      )}
      {panelMessage && (
        <p className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {panelMessage}
        </p>
      )}

      <>
          <h4 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {isUserAudience ? "Equipos detectados en la red" : "Nodos detectados (LAN)"}
          </h4>
          {discoveryErr && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{discoveryErr}</p>
          )}
          {!discoveryErr && discovery && discovery.peers.length === 0 && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {isUserAudience
                    ? "No se detectaron otros equipos en la red por ahora."
                    : "Ningún otro equipo anunciándose en esta red (mismo multicast)."}
            </p>
          )}
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {discovery?.peers.map((p) => {
              const peerBase = peerDiscoveryToApiBase(p.address, p.apiPort);
              const rowKey = `${p.instanceId}:${p.address}`;
              const isCurrent = normalizeApiBase(base) === normalizeApiBase(peerBase);
              return (
                <li
                  key={rowKey}
                  className="flex flex-col gap-1 rounded border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{p.hostname}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      · {p.address}:{p.apiPort}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isCurrent || connectingKey !== null}
                    onClick={() => handleConnectPeer(p)}
                    className="btn-primary py-1.5 text-xs disabled:opacity-50"
                  >
                    {connectingKey === rowKey
                      ? "Validando…"
                      : isCurrent
                        ? "Ya seleccionado"
                        : isUserAudience
                          ? "Conectar a este equipo"
                          : "Conectar a este nodo"}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
            {footerNote ?? defaultFooter}
          </p>
      </>
    </div>
  );
}

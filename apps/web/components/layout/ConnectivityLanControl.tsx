"use client";

import { useEffect, useRef, useState } from "react";
import { useCan } from "../../lib/useCan";
import { LanNodeSelectorPanel } from "./LanNodeSelectorPanel";
import { useLanConnectivity } from "./useLanConnectivity";

export function ConnectivityLanControl() {
  const canManageLanNodes = useCan("manage", "lanNodes");
  const [open, setOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lan = useLanConnectivity();

  const { refreshDiscovery, setPanelMessage, setPanelSuccess, conn, shortBadge, badgeColor, statusLine } = lan;

  useEffect(() => {
    if (open) refreshDiscovery();
  }, [open, refreshDiscovery]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) setAdvancedOpen(false);
  }, [open]);

  if (!canManageLanNodes) {
    return null;
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setPanelMessage(null);
          setPanelSuccess(null);
        }}
        className={`hidden max-w-[11rem] truncate rounded-md border px-2 py-1 text-left text-xs font-medium transition hover:opacity-90 sm:block ${badgeColor}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={statusLine}
      >
        <span className="tabular-nums">{shortBadge}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 z-[60] mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-xl dark:border-slate-600 dark:bg-slate-900"
          role="dialog"
          aria-label="Estado de conexión"
        >
          <p className="font-medium text-slate-800 dark:text-slate-100">{statusLine}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {conn === "offline"
              ? "Compruebe que el programa servidor esté en marcha y la red."
              : "Por defecto los datos de negocio son del API de este equipo. Puede conectarse a otro nodo en la LAN solo para supervisión (no afecta el chat LAN)."}
          </p>

          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="text-xs font-medium text-slate-600 underline hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              aria-expanded={advancedOpen}
            >
              {advancedOpen ? "Ocultar selector de nodos" : "Cambiar nodo de datos (LAN)…"}
            </button>
            {advancedOpen && (
              <div className="mt-3 rounded-md border border-slate-100 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-800/40">
                <LanNodeSelectorPanel
                  connectivity={lan}
                  logoutAfterRoutingChange
                  onRoutingApplied={() => {
                    setOpen(false);
                    setAdvancedOpen(false);
                  }}
                  audience="technical"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

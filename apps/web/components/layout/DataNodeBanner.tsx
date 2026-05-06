"use client";

import Link from "next/link";
import { useEffect, useReducer } from "react";
import { getApiBase } from "../../lib/api";
import { getLanRouting } from "../../lib/lan-routing";
import { useCan } from "../../lib/useCan";

/**
 * Aviso persistente cuando un admin/dev está apuntando el API a otro equipo (supervisión).
 */
export function DataNodeBanner() {
  const canManage = useCan("manage", "lanNodes");
  const [, bump] = useReducer((n) => n + 1, 0);

  useEffect(() => {
    const onChange = () => bump();
    window.addEventListener("pvquoting:api-base-changed", onChange);
    return () => window.removeEventListener("pvquoting:api-base-changed", onChange);
  }, []);

  if (!canManage) return null;

  const lan = getLanRouting();
  if (lan.mode !== "lan_peer") return null;

  const base = getApiBase();

  return (
    <div
      role="status"
      className="no-print border-b-2 border-amber-500 bg-amber-100 px-4 py-2.5 text-sm text-amber-950 dark:border-amber-400 dark:bg-amber-950/90 dark:text-amber-50"
    >
      <p className="font-semibold">Está viendo datos de un nodo remoto (supervisión)</p>
      <p className="mt-1 break-all text-xs opacity-95">
        API activa: <span className="font-mono">{base}</span>
        {lan.peerHostname ? (
          <>
            {" "}
            · Equipo: <span className="font-medium">{lan.peerHostname}</span>
          </>
        ) : null}
      </p>
      <p className="mt-2 text-xs">
        Las cotizaciones y el catálogo mostrados no son los de su equipo local. El chat LAN no cambia con esta opción.{" "}
        <Link href="/admin/nodos-lan" className="font-medium underline hover:no-underline">
          Administración → Nodos LAN
        </Link>
      </p>
    </div>
  );
}

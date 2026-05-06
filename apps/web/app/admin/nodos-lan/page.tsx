"use client";

import { LanNodeSelectorPanel } from "../../../components/layout/LanNodeSelectorPanel";
import { useLanConnectivity } from "../../../components/layout/useLanConnectivity";

export default function NodosLanPage() {
  const lan = useLanConnectivity();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Nodos LAN (datos de negocio)</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Conecte el API de cotizaciones a otro equipo de la red solo para supervisión. No hay sincronización automática
          entre nodos. El chat en LAN sigue funcionando por su propio canal.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800/80">
        <LanNodeSelectorPanel
          connectivity={lan}
          logoutAfterRoutingChange
          enableManualUrlInput
          audience="technical"
        />
      </div>
    </div>
  );
}

"use client";

import { formatMoney, formatNumber, formatPercent } from "../../lib/format";
import type { FvStudy } from "../../lib/api";

type Props = {
  study: FvStudy;
  /** Si hay diseño de implantación cargado, refleja el conteo real de placements (evita desfase con cantidadPaneles del estudio). */
  panelCountOverride?: number;
};

export function EstudioFvKpis({ study, panelCountOverride }: Props) {
  const currency = study.currency || "";
  const panelDisplay =
    panelCountOverride != null && panelCountOverride > 0 ? panelCountOverride : study.cantidadPaneles;

  const kpis = [
    { label: "Potencia sistema", value: formatNumber(study.potenciaSistemaKwp, 2), unit: "kWp" },
    { label: "Cantidad de paneles", value: String(panelDisplay ?? "—"), unit: "" },
    { label: "Generación anual", value: formatNumber(study.generacionAnualKwh, 0), unit: "kWh" },
    { label: "Ahorro anual", value: formatMoney(study.ahorroAnual, currency), unit: "" },
    { label: "Porcentaje ahorro", value: formatPercent(study.porcentajeAhorro), unit: "" },
    { label: "Pago residual anual", value: formatMoney(study.pagoResidualAnual, currency), unit: "" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {kpis.map((k) => (
        <div key={k.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{k.label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {k.value}
            {k.unit && <span className="ml-1 text-sm font-normal text-slate-600">{k.unit}</span>}
          </p>
        </div>
      ))}
    </div>
  );
}

"use client";

import { formatMoney } from "../constants";

type FvResultLike = {
  plantaKwp: number;
  cantidadPaneles: number;
  generacionAnualKwh: number;
  generacionMensualKwh: number;
  ahorroMensual: number;
  ahorroAnual: number;
  porcentajeAhorro: number;
  pagoResidual: number;
  hspDailyUsed?: number;
  performanceRatioUsed?: number;
  calculationMethodVersion?: string;
};

type Props = {
  result: FvResultLike;
  currency: string;
  /** Cuando existe un cálculo cargado o guardado, mostrar supuestos en texto secundario. */
  showAssumptions?: boolean;
};

export function CalculoFvResultado({ result, currency, showAssumptions = false }: Props) {
  return (
    <div className="space-y-4">
      {showAssumptions &&
        (result.hspDailyUsed != null || result.performanceRatioUsed != null || result.calculationMethodVersion) && (
          <p className="text-xs text-slate-500">
            Supuestos: HSP diario = {result.hspDailyUsed ?? "—"}, PR = {result.performanceRatioUsed ?? "—"}
            {result.calculationMethodVersion != null && `, versión método = ${result.calculationMethodVersion}`}.
          </p>
        )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Planta</p>
          <p className="text-lg font-semibold text-slate-900">{result.plantaKwp} kWp</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Paneles</p>
          <p className="text-lg font-semibold text-slate-900">{result.cantidadPaneles}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Generación anual</p>
          <p className="font-medium text-slate-900">{result.generacionAnualKwh.toLocaleString("es-CL")} kWh</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Generación mensual</p>
          <p className="font-medium text-slate-900">{result.generacionMensualKwh.toLocaleString("es-CL")} kWh</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Ahorro mensual</p>
          <p className="font-medium text-slate-900">{formatMoney(result.ahorroMensual, currency)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Ahorro anual</p>
          <p className="font-medium text-slate-900">{formatMoney(result.ahorroAnual, currency)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">% ahorro</p>
          <p className="font-medium text-slate-900">{result.porcentajeAhorro.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-500">Pago residual</p>
          <p className="font-medium text-slate-900">{formatMoney(result.pagoResidual, currency)}</p>
        </div>
      </div>
    </div>
  );
}

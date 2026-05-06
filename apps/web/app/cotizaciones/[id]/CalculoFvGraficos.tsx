"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

type ResultForCharts = {
  generacionMensualKwh: number;
  generacionAnualKwh: number;
  ahorroMensual: number;
  pagoResidual: number;
};

type Props = {
  result: ResultForCharts;
  consumoMensualKwh: number;
  cuentaMensual: number;
  currency: string;
};

function buildGeneracionVsConsumo(genMensual: number, consumoMensual: number) {
  return MESES.map((mes) => ({
    mes,
    name: mes,
    generacion: Math.round(genMensual * 100) / 100,
    consumo: Math.round(consumoMensual * 100) / 100,
  }));
}

function buildPagoActualVsFv(cuentaMensual: number, pagoResidual: number) {
  return MESES.map((mes) => ({
    mes,
    name: mes,
    "Pago actual": Math.round(cuentaMensual * 100) / 100,
    "Con FV": Math.round(pagoResidual * 100) / 100,
  }));
}

export function CalculoFvGraficos({ result, consumoMensualKwh, cuentaMensual, currency }: Props) {
  const dataGenVsConsumo = buildGeneracionVsConsumo(result.generacionMensualKwh, consumoMensualKwh);
  const dataPago = buildPagoActualVsFv(cuentaMensual, result.pagoResidual);

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-2 text-sm font-medium text-slate-700">Generación vs consumo (kWh/mes)</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataGenVsConsumo} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [
                  typeof value === "number" ? value.toLocaleString("es-CL") : String(value ?? ""),
                  "",
                ]}
              />
              <Legend />
              <Bar dataKey="generacion" name="Generación estimada" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              <Bar dataKey="consumo" name="Consumo" fill="#64748b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-sm font-medium text-slate-700">Pago actual vs pago con FV ({currency}/mes)</h4>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataPago} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [
                  `${currency} ${typeof value === "number" ? value.toLocaleString("es-CL") : String(value ?? "")}`,
                  "",
                ]}
              />
              <Legend />
              <Bar dataKey="Pago actual" name="Pago actual" fill="#94a3b8" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Con FV" name="Con FV" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
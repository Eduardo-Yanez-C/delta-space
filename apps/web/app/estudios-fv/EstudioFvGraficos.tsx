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
import { formatMoney } from "../../lib/format";
import { MESES_NOMBRES } from "./constants";
import type { FvStudyMonth } from "../../lib/api";

/** Formato monetario para gráficos: $ + miles con punto, sin decimales. Negativos: -$32.400 */
function formatChartMoney(value: number): string {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  const formatted = formatMoney(abs, "").trim() || String(Math.round(abs));
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

type Props = {
  months: FvStudyMonth[];
  currency: string;
  /** Para el gráfico de balance económico (CLP). Si no se pasan, el gráfico usa 0. */
  valorKwhConsumo?: number;
  valorKwhInyeccion?: number;
};

export function EstudioFvGraficos({ months, currency, valorKwhConsumo = 0, valorKwhInyeccion = 0 }: Props) {
  const sorted = [...months].sort((a, b) => a.monthIndex - b.monthIndex);
  const dataGenVsConsumo = sorted.map((m) => ({
    mes: MESES_NOMBRES[m.monthIndex - 1],
    name: MESES_NOMBRES[m.monthIndex - 1],
    generacion: Math.round(m.generationKwh * 100) / 100,
    consumo: Math.round(m.consumptionKwh * 100) / 100,
  }));
  const dataPago = sorted.map((m) => ({
    mes: MESES_NOMBRES[m.monthIndex - 1],
    name: MESES_NOMBRES[m.monthIndex - 1],
    "Pago estimado": m.estimatedPayment != null ? Math.round(m.estimatedPayment * 100) / 100 : 0,
  }));

  // Balance energético: autoconsumo = min(consumo, generacion), inyección = max(generacion - consumo, 0), compra a red = max(consumo - generacion, 0).
  // Inyección se muestra como barra negativa para no mezclar con el gráfico de generación vs consumo.
  const dataBalance = sorted.map((m) => {
    const consumo = m.consumptionKwh;
    const generacion = m.generationKwh;
    const autoconsumo = Math.min(consumo, generacion);
    const inyeccion = Math.max(generacion - consumo, 0);
    const compraRed = Math.max(consumo - generacion, 0);
    return {
      mes: MESES_NOMBRES[m.monthIndex - 1],
      name: MESES_NOMBRES[m.monthIndex - 1],
      "Compra a red": Math.round(compraRed * 100) / 100,
      Autoconsumo: Math.round(autoconsumo * 100) / 100,
      "Inyección a red": inyeccion > 0 ? -(Math.round(inyeccion * 100) / 100) : 0,
    };
  });

  // Balance económico: costoCompra = compraRed * valorKwhConsumo, ingresoInyeccion = inyeccion * valorKwhInyeccion, pagoNeto = costoCompra - ingresoInyeccion.
  const dataBalanceEconomico = sorted.map((m) => {
    const consumo = m.consumptionKwh;
    const generacion = m.generationKwh;
    const compraRed = Math.max(consumo - generacion, 0);
    const inyeccion = Math.max(generacion - consumo, 0);
    const costoCompra = compraRed * valorKwhConsumo;
    const ingresoInyeccion = inyeccion * valorKwhInyeccion;
    const pagoNeto = costoCompra - ingresoInyeccion;
    return {
      mes: MESES_NOMBRES[m.monthIndex - 1],
      name: MESES_NOMBRES[m.monthIndex - 1],
      "Costo compra red": Math.round(costoCompra),
      "Ingreso por inyección": ingresoInyeccion > 0 ? -Math.round(ingresoInyeccion) : 0,
      "Pago neto": Math.round(pagoNeto),
    };
  });

  return (
    <div className="space-y-6">
      <div className="print-avoid-break">
        <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Generación vs consumo (kWh/mes)</h4>
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
      <div className="print-avoid-break">
        <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Balance energético mensual (kWh/mes)</h4>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          La inyección a red se representa en negativo.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataBalance} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals />
              <Tooltip
                formatter={(value: unknown) => [
                  typeof value === "number" ? Math.abs(value).toLocaleString("es-CL") : String(value ?? ""),
                  "",
                ]}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs shadow dark:border-slate-600 dark:bg-slate-800">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{p.mes}</div>
                      <div>Compra a red: {Number(p["Compra a red"]).toLocaleString("es-CL")} kWh</div>
                      <div>Autoconsumo: {Number(p.Autoconsumo).toLocaleString("es-CL")} kWh</div>
                      <div>Inyección a red: {Math.abs(Number(p["Inyección a red"])).toLocaleString("es-CL")} kWh</div>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="Compra a red" name="Compra a red" fill="#ef4444" stackId="balance" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Autoconsumo" name="Autoconsumo" fill="#22c55e" stackId="balance" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Inyección a red" name="Inyección a red" fill="#3b82f6" radius={[0, 0, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="print-avoid-break">
        <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Balance económico mensual ($)</h4>
        <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Ingreso por inyección en negativo. Pago neto = costo compra red − ingreso inyección.
        </p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataBalanceEconomico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatChartMoney(Number(v))} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs shadow dark:border-slate-600 dark:bg-slate-800">
                      <div className="font-medium text-slate-800 dark:text-slate-200">{p.mes}</div>
                      <div>Costo compra red: {formatChartMoney(Number(p["Costo compra red"]))}</div>
                      <div>Ingreso por inyección: {formatChartMoney(Math.abs(Number(p["Ingreso por inyección"])))}</div>
                      <div>Pago neto: {formatChartMoney(Number(p["Pago neto"]))}</div>
                    </div>
                  );
                }}
              />
              <Legend />
              <Bar dataKey="Costo compra red" name="Costo compra red" fill="#ef4444" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Ingreso por inyección" name="Ingreso por inyección" fill="#22c55e" radius={[0, 0, 2, 2]} />
              <Bar dataKey="Pago neto" name="Pago neto" fill="#8b5cf6" radius={[2, 2, 2, 2]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="print-avoid-break">
        <h4 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Pago estimado por mes ({currency})</h4>
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
              <Bar dataKey="Pago estimado" name="Pago estimado" fill="#22c55e" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

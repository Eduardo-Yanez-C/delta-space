"use client";

import { formatMoney, formatNumber, formatPercent } from "../../lib/format";
import { MESES_NOMBRES } from "./constants";
import type { FvStudyMonth } from "../../lib/api";

type Props = { months: FvStudyMonth[]; currency: string };

export function EstudioFvTablaMensual({ months, currency }: Props) {
  const sorted = [...months].sort((a, b) => a.monthIndex - b.monthIndex);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-600">Mes</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600">Consumo kWh</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600">Valor consumo</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600">Generación kWh</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600">Valor generación</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600">Ahorro %</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-slate-600">Pago estimado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-800">
          {sorted.map((m) => (
            <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                {MESES_NOMBRES[m.monthIndex - 1]}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                {formatNumber(m.consumptionKwh, 2)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                {m.consumptionValue != null ? formatMoney(m.consumptionValue, currency) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                {formatNumber(m.generationKwh, 2)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                {m.generationValue != null ? formatMoney(m.generationValue, currency) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                {m.savingsPercent != null ? formatPercent(m.savingsPercent) : "—"}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right text-sm text-slate-600">
                {m.estimatedPayment != null ? formatMoney(m.estimatedPayment, currency) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { fetchExternalIndicators, type ExternalIndicatorsData } from "../../lib/api";
import { DashboardIndicadoresExternos } from "../dashboard/DashboardIndicadoresExternos";

export default function IndicadoresExternosPage() {
  const [data, setData] = useState<ExternalIndicatorsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetchExternalIndicators()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-slate-200/80 bg-white px-6 py-5 shadow-md dark:border-slate-700 dark:bg-slate-800">
        <div className="border-l-4 border-l-primary-500 pl-4">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Indicadores externos
          </h2>
          <p className="mt-2 text-sm tracking-wide text-slate-600 dark:text-slate-400">
            Seguimiento de UF, Dólar e IPC con tendencia semanal, mensual y anual.
          </p>
        </div>
      </header>

      <DashboardIndicadoresExternos data={data} loading={loading} error={error} />
    </div>
  );
}

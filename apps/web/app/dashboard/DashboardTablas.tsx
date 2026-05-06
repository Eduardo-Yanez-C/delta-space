"use client";

import Link from "next/link";
import { useCan } from "../../lib/useCan";
import { formatDate, formatMoney } from "../../lib/format";
import type { DashboardQuoteRow, DashboardStudyRow } from "../../lib/api";

const QUOTE_STATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  ENVIADA: "Enviada",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
  EXPIRADA: "Expirada",
};

const STUDY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  VALIDADO: "Validado",
  COTIZADO: "Cotizado",
  ARCHIVADO: "Archivado",
};

type Props = {
  latestQuotes: DashboardQuoteRow[];
  latestStudies: DashboardStudyRow[];
  studiesWithoutQuote: DashboardStudyRow[];
};

export function DashboardTablas({
  latestQuotes,
  latestStudies,
  studiesWithoutQuote,
}: Props) {
  const canReadQuote = useCan("read", "quote");
  const canReadFvStudy = useCan("read", "fvStudy");

  return (
    <div className="space-y-8">
      {canReadQuote && (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Últimas cotizaciones</h3>
          </div>
          <div className="overflow-x-auto">
            {latestQuotes.length === 0 ? (
              <div className="px-5 py-6">
                <p className="text-sm text-slate-600 dark:text-slate-400">No hay cotizaciones recientes.</p>
                <Link
                  href="/cotizaciones"
                  className="mt-2 inline-block text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded dark:text-primary-400 dark:hover:text-primary-300 dark:focus:ring-offset-slate-800"
                >
                  Ver cotizaciones
                </Link>
              </div>
            ) : (
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-700/50">
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Título</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Cliente</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Estado</th>
                    <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">Total</th>
                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {latestQuotes.map((q) => (
                    <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/cotizaciones/${q.id}`}
                          className="font-medium text-primary-700 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                        >
                          {q.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{q.clientName}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-300">
                          {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                        {formatMoney(q.total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(q.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {canReadFvStudy && (
        <>
          <section className="card overflow-hidden p-0">
<div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Últimos estudios FV</h3>
          </div>
            <div className="overflow-x-auto">
              {latestStudies.length === 0 ? (
                <div className="px-5 py-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400">No hay estudios recientes.</p>
                  <Link
                    href="/estudios-fv"
                    className="mt-2 inline-block text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded dark:text-primary-400 dark:hover:text-primary-300 dark:focus:ring-offset-slate-800"
                  >
                    Ver estudios FV
                  </Link>
                </div>
              ) : (
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-700/50">
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Título</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Cliente</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Estado</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Actualizado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestStudies.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/estudios-fv/${s.id}`}
                            className="font-medium text-primary-700 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-300"
                          >
                            {s.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{s.clientName}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-300">
                            {STUDY_STATUS_LABELS[s.status] ?? s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(s.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="card overflow-hidden p-0">
            <div className="border-b border-slate-200/80 bg-slate-50/80 px-5 py-4 dark:border-slate-700 dark:bg-slate-700/50">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Estudios sin cotización
                {studiesWithoutQuote.length > 0 && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
                    {studiesWithoutQuote.length}
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Cree una cotización desde el detalle de cada estudio.
              </p>
            </div>
            <div className="overflow-x-auto">
              {studiesWithoutQuote.length === 0 ? (
                <div className="px-5 py-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No hay estudios pendientes. Todos tienen cotización asociada o están archivados.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <Link
                      href="/estudios-fv"
                      className="inline-block rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 dark:focus:ring-offset-slate-800"
                    >
                      Ver estudios FV
                    </Link>
                    <Link
                      href="/estudios-fv/nuevo"
                      className="inline-block rounded-md border border-primary-400 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-800 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:border-primary-600 dark:bg-primary-900/40 dark:text-primary-200 dark:hover:bg-primary-900/60 dark:focus:ring-offset-slate-800"
                    >
                      Nuevo estudio FV
                    </Link>
                  </div>
                </div>
              ) : (
                <table className="w-full min-w-[400px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-700/50">
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Título</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Cliente</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Estado</th>
                      <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">Actualizado</th>
                      <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studiesWithoutQuote.map((s) => (
                      <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/estudios-fv/${s.id}`}
                            className="font-medium text-primary-700 hover:text-primary-800 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 rounded dark:text-primary-400 dark:hover:text-primary-300 dark:focus:ring-offset-slate-800"
                          >
                            {s.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{s.clientName}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-600 dark:text-slate-300">
                            {STUDY_STATUS_LABELS[s.status] ?? s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{formatDate(s.updatedAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/estudios-fv/${s.id}`}
                            className="inline-flex items-center rounded-md border border-primary-400 bg-primary-50 px-2.5 py-1.5 text-xs font-medium text-primary-800 hover:bg-primary-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:border-primary-600 dark:bg-primary-900/40 dark:text-primary-200 dark:hover:bg-primary-900/60 dark:focus:ring-offset-slate-800"
                          >
                            Crear cotización
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

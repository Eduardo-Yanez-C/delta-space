"use client";

import Link from "next/link";
import { formatMoney, formatNumber, formatPercent } from "../../lib/format";
import type { QuoteDetail, QuoteVersionDetail, FvStudy, QuoteFvCalculation } from "../../lib/api";
import { EstudioFvInformeEjecutivo } from "../estudios-fv/EstudioFvInformeEjecutivo";
import { PROJECT_TYPE_LABELS } from "./constants";
import { useCan } from "../../lib/useCan";

type Props = {
  quote: QuoteDetail;
  versionDetail: QuoteVersionDetail | null;
  /** Estudio FV vinculado (si existe). Origen de datos técnicos y energéticos. */
  fvStudySummary: FvStudy | null;
  /** Cálculo FV en cotización (cuando no hay estudio vinculado). */
  fvCalculation: QuoteFvCalculation | null;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return formatNumber(n, 2);
}

function fmtMon(n: number | null | undefined, currency: string): string {
  if (n == null || Number.isNaN(n)) return "—";
  return formatMoney(n, currency);
}

/**
 * Resumen ejecutivo para la cotización.
 * - Si hay estudio FV vinculado: usa EstudioFvInformeEjecutivo con inversión desde la versión actual.
 * - Si hay cálculo FV (sin estudio): construye resumen desde cotización + cálculo.
 * - Si no hay ninguno: muestra mensaje para completar datos o vincular estudio.
 */
export function CotizacionResumenEjecutivo({
  quote,
  versionDetail,
  fvStudySummary,
  fvCalculation,
}: Props) {
  const currency = quote.currency ?? "CLP";
  const canCreateFvStudy = useCan("create", "fvStudy");

  // Caso 1: Cotización vinculada a estudio FV — reutilizar informe del estudio con inversión de la cotización
  if (fvStudySummary) {
    const inversionOverride =
      versionDetail && typeof versionDetail.total === "number" && versionDetail.total > 0
        ? Number(versionDetail.total)
        : undefined;
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Datos técnicos y energéticos del estudio FV vinculado. Inversión y totales desde esta cotización
          {versionDetail ? ` (versión ${versionDetail.versionNumber})` : ""}.
        </p>
        <EstudioFvInformeEjecutivo study={fvStudySummary} inversionTotalOverride={inversionOverride} />
      </div>
    );
  }

  // Caso 2: Cálculo FV en cotización (sin estudio vinculado) + versión con totales
  if (fvCalculation && versionDetail) {
    const totalNum = Number(versionDetail.total);
    const ahorroAnual = fvCalculation.ahorroAnual;
    const tieneInversion = totalNum > 0 && ahorroAnual != null && ahorroAnual > 0;
    const paybackYears = tieneInversion ? totalNum / ahorroAnual : null;
    const paybackMeses = paybackYears != null ? paybackYears * 12 : null;
    const tipoProyectoLabel = PROJECT_TYPE_LABELS[quote.projectType] ?? quote.projectType ?? "—";
    const recomendaciones: string[] = [];
    if (tieneInversion && paybackYears != null && paybackYears > 12) {
      recomendaciones.push("Retorno de inversión superior a 10 años; conviene revisar opciones de financiamiento o tamaño del sistema.");
    }
    if (!tieneInversion && ahorroAnual != null && ahorroAnual > 0) {
      recomendaciones.push("Complete ítems y totales en la cotización para estimar el retorno de la inversión.");
    }
    if (fvCalculation.porcentajeAhorro != null && fvCalculation.porcentajeAhorro >= 60) {
      recomendaciones.push("El ahorro estimado en la facturación es relevante; el proyecto resulta atractivo desde el punto de vista económico.");
    }
    if (recomendaciones.length === 0) {
      recomendaciones.push("Con los datos disponibles se ha generado el resumen ejecutivo. Complete información faltante para afinar recomendaciones.");
    }

    return (
      <div className="card p-5 sm:p-6">
        <h2 className="mb-2 text-lg font-medium text-slate-800 dark:text-slate-200">Resumen ejecutivo</h2>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Resumen del proyecto para evaluación comercial y técnica (datos desde cotización y cálculo FV).
        </p>

        <div className="grid gap-3 print:grid-cols-1 xl:grid-cols-3">
          <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              1. Resumen técnico
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 print:grid-cols-1 xl:grid-cols-1">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Tipo de proyecto</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{tipoProyectoLabel}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Potencia sistema</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.plantaKwp != null ? `${fmtNum(fvCalculation.plantaKwp)} kWp` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Potencia por panel</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.potenciaPorPanelWp != null ? `${fvCalculation.potenciaPorPanelWp} Wp` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Cantidad de paneles</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.cantidadPaneles != null ? String(fvCalculation.cantidadPaneles) : "—"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500 dark:text-slate-400">Cliente / proyecto</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">{quote.client?.name ?? quote.clientId}</dd>
            </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              2. Resumen energético
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 print:grid-cols-1 xl:grid-cols-1">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Generación anual estimada</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.generacionAnualKwh != null
                  ? `${formatNumber(fvCalculation.generacionAnualKwh, 0)} kWh`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Cobertura / % ahorro</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.porcentajeAhorro != null ? formatPercent(fvCalculation.porcentajeAhorro) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Pago residual estimado</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.pagoResidual != null
                  ? fmtMon(fvCalculation.pagoResidual, fvCalculation.currency ?? currency)
                  : "—"}
              </dd>
            </div>
            </dl>
          </section>

          <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              3. Resumen económico
            </h3>
            <dl className="grid gap-2 text-sm sm:grid-cols-2 print:grid-cols-1 xl:grid-cols-1">
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Total cotización (versión {versionDetail.versionNumber})</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {totalNum > 0 ? fmtMon(totalNum, currency) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Ahorro mensual promedio</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {fvCalculation.ahorroMensual != null
                  ? fmtMon(fvCalculation.ahorroMensual, fvCalculation.currency ?? currency)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Ahorro anual estimado</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {ahorroAnual != null ? fmtMon(ahorroAnual, fvCalculation.currency ?? currency) : "—"}
              </dd>
            </div>
            </dl>
          </section>
        </div>

        <div className="mt-3 grid gap-3 print:grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              4. Retorno de la inversión
            </h3>
          {tieneInversion && paybackMeses != null && paybackYears != null ? (
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Inversión (total cotización)</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{fmtMon(totalNum, currency)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Retorno estimado</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{Math.round(paybackMeses)} meses</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Retorno estimado</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">{paybackYears.toFixed(1)} años</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              No es posible estimar el retorno con la información disponible. Complete la cotización con ítems y totales, o vincule un estudio FV para un análisis más completo.
            </p>
          )}
          </section>

          <section className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              5. Recomendaciones
            </h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {recomendaciones.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
            </ul>
          </section>
        </div>
      </div>
    );
  }

  // Caso 3: Sin estudio ni cálculo FV — mensaje para completar
  return (
    <div className="card p-6">
      <h2 className="mb-4 text-lg font-medium text-slate-800 dark:text-slate-200">Resumen ejecutivo</h2>
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Para un resumen ejecutivo consolidado (técnico, energético y económico), cree o vincule un <strong>Estudio FV</strong> con <strong>diseño de implantación</strong>. Es el mismo flujo para cotizaciones normales y desde plantilla.
      </p>
      <div className="flex flex-col flex-wrap gap-3 sm:flex-row sm:items-center">
        {canCreateFvStudy ? (
          <Link
            href={`/estudios-fv/nuevo?clientId=${encodeURIComponent(quote.clientId)}&quoteId=${encodeURIComponent(quote.id)}`}
            className="inline-flex justify-center rounded-lg border border-amber-500 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500 dark:bg-amber-900/30 dark:text-amber-200"
          >
            Crear estudio FV e implementación
          </Link>
        ) : null}
        <Link href={`/estudios-fv?clientId=${quote.clientId}`} className="text-sm font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400">
          Ver estudios FV del cliente
        </Link>
      </div>
    </div>
  );
}

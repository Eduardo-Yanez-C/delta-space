"use client";

import type { ReactNode } from "react";
import { formatMoney, formatNumber, formatPercent } from "../../lib/format";
import type { FvStudy, FvStudyMonth } from "../../lib/api";
import {
  CONNECTION_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  getMountingBusinessLabel,
} from "./constants";
import type { MarginSystemType } from "../../lib/margin-technical-basics";
import { MARGIN_SYSTEM_TYPE_LABELS } from "../../lib/margin-technical-basics";
import { FV_SYSTEM_TYPE_HINTS, normalizeFvStudySystemType } from "./fvStudySystemType";
import {
  formatSiNo,
  getExecutiveScenarioNarrative,
  getScenarioUserLabel,
  getStudyGridDisplayFlags,
  resolveScenarioFromStudy,
} from "../../lib/fv-system-scenario";

type Props = {
  study: FvStudy;
  /** Si se pasa (p. ej. desde la cotización), se usa como inversión para calcular retorno y mostrarlo en resumen económico. */
  inversionTotalOverride?: number;
  /** Conteo desde diseño de implantación cuando existe (alineado con KPIs del detalle). */
  panelCountOverride?: number;
};

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return formatNumber(n, 2);
}

function fmtMon(n: number | null | undefined, currency: string): string {
  if (n == null || Number.isNaN(n)) return "—";
  return formatMoney(n, currency);
}

/** Deriva consumo anual, autoconsumo anual e inyección anual desde months. */
function deriveFromMonths(months: FvStudyMonth[] | undefined): {
  consumoAnualKwh: number | null;
  autoconsumoAnualKwh: number | null;
  inyeccionAnualKwh: number | null;
} {
  if (!months?.length) return { consumoAnualKwh: null, autoconsumoAnualKwh: null, inyeccionAnualKwh: null };
  const sorted = [...months].sort((a, b) => a.monthIndex - b.monthIndex);
  let consumo = 0;
  let autoconsumo = 0;
  let inyeccion = 0;
  for (const m of sorted) {
    const c = m.consumptionKwh ?? 0;
    const g = m.generationKwh ?? 0;
    consumo += c;
    autoconsumo += Math.min(c, g);
    inyeccion += Math.max(g - c, 0);
  }
  return {
    consumoAnualKwh: consumo,
    autoconsumoAnualKwh: autoconsumo,
    inyeccionAnualKwh: inyeccion,
  };
}

/** Ingreso anual por inyección (inyección kWh * valorKwhInyeccion). */
function ingresoInyeccionAnual(
  inyeccionAnualKwh: number | null,
  valorKwhInyeccion: number | undefined
): number | null {
  if (inyeccionAnualKwh == null || valorKwhInyeccion == null || valorKwhInyeccion < 0) return null;
  return inyeccionAnualKwh * valorKwhInyeccion;
}

type RecommendationCtx = {
  months: FvStudyMonth[] | undefined;
  consumoAnualKwh: number | null;
  inyeccionAnualKwh: number | null;
  coberturaPercent: number | null;
  study: FvStudy;
  tieneInversion: boolean;
  paybackAnios: number | null;
};

export function buildExecutiveRecommendations(
  systemNorm: MarginSystemType,
  ctx: RecommendationCtx
): string[] {
  const recomendaciones: string[] = [];
  const {
    months,
    consumoAnualKwh,
    inyeccionAnualKwh,
    coberturaPercent,
    study,
    tieneInversion,
    paybackAnios,
  } = ctx;

  if (consumoAnualKwh == null && !months?.length) {
    recomendaciones.push("Complete los consumos mensuales para obtener un resumen energético y económico completo.");
  }
  if (study.generacionAnualKwh != null && consumoAnualKwh != null && consumoAnualKwh > 0) {
    const ratioGenConsumo = study.generacionAnualKwh / consumoAnualKwh;
    if (
      (systemNorm === "ON_GRID" || systemNorm === "HYBRID") &&
      ratioGenConsumo > 1.5 &&
      inyeccionAnualKwh != null &&
      inyeccionAnualKwh > consumoAnualKwh * 0.5
    ) {
      recomendaciones.push(
        "La generación supera ampliamente el consumo; considere revisar el dimensionamiento si el objetivo es maximizar autoconsumo."
      );
    }
    if (systemNorm === "OFF_GRID" && ratioGenConsumo < 1) {
      recomendaciones.push(
        "La generación anual estimada es inferior al consumo; sin almacenamiento dimensionado el sistema no cubriría la demanda de forma autónoma."
      );
    }
    if (coberturaPercent != null && coberturaPercent >= 80) {
      recomendaciones.push("Alta cobertura energética estimada; el proyecto presenta buen equilibrio entre generación y consumo.");
    }
    if (coberturaPercent != null && coberturaPercent < 40 && ratioGenConsumo < 0.8) {
      recomendaciones.push("Cobertura baja; puede evaluar aumentar la potencia del sistema o revisar el consumo de referencia.");
    }
  }
  if (tieneInversion && paybackAnios != null && paybackAnios > 12) {
    recomendaciones.push("Retorno de inversión superior a 10 años; conviene revisar opciones de financiamiento o tamaño del sistema.");
  }
  if (!tieneInversion && study.ahorroAnual != null && study.ahorroAnual > 0) {
    recomendaciones.push(
      "Para estimar el retorno de la inversión, incorpore el costo total del proyecto (por ejemplo, desde una cotización asociada)."
    );
  }
  if (
    (systemNorm === "ON_GRID" || systemNorm === "HYBRID") &&
    study.porcentajeAhorro != null &&
    study.porcentajeAhorro >= 60
  ) {
    recomendaciones.push(
      `Ahorro anual estimado sobre la factura cercano al ${formatPercent(study.porcentajeAhorro)}: use esta cifra como base de negociación y valídela con la tarifa vigente del distribuidor y su perfil de consumo real.`
    );
  }
  if (systemNorm === "HYBRID") {
    recomendaciones.push(
      "Defina capacidad y uso del almacenamiento para afinar el dimensionamiento ante cortes y picos de consumo."
    );
  }
  if (recomendaciones.length === 0) {
    recomendaciones.push(
      "Con los datos disponibles se ha generado el resumen ejecutivo. Complete información faltante para afinar recomendaciones."
    );
  }
  return recomendaciones;
}

type TechnicalSectionProps = {
  study: FvStudy;
  tipoProyectoLabel: string;
  systemLabel: string;
  systemNorm: MarginSystemType;
  panelCountDisplay: number | null | undefined;
  conexionLabel: string;
  ubicacion: string;
  redDisponibleLabel: string;
  inyeccionRedLabel: string;
  modoSistemaLabel: string;
  configuracionRedNarrative: string | null;
};

function renderTechnicalSection({
  study,
  tipoProyectoLabel,
  systemLabel,
  systemNorm,
  panelCountDisplay,
  conexionLabel,
  ubicacion,
  redDisponibleLabel,
  inyeccionRedLabel,
  modoSistemaLabel,
  configuracionRedNarrative,
}: TechnicalSectionProps): ReactNode {
  return (
    <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
      <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
        1. Resumen técnico
      </h3>
      <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:gap-y-1 print:text-[11px] xl:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Tipo de proyecto</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">{tipoProyectoLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Tipo de sistema</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">{systemLabel}</dd>
        </div>
      </dl>

      <div className="mt-1.5 border-t border-slate-200/80 pt-1.5 dark:border-slate-600/80 print:mt-1 print:pt-1">
        <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-[9px]">
          Configuración de red
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-800 dark:text-slate-200 print:gap-x-3 print:text-[10px]">
          <span>
            <span className="text-slate-500 dark:text-slate-400">Red: </span>
            <span className="font-medium">{redDisponibleLabel}</span>
          </span>
          <span>
            <span className="text-slate-500 dark:text-slate-400">Inyección: </span>
            <span className="font-medium">{inyeccionRedLabel}</span>
          </span>
          <span className="min-w-0">
            <span className="text-slate-500 dark:text-slate-400">Modo: </span>
            <span className="font-medium">{modoSistemaLabel}</span>
          </span>
        </div>
      </div>

      {configuracionRedNarrative && (
        <p className="mt-1.5 border-l-2 border-slate-300/80 pl-2 text-[11px] leading-snug text-slate-700 dark:border-slate-600 dark:text-slate-300 print:mt-1 print:border-slate-400 print:pl-1.5 print:text-[9px]">
          {configuracionRedNarrative}
        </p>
      )}

      {!configuracionRedNarrative && (
        <p className="mt-1.5 text-[11px] leading-snug text-slate-600 dark:text-slate-400 print:mt-1 print:text-[9px]">
          {FV_SYSTEM_TYPE_HINTS[systemNorm].lines.join(" ")}
        </p>
      )}

      <dl className="mt-2 grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:gap-y-1 print:text-[11px] xl:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Potencia sistema</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.potenciaSistemaKwp != null ? `${fmtNum(study.potenciaSistemaKwp)} kWp` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Potencia por panel</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.potenciaPorPanelWp != null ? `${study.potenciaPorPanelWp} Wp` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Cantidad de paneles</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {panelCountDisplay != null ? String(panelCountDisplay) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Tipo de conexión</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">{conexionLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Tipo de montaje</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {getMountingBusinessLabel(study.mountingType ?? undefined)}
          </dd>
        </div>
        <div className="sm:col-span-2 print:col-span-2">
          <dt className="text-slate-500 dark:text-slate-400">Ubicación del proyecto</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">{ubicacion}</dd>
        </div>
      </dl>
    </section>
  );
}

type SummaryBlockProps = {
  study: FvStudy;
  currency: string;
  consumoAnualKwh: number | null;
  autoconsumoAnualKwh: number | null;
  inyeccionAnualKwh: number | null;
  coberturaPercent: number | null;
  ahorroMensualPromedio: number | null;
  ingresoInyeccion: number | null;
  inversionValida: boolean;
  inversionTotalOverride: number | undefined;
};

function renderOnGridEnergySection({
  study,
  consumoAnualKwh,
  autoconsumoAnualKwh,
  inyeccionAnualKwh,
  coberturaPercent,
}: Pick<
  SummaryBlockProps,
  "study" | "consumoAnualKwh" | "autoconsumoAnualKwh" | "inyeccionAnualKwh" | "coberturaPercent"
>): ReactNode {
  return (
    <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
      <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
        2. Resumen energético
      </h3>
      <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:gap-y-1 print:text-[11px] xl:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Generación anual estimada</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.generacionAnualKwh != null ? `${formatNumber(study.generacionAnualKwh, 0)} kWh` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Consumo anual</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {consumoAnualKwh != null ? `${formatNumber(consumoAnualKwh, 0)} kWh` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Cobertura estimada</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {coberturaPercent != null ? formatPercent(coberturaPercent) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Autoconsumo estimado</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {autoconsumoAnualKwh != null ? `${formatNumber(autoconsumoAnualKwh, 0)} kWh` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Inyección estimada</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {inyeccionAnualKwh != null ? `${formatNumber(inyeccionAnualKwh, 0)} kWh` : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function renderOnGridEconomicSection({
  study,
  currency,
  ahorroMensualPromedio,
  ingresoInyeccion,
  inversionValida,
  inversionTotalOverride,
}: SummaryBlockProps): ReactNode {
  return (
    <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
      <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
        3. Resumen económico
      </h3>
      <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:gap-y-1 print:text-[11px] xl:grid-cols-2">
        <div className="sm:col-span-2 print:col-span-2">
          <dt className="text-slate-500 dark:text-slate-400">Inversión estimada / costo total</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {inversionValida
              ? `$${formatMoney(inversionTotalOverride!, "")}`
              : "No disponible en este estudio. Incluya el costo total desde una cotización para evaluar retorno."}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Ahorro mensual promedio</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {ahorroMensualPromedio != null ? fmtMon(ahorroMensualPromedio, currency) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Ahorro anual estimado</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.ahorroAnual != null ? fmtMon(study.ahorroAnual, currency) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Ingreso por inyección (anual)</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {ingresoInyeccion != null ? fmtMon(ingresoInyeccion, currency) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Pago neto estimado (anual)</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.pagoResidualAnual != null ? fmtMon(study.pagoResidualAnual, currency) : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

function renderOffGridEnergySection({
  study,
  consumoAnualKwh,
  consumoDiarioEstimadoKwh,
  coberturaPercent,
}: {
  study: FvStudy;
  consumoAnualKwh: number | null;
  consumoDiarioEstimadoKwh: number | null;
  coberturaPercent: number | null;
}): ReactNode {
  return (
    <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
      <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
        2. Resumen energético
      </h3>
      <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:gap-y-1 print:text-[11px] xl:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Consumo anual</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {consumoAnualKwh != null ? `${formatNumber(consumoAnualKwh, 0)} kWh` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Consumo diario estimado</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {consumoDiarioEstimadoKwh != null ? `${formatNumber(consumoDiarioEstimadoKwh, 1)} kWh` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Generación anual estimada</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.generacionAnualKwh != null ? `${formatNumber(study.generacionAnualKwh, 0)} kWh` : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Cobertura estimada</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {coberturaPercent != null ? formatPercent(coberturaPercent) : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-2 border-t border-slate-200/80 pt-2 text-[11px] leading-snug text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mt-1.5 print:pt-1.5 print:text-[9px]">
        Almacenamiento energético no definido en el estudio
      </p>
    </section>
  );
}

function renderOffGridEconomicSection({
  study,
  currency,
  ahorroMensualPromedio,
  inversionValida,
  inversionTotalOverride,
}: Pick<
  SummaryBlockProps,
  "study" | "currency" | "ahorroMensualPromedio" | "inversionValida" | "inversionTotalOverride"
>): ReactNode {
  return (
    <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
      <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
        3. Resumen económico
      </h3>
      <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:gap-y-1 print:text-[11px] xl:grid-cols-2">
        <div className="sm:col-span-2 print:col-span-2">
          <dt className="text-slate-500 dark:text-slate-400">Inversión estimada / costo total</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {inversionValida
              ? `$${formatMoney(inversionTotalOverride!, "")}`
              : "No disponible en este estudio. Incluya el costo total desde una cotización para evaluar retorno."}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Ahorro mensual promedio</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {ahorroMensualPromedio != null ? fmtMon(ahorroMensualPromedio, currency) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Ahorro anual estimado</dt>
          <dd className="font-medium text-slate-800 dark:text-slate-200">
            {study.ahorroAnual != null ? fmtMon(study.ahorroAnual, currency) : "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}

type PaybackProps = {
  inversionValida: boolean;
  inversionTotalOverride: number | undefined;
  tieneInversion: boolean;
  paybackMeses: number | null;
  paybackAnios: number | null;
  recomendaciones: string[];
};

function renderPaybackAndRecommendations({
  inversionValida,
  inversionTotalOverride,
  tieneInversion,
  paybackMeses,
  paybackAnios,
  recomendaciones,
}: PaybackProps): ReactNode {
  return (
    <div className="mt-2 grid gap-2 print:mt-2 print:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
        <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
          4. Retorno de la inversión
        </h3>
        {tieneInversion && paybackMeses != null && paybackAnios != null ? (
          <dl className="grid gap-x-3 gap-y-1.5 text-sm sm:grid-cols-2 print:grid-cols-2 print:text-[11px]">
            {inversionValida && (
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Inversión estimada</dt>
                <dd className="font-medium text-slate-800 dark:text-slate-200">
                  ${formatMoney(inversionTotalOverride!, "")}
                </dd>
              </div>
            )}
            <div className="sm:col-span-2 print:col-span-2">
              <dt className="text-slate-500 dark:text-slate-400">Periodo de recuperación (payback)</dt>
              <dd className="font-medium text-slate-800 dark:text-slate-200">
                {Math.round(paybackMeses)} meses ({paybackAnios.toFixed(1)} años)
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-[11px] leading-snug text-slate-600 dark:text-slate-400 print:text-[10px]">
            No es posible estimar el retorno con la información disponible.
            {!inversionValida &&
              " El estudio no incluye el costo total del proyecto; puede asociar una cotización con el valor de la instalación para calcular el payback."}
          </p>
        )}
      </section>

      <section className="border border-slate-200/80 bg-slate-50/50 p-2.5 sm:rounded-lg sm:p-3.5 dark:border-slate-700 dark:bg-slate-800/40 print:rounded-none print:border-slate-300 print:bg-transparent print:p-2">
        <h3 className="mb-1.5 border-b border-slate-200/80 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:border-slate-600 dark:text-slate-400 print:mb-1 print:border-slate-300 print:pb-0.5 print:text-[10px]">
          5. Recomendaciones
        </h3>
        <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-snug text-slate-700 dark:text-slate-300 print:text-[10px]">
          {recomendaciones.map((text, i) => (
            <li key={i}>{text}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Columnas 2–3 del grid (energético + económico) para on-grid / híbrido. */
function renderOnGridSummary(props: SummaryBlockProps): ReactNode {
  return (
    <>
      {renderOnGridEnergySection(props)}
      {renderOnGridEconomicSection(props)}
    </>
  );
}

/** Columnas 2–3 del grid (energético + económico) para off-grid. */
function renderOffGridSummary(
  props: SummaryBlockProps & { consumoDiarioEstimadoKwh: number | null }
): ReactNode {
  return (
    <>
      {renderOffGridEnergySection({
        study: props.study,
        consumoAnualKwh: props.consumoAnualKwh,
        consumoDiarioEstimadoKwh: props.consumoDiarioEstimadoKwh,
        coberturaPercent: props.coberturaPercent,
      })}
      {renderOffGridEconomicSection(props)}
    </>
  );
}

/** Misma base on-grid que `renderOnGridSummary` (mensaje híbrido va fuera, encima del grid). */
function renderHybridSummary(props: SummaryBlockProps): ReactNode {
  return renderOnGridSummary(props);
}

export function EstudioFvInformeEjecutivo({ study, inversionTotalOverride, panelCountOverride }: Props) {
  const currency = study.currency ?? "";
  const months = study.months;
  const { consumoAnualKwh, autoconsumoAnualKwh, inyeccionAnualKwh } = deriveFromMonths(months);

  const tipoProyectoLabel = PROJECT_TYPE_OPTIONS.find((o) => o.value === study.tipoProyecto)?.label ?? study.tipoProyecto ?? "—";
  const conexionLabel = CONNECTION_OPTIONS.find((o) => o.value === study.connectionType)?.label ?? study.connectionType ?? "—";
  const systemNorm = normalizeFvStudySystemType(study.systemType);
  const systemLabel = MARGIN_SYSTEM_TYPE_LABELS[systemNorm] ?? study.systemType ?? "—";
  const gridFlags = getStudyGridDisplayFlags(study);
  const resolvedScenario = resolveScenarioFromStudy(study);
  const redDisponibleLabel = formatSiNo(gridFlags.utilityGridAvailable);
  const inyeccionRedLabel = formatSiNo(gridFlags.gridExportEnabled);
  const modoSistemaLabel = getScenarioUserLabel(resolvedScenario);
  const configuracionRedNarrative = getExecutiveScenarioNarrative(resolvedScenario);
  const panelCountDisplay =
    panelCountOverride != null && panelCountOverride > 0 ? panelCountOverride : study.cantidadPaneles;
  const ubicacion =
    study.client?.address?.trim() ||
    (study.latitude != null && study.longitude != null
      ? `${study.latitude}, ${study.longitude}`
      : "—");

  const coberturaPercent =
    consumoAnualKwh != null && consumoAnualKwh > 0 && study.generacionAnualKwh != null
      ? Math.min(100, (study.generacionAnualKwh / consumoAnualKwh) * 100)
      : study.porcentajeAhorro ?? null;

  const ahorroMensualPromedio =
    study.ahorroAnual != null && study.ahorroAnual >= 0 ? study.ahorroAnual / 12 : null;
  const ingresoInyeccion = ingresoInyeccionAnual(inyeccionAnualKwh, study.valorKwhInyeccion);

  const ahorroAnualValido = study.ahorroAnual != null && study.ahorroAnual > 0;
  const inversionValida = inversionTotalOverride != null && inversionTotalOverride > 0;
  const tieneInversion = Boolean(inversionValida && ahorroAnualValido);
  const paybackYears = tieneInversion && study.ahorroAnual ? inversionTotalOverride! / study.ahorroAnual : null;
  const paybackMeses = paybackYears != null ? paybackYears * 12 : null;
  const paybackAnios = paybackYears;

  const recomendaciones = buildExecutiveRecommendations(systemNorm, {
    months,
    consumoAnualKwh,
    inyeccionAnualKwh,
    coberturaPercent,
    study,
    tieneInversion,
    paybackAnios,
  });

  const consumoDiarioEstimadoKwh =
    consumoAnualKwh != null && consumoAnualKwh >= 0 ? consumoAnualKwh / 365 : null;

  const blockProps: SummaryBlockProps = {
    study,
    currency,
    consumoAnualKwh,
    autoconsumoAnualKwh,
    inyeccionAnualKwh,
    coberturaPercent,
    ahorroMensualPromedio,
    ingresoInyeccion,
    inversionValida,
    inversionTotalOverride,
  };

  const paybackProps: PaybackProps = {
    inversionValida,
    inversionTotalOverride,
    tieneInversion,
    paybackMeses,
    paybackAnios,
    recomendaciones,
  };

  return (
    <div className="border-0 bg-transparent p-0 shadow-none sm:p-0 print:border-b print:border-slate-300 print:pb-3">
      <h2 className="mb-1 border-b border-slate-200 pb-1.5 text-base font-semibold tracking-tight text-slate-900 dark:border-slate-600 dark:text-slate-100 print:mb-1 print:border-slate-300 print:pb-1 print:text-[14px] sm:text-lg">
        Informe ejecutivo
      </h2>
      <p className="mb-3 text-xs leading-snug text-slate-600 dark:text-slate-400 print:mb-2 print:text-[10px] sm:text-sm">
        Resumen del proyecto para evaluación comercial y técnica.
      </p>

      {systemNorm === "HYBRID" && (
        <section className="print-avoid-break mb-2 border-b border-slate-200/90 pb-2 dark:border-slate-600 print:mb-2 print:pb-1.5">
          <p className="text-[11px] leading-snug text-slate-700 dark:text-slate-300 print:text-[10px]">
            El sistema contempla operación con red y respaldo energético, sujeto a definición de almacenamiento.
          </p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-2 xl:grid-cols-3 xl:gap-3 print:grid-cols-3 print:gap-2">
        {renderTechnicalSection({
          study,
          tipoProyectoLabel,
          systemLabel,
          systemNorm,
          panelCountDisplay,
          conexionLabel,
          ubicacion,
          redDisponibleLabel,
          inyeccionRedLabel,
          modoSistemaLabel,
          configuracionRedNarrative,
        })}
        {systemNorm === "ON_GRID" && renderOnGridSummary(blockProps)}
        {systemNorm === "OFF_GRID" &&
          renderOffGridSummary({ ...blockProps, consumoDiarioEstimadoKwh })}
        {systemNorm === "HYBRID" && renderHybridSummary(blockProps)}
      </div>

      {renderPaybackAndRecommendations(paybackProps)}
    </div>
  );
}

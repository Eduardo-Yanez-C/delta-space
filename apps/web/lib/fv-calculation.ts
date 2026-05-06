/**
 * Previsualización del cálculo FV (mismas fórmulas que backend).
 * Prioridad consumo: si consumoAnualKwh existe se usa; si no, consumoAnualKwh = consumoMensualKwh * 12.
 * Generación mensual en Fase 5: generacionAnualKwh / 12.
 */

const DEFAULT_HSP_DAILY = 5.5;
const DEFAULT_PR = 0.85;

export type FvInput = {
  consumoMensualKwh: number;
  consumoAnualKwh?: number;
  cuentaMensual: number;
  valorKwhConsumo: number;
  valorKwhInyeccion: number;
  coberturaDeseada: number;
  tipoProyecto: string;
  potenciaObjetivoKwp?: number;
  potenciaPorPanelWp: number;
};

export type FvResult = {
  plantaKwp: number;
  cantidadPaneles: number;
  generacionAnualKwh: number;
  generacionMensualKwh: number;
  ahorroMensual: number;
  ahorroAnual: number;
  porcentajeAhorro: number;
  pagoResidual: number;
  hspDailyUsed: number;
  performanceRatioUsed: number;
  calculationMethodVersion: string;
};

function resolveConsumption(input: FvInput): { consumoAnualKwh: number; consumoMensualKwh: number } {
  if (input.consumoAnualKwh != null && input.consumoAnualKwh > 0) {
    return {
      consumoAnualKwh: input.consumoAnualKwh,
      consumoMensualKwh: input.consumoAnualKwh / 12,
    };
  }
  const consumoMensualKwh = input.consumoMensualKwh;
  return {
    consumoAnualKwh: consumoMensualKwh * 12,
    consumoMensualKwh,
  };
}

export function calculateFvPreview(input: FvInput, hspDaily = DEFAULT_HSP_DAILY, pr = DEFAULT_PR): FvResult {
  const { consumoAnualKwh, consumoMensualKwh } = resolveConsumption(input);
  const cobertura = Math.min(100, Math.max(0, input.coberturaDeseada)) / 100;
  const energiaACubrirKwh = consumoAnualKwh * cobertura;
  const generacionAnualPorKwp = hspDaily * 365 * pr;

  let plantaKwp: number;
  if (input.potenciaObjetivoKwp != null && input.potenciaObjetivoKwp > 0) {
    plantaKwp = input.potenciaObjetivoKwp;
  } else {
    plantaKwp = generacionAnualPorKwp > 0 ? energiaACubrirKwh / generacionAnualPorKwp : 0;
  }
  plantaKwp = Math.round(plantaKwp * 100) / 100;

  const potenciaPorPanelWp = input.potenciaPorPanelWp > 0 ? input.potenciaPorPanelWp : 400;
  const cantidadPaneles = Math.ceil((plantaKwp * 1000) / potenciaPorPanelWp);
  const potenciaRealKwp = (cantidadPaneles * potenciaPorPanelWp) / 1000;
  const generacionAnualKwh = potenciaRealKwp * hspDaily * 365 * pr;
  const generacionMensualKwh = generacionAnualKwh / 12;

  const autoconsumo = Math.min(generacionMensualKwh, consumoMensualKwh);
  const excedente = Math.max(0, generacionMensualKwh - consumoMensualKwh);
  const ahorroMensual = autoconsumo * input.valorKwhConsumo + excedente * input.valorKwhInyeccion;
  const ahorroAnual = ahorroMensual * 12;
  const cuentaMensual = input.cuentaMensual >= 0 ? input.cuentaMensual : 0;
  const pagoResidual = Math.max(0, cuentaMensual - ahorroMensual);
  const porcentajeAhorro = cuentaMensual > 0 ? (ahorroMensual / cuentaMensual) * 100 : 0;

  return {
    plantaKwp: Math.round(potenciaRealKwp * 100) / 100,
    cantidadPaneles,
    generacionAnualKwh: Math.round(generacionAnualKwh * 100) / 100,
    generacionMensualKwh: Math.round(generacionMensualKwh * 100) / 100,
    ahorroMensual: Math.round(ahorroMensual * 100) / 100,
    ahorroAnual: Math.round(ahorroAnual * 100) / 100,
    porcentajeAhorro: Math.round(porcentajeAhorro * 100) / 100,
    pagoResidual: Math.round(pagoResidual * 100) / 100,
    hspDailyUsed: hspDaily,
    performanceRatioUsed: pr,
    calculationMethodVersion: "1.0",
  };
}

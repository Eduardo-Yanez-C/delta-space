/** Paridad con dist: clase sin validadores (cuerpo JSON pasa directo al servicio). */
export class CreateFvCalculationDto {
  quoteVersionId?: string;
  consumoAnualKwh?: number;
  consumoMensualKwh?: number;
  cuentaMensual?: number;
  valorKwhConsumo?: number;
  valorKwhInyeccion?: number;
  coberturaDeseada?: number;
  tipoProyecto?: string;
  potenciaObjetivoKwp?: number | null;
  potenciaPorPanelWp?: number;
  currency?: string;
}

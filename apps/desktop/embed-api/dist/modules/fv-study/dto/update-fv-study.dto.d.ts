import { FvStudyMonthInputDto } from "./month-input.dto";
export declare class UpdateFvStudyDto {
    title?: string;
    referenceMonth?: number;
    referenceBillAmount?: number;
    referenceConsumptionKwh?: number;
    valorKwhConsumo?: number;
    valorKwhInyeccion?: number;
    currency?: string;
    connectionType?: string;
    tipoProyecto?: string;
    potenciaSistemaKwp?: number;
    potenciaPorPanelWp?: number;
    coberturaDeseada?: number;
    hspDailyUsed?: number;
    performanceRatioUsed?: number;
    calculationMethodVersion?: string;
    status?: string;
    generationSource?: string;
    solarResourceProvider?: string;
    latitude?: number;
    longitude?: number;
    mountingType?: string;
    tiltDegrees?: number;
    azimuthDegrees?: number;
    solarResourceRequestedAt?: string;
    solarResourceMetadata?: string;
    months?: FvStudyMonthInputDto[];
}

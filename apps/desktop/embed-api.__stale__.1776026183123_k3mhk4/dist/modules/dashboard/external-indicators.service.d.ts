export type ExternalIndicatorSeriesPoint = {
    fecha: string;
    valor: number;
};
export type ExternalIndicatorsSeriesResponse = {
    dolar: ExternalIndicatorSeriesPoint[] | null;
    uf: ExternalIndicatorSeriesPoint[] | null;
    ipc: ExternalIndicatorSeriesPoint[] | null;
    period: "weekly" | "monthly" | "yearly";
    updatedAt: string | null;
    source: string;
    error?: string;
};
export type ExternalIndicatorItem = {
    value: number | null;
    fecha: string | null;
    unidad: string | null;
    error?: boolean;
};
export type ExternalIndicatorsResponse = {
    dolar: ExternalIndicatorItem;
    uf: ExternalIndicatorItem;
    ipc: ExternalIndicatorItem;
    updatedAt: string | null;
    source: string;
    error?: string;
};
export declare class ExternalIndicatorsService {
    private cache;
    private seriesCache;
    private buildEmptyResponse;
    getExternalIndicators(): Promise<ExternalIndicatorsResponse>;
    private fetchIndicatorByYear;
    private buildWeeklySeries;
    private buildMonthlySeries;
    private buildYearlySeries;
    getExternalIndicatorsSeries(period: "weekly" | "monthly" | "yearly"): Promise<ExternalIndicatorsSeriesResponse>;
}

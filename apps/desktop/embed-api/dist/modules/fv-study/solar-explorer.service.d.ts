import type { SolarResourceExternalContextResponse } from "./dto/solar-resource-external-context.response";
import type { ExternalEstimateResponse, ExternalEstimateMonth } from "./dto/external-estimate.response";
export declare class SolarExplorerService {
    isProviderConfigured(): boolean;
    validateContext(context: SolarResourceExternalContextResponse): {
        valid: boolean;
        message?: string;
    };
    buildExternalEstimateRequest(context: SolarResourceExternalContextResponse): Record<string, unknown> | null;
    private buildUsedContext;
    requestExternalEstimate(context: SolarResourceExternalContextResponse): Promise<ExternalEstimateResponse>;
    private callMinenergiaProxy;
    private postToProxy;
    private downloadCsv;
    private parseMonthlyCsv;
    private callPvwattsV8;
    normalizeMonthlyGeneration(monthlyKwh: number[]): ExternalEstimateMonth[] | null;
}

export type ExternalEstimateUsedContext = {
    latitude: number | null;
    longitude: number | null;
    panelCount: number | null;
    panelPowerWp: number | null;
    systemPowerKw: number | null;
    mountingType: string | null;
    tiltDegrees: number | null;
    azimuthDegrees: number | null;
};
export type ExternalEstimateMonth = {
    month: number;
    label: string;
    generationKwh: number;
};
export type ExternalEstimateResponse = {
    provider: "EXPLORADOR_SOLAR";
    providerConfigured: boolean;
    requestReady: boolean;
    usedContext: ExternalEstimateUsedContext;
    panelSource: "IMPLANTATION_DESIGN" | "FV_STUDY" | null;
    externalRequest: unknown | null;
    monthlyGeneration: ExternalEstimateMonth[] | null;
    annualGenerationKwh: number | null;
    metadata: Record<string, unknown> | null;
    message: string | null;
};

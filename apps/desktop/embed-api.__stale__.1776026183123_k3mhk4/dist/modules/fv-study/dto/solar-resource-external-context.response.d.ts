export type SolarResourceExternalContextResponse = {
    fvStudyId: string;
    generationSource: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    mountingType: string | null;
    tiltDegrees: number | null;
    azimuthDegrees: number | null;
    solarResourceProvider: string | null;
    panelCount: number | null;
    panelSource: "IMPLANTATION_DESIGN" | "FV_STUDY" | null;
    panelProductId: string | null;
    panelName: string | null;
    panelPowerWp: number | null;
    systemPowerKw: number | null;
    hasImplantationDesign: boolean;
    implantationDesignId: string | null;
};

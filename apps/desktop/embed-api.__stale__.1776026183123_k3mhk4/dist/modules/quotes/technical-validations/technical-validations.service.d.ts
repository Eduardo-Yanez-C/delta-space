import type { AuthUserPayload } from "../../auth/auth.service";
import { PrismaService } from "../../../infra/prisma/prisma.service";
type ProductWithSpecs = {
    id: string;
    name: string;
    connectionType: string | null;
    nominalVoltageV: number | null;
    inverterType: string | null;
    isBatteryComponent: boolean | null;
    panelSpecs?: {
        vocV: number | null;
        powerW: number | null;
    } | null;
    inverterSpecs?: {
        connectionType: string | null;
        inverterType: string | null;
        maxPvVoltageV: number | null;
        powerAcW: number | null;
    } | null;
    batterySpecs?: {
        nominalVoltageV: number | null;
    } | null;
};
export type ProductTech = {
    id: string;
    name: string;
    connectionType: string | null;
    nominalVoltageV: number | null;
    inverterType: string | null;
    isBatteryComponent: boolean | null;
    panelSpecs?: ProductWithSpecs["panelSpecs"];
    inverterSpecs?: ProductWithSpecs["inverterSpecs"];
    batterySpecs?: ProductWithSpecs["batterySpecs"];
};
export type ProductEntry = {
    productId: string;
    product: ProductTech;
    itemId: string | null;
    lineId: string | null;
    productNameSnapshot: string;
    quantity?: number;
};
export type TechnicalValidationAlert = {
    code: string;
    message: string;
    severity: string;
    productId: string | null;
    itemId: string | null;
    lineId: string | null;
};
export declare class TechnicalValidationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getAlerts(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        alerts: TechnicalValidationAlert[];
    }>;
    private buildProductEntries;
    private ruleConnectionMismatchStudy;
    private ruleVoltageMismatchInverterBattery;
    private ruleSystemTypeStudyVsInverter;
    private ruleSystemTypeStudyVsBattery;
    private ruleVoltageMismatchBetweenLines;
    private rulePanelVocExceedsInverterMaxPv;
    private ruleInverterPowerMismatchPanels;
}
export {};

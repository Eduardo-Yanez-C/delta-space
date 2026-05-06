import type { AuthUserPayload } from "../../auth/auth.service";
import { QuoteAddOnsService } from "../../quote-addons/quote-addons.service";
import { SetAddonInputsDto } from "../../quote-addons/dto/set-addon-inputs.dto";
import { QuoteVersionsService } from "./quote-versions.service";
import { TechnicalValidationsService } from "../technical-validations/technical-validations.service";
import { CreateVersionDto } from "./dto/create-version.dto";
import { UpdateVersionDto } from "./dto/update-version.dto";
export declare class QuoteVersionsController {
    private readonly versionsService;
    private readonly quoteAddOnsService;
    private readonly technicalValidationsService;
    constructor(versionsService: QuoteVersionsService, quoteAddOnsService: QuoteAddOnsService, technicalValidationsService: TechnicalValidationsService);
    findAll(quoteId: string, user: AuthUserPayload): Promise<{
        id: string;
        versionNumber: number;
        status: string;
        subtotal: number;
        discountsTotal: number;
        marginTotal: number;
        taxesTotal: number;
        total: number;
        globalDiscountPercent: number | null;
        globalMarginPercent: number | null;
        vatPercent: number;
        createdAt: Date;
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        };
    }[]>;
    getAddonInputs(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        inputs: {
            inputKey: string;
            valueNumeric: number | null;
            valueText: string | null;
        }[];
    }>;
    setAddonInputs(quoteId: string, versionId: string, dto: SetAddonInputsDto, user: AuthUserPayload): Promise<{
        inputs: {
            inputKey: string;
            valueNumeric: number | null;
            valueText: string | null;
        }[];
    }>;
    getAddonSuggestions(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        suggestions: {
            id: string;
            quoteAddOnId: string;
            code: string;
            name: string;
            description: string | null;
            unit: string;
            suggestedQuantity: number | null;
            suggestedUnitPrice: number | null;
            currency: string | null;
            status: string;
            quoteItemId: string | null;
        }[];
    }>;
    evaluateAddonSuggestions(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        suggestions: {
            id: string;
            quoteAddOnId: string;
            code: string;
            name: string;
            description: string | null;
            unit: string;
            suggestedQuantity: number | null;
            suggestedUnitPrice: number | null;
            currency: string | null;
            status: string;
            quoteItemId: string | null;
        }[];
    }>;
    acceptAddonSuggestion(quoteId: string, versionId: string, suggestionId: string, user: AuthUserPayload): Promise<{
        suggestionId: string;
        status: "ACCEPTED";
        quoteItemId: null;
        quoteItemLineId: string;
        mode: "HIERARCHICAL";
    } | {
        suggestionId: string;
        status: "ACCEPTED";
        quoteItemId: string;
        quoteItemLineId: null;
        mode: "FLAT";
    }>;
    rejectAddonSuggestion(quoteId: string, versionId: string, suggestionId: string, user: AuthUserPayload): Promise<{
        suggestionId: string;
        status: "REJECTED";
    }>;
    findOne(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        subtotal: number;
        discountsTotal: number;
        marginTotal: number;
        taxesTotal: number;
        total: number;
        globalDiscountPercent: number | null;
        globalMarginPercent: number | null;
        vatPercent: number;
        marginEconomicsSummary: {
            costTotal: number;
            saleSubtotal: number;
            saleNetBeforeTax: number;
            utilityTotal: number;
            marginPercentOnSaleNet: number | null;
        } | undefined;
        items: Record<string, unknown>[];
        mainItems: {
            lines: Record<string, unknown>[];
            marginBlockEconomics?: {
                blockCostTotal: number;
                blockSaleTotal: number;
                blockUtility: number;
                blockMarginPercent: number | null;
            } | undefined;
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            visibleInFinalQuote: boolean;
            totalMode: string;
            totalOverride: number | null;
            total: number;
        }[];
        createdBy: {
            id: string;
            email: string;
            name: string | null;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        versionNumber: number;
        quoteId: string;
        createdById: string;
        fvSnapshot: string | null;
    }>;
    getTechnicalValidations(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        alerts: import("../technical-validations/technical-validations.service").TechnicalValidationAlert[];
    }>;
    create(quoteId: string, dto: CreateVersionDto, user: AuthUserPayload): Promise<{
        subtotal: number;
        discountsTotal: number;
        marginTotal: number;
        taxesTotal: number;
        total: number;
        globalDiscountPercent: number | null;
        globalMarginPercent: number | null;
        vatPercent: number;
        items: {
            unitPriceSnapshot: number;
            unitCostSnapshot: number | null;
            quantity: number;
            lineTotalSnapshot: number;
        }[];
        id: string;
        versionNumber: number;
        status: string;
        createdAt: Date;
        createdBy: {
            id: string;
            name: string | null;
            email: string;
        };
    }>;
    update(quoteId: string, versionId: string, dto: UpdateVersionDto, user: AuthUserPayload): Promise<{
        subtotal: number;
        discountsTotal: number;
        marginTotal: number;
        taxesTotal: number;
        total: number;
        globalDiscountPercent: number | null;
        globalMarginPercent: number | null;
        vatPercent: number;
        marginEconomicsSummary: {
            costTotal: number;
            saleSubtotal: number;
            saleNetBeforeTax: number;
            utilityTotal: number;
            marginPercentOnSaleNet: number | null;
        } | undefined;
        items: Record<string, unknown>[];
        mainItems: {
            lines: Record<string, unknown>[];
            marginBlockEconomics?: {
                blockCostTotal: number;
                blockSaleTotal: number;
                blockUtility: number;
                blockMarginPercent: number | null;
            } | undefined;
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            visibleInFinalQuote: boolean;
            totalMode: string;
            totalOverride: number | null;
            total: number;
        }[];
        createdBy: {
            id: string;
            email: string;
            name: string | null;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        versionNumber: number;
        quoteId: string;
        createdById: string;
        fvSnapshot: string | null;
    }>;
    refreshFromStudy(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        subtotal: number;
        discountsTotal: number;
        marginTotal: number;
        taxesTotal: number;
        total: number;
        globalDiscountPercent: number | null;
        globalMarginPercent: number | null;
        vatPercent: number;
        marginEconomicsSummary: {
            costTotal: number;
            saleSubtotal: number;
            saleNetBeforeTax: number;
            utilityTotal: number;
            marginPercentOnSaleNet: number | null;
        } | undefined;
        items: Record<string, unknown>[];
        mainItems: {
            lines: Record<string, unknown>[];
            marginBlockEconomics?: {
                blockCostTotal: number;
                blockSaleTotal: number;
                blockUtility: number;
                blockMarginPercent: number | null;
            } | undefined;
            id: string;
            name: string;
            description: string | null;
            sortOrder: number;
            visibleInFinalQuote: boolean;
            totalMode: string;
            totalOverride: number | null;
            total: number;
        }[];
        createdBy: {
            id: string;
            email: string;
            name: string | null;
        };
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        versionNumber: number;
        quoteId: string;
        createdById: string;
        fvSnapshot: string | null;
    }>;
}

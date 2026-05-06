import type { AuthUserPayload } from "../../auth/auth.service";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { CreateVersionDto } from "./dto/create-version.dto";
import { UpdateVersionDto } from "./dto/update-version.dto";
export declare const ADICIONALES_MAIN_ITEM_NAME = "Adicionales";
export declare class QuoteVersionsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(quoteId: string, currentUser: AuthUserPayload): Promise<{
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
    findOne(quoteId: string, versionId: string, currentUser?: AuthUserPayload): Promise<{
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
    create(quoteId: string, dto: CreateVersionDto, createdById: string, currentUser?: AuthUserPayload): Promise<{
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
    update(quoteId: string, versionId: string, dto: UpdateVersionDto, currentUser?: AuthUserPayload): Promise<{
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
    private buildFvSnapshotJson;
    refreshVersionFromStudy(quoteId: string, versionId: string, currentUser?: AuthUserPayload): Promise<{
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
    recalcVersionTotals(versionId: string): Promise<void>;
    recalcVersionTotalsTx(tx: Parameters<Parameters<PrismaService["$transaction"]>[0]>[0], versionId: string): Promise<void>;
    private mapVersionWithTotals;
    acceptAddonSuggestion(quoteId: string, versionId: string, suggestionId: string, currentUser: AuthUserPayload): Promise<{
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
    private acceptAddonSuggestionHierarchical;
    private acceptAddonSuggestionFlat;
    rejectAddonSuggestion(quoteId: string, versionId: string, suggestionId: string, currentUser: AuthUserPayload): Promise<{
        suggestionId: string;
        status: "REJECTED";
    }>;
    private ensureVersionBelongsToQuote;
}

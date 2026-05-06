import type { AuthUserPayload } from "../auth/auth.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { SetAddonInputsDto } from "./dto/set-addon-inputs.dto";
export declare class QuoteAddOnsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private ensureVersionBelongsToQuote;
    findAll(): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        sortOrder: number;
        conditionType: string;
        thresholdNumeric: number | null;
        inputKey: string;
        quantityRule: string;
        unit: string;
        unitPriceDefault: number | null;
        currency: string | null;
        applicationMode: string;
    }[]>;
    findOne(id: string): Promise<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        sortOrder: number;
        conditionType: string;
        thresholdNumeric: number | null;
        inputKey: string;
        quantityRule: string;
        unit: string;
        unitPriceDefault: number | null;
        currency: string | null;
        applicationMode: string;
    }>;
    getAddOnInputs(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
        inputs: {
            inputKey: string;
            valueNumeric: number | null;
            valueText: string | null;
        }[];
    }>;
    setAddOnInputs(quoteId: string, versionId: string, dto: SetAddonInputsDto, user: AuthUserPayload): Promise<{
        inputs: {
            inputKey: string;
            valueNumeric: number | null;
            valueText: string | null;
        }[];
    }>;
    evaluateAddOnSuggestions(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
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
    getAddOnSuggestions(quoteId: string, versionId: string, user: AuthUserPayload): Promise<{
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
}

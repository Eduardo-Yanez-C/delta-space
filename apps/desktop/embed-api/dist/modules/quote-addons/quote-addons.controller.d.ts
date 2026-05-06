import { QuoteAddOnsService } from "./quote-addons.service";
export declare class QuoteAddOnsController {
    private readonly quoteAddOnsService;
    constructor(quoteAddOnsService: QuoteAddOnsService);
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
}

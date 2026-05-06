import type { AuthUserPayload } from "../auth/auth.service";
import { QuoteTemplatesService } from "./quote-templates.service";
import { CreateQuoteFromTemplateDto } from "./dto/create-quote-from-template.dto";
import { CreateQuoteTemplateDto } from "./dto/create-quote-template.dto";
import { CreateTemplateLineDto } from "./dto/create-template-line.dto";
import { UpdateTemplateLineDto } from "./dto/update-template-line.dto";
import { UpdateQuoteTemplateDto } from "./dto/update-quote-template.dto";
import { UpdateTemplateItemDto } from "./dto/update-template-item.dto";
export declare class QuoteTemplatesController {
    private readonly quoteTemplatesService;
    constructor(quoteTemplatesService: QuoteTemplatesService);
    findAll(quoteKind?: string): Promise<{
        id: string;
        name: string;
        quoteKind: string;
        systemType: string;
        targetPowerKwp: number;
        description: string | null;
        sortOrder: number;
        items: {
            id: string;
            sortOrder: number;
            itemType: string;
            quantityRule: string;
            quantityFixed: number | null;
            potenciaPorPanelWp: number | null;
            productNameSnapshot: string;
            productDescriptionSnapshot: string | null;
            unitPriceDefault: number;
            visibleInFinalQuoteDefault: boolean;
            lines: {
                id: string;
                sortOrder: number;
                source: string;
                productId: string | null;
                productNameSnapshot: string | null;
                productDescriptionSnapshot: string | null;
                quantityRule: string;
                quantityFixed: number | null;
                potenciaPorPanelWp: number | null;
                unitPriceDefault: number;
                currency: string | null;
                visibleInFinalQuoteDefault: boolean;
                product: {
                    id: string;
                    name: string;
                    description: string | null;
                } | null | undefined;
            }[];
        }[];
    }[]>;
    createTemplate(body: CreateQuoteTemplateDto): Promise<{
        id: string;
        name: string;
        quoteKind: string;
        systemType: string;
        targetPowerKwp: number;
        description: string | null;
        sortOrder: number;
        active: boolean;
        items: {
            id: string;
            sortOrder: number;
            itemType: string;
            quantityRule: string;
            quantityFixed: number | null;
            potenciaPorPanelWp: number | null;
            productNameSnapshot: string;
            productDescriptionSnapshot: string | null;
            unitPriceDefault: number;
            visibleInFinalQuoteDefault: boolean;
            lines: {
                id: string;
                sortOrder: number;
                source: string;
                productId: string | null;
                productNameSnapshot: string | null;
                productDescriptionSnapshot: string | null;
                quantityRule: string;
                quantityFixed: number | null;
                potenciaPorPanelWp: number | null;
                unitPriceDefault: number;
                currency: string | null;
                visibleInFinalQuoteDefault: boolean;
                product: {
                    id: string;
                    name: string;
                    description: string | null;
                } | null | undefined;
            }[];
        }[];
    }>;
    findOne(id: string): Promise<{
        id: string;
        name: string;
        quoteKind: string;
        systemType: string;
        targetPowerKwp: number;
        description: string | null;
        sortOrder: number;
        active: boolean;
        items: {
            id: string;
            sortOrder: number;
            itemType: string;
            quantityRule: string;
            quantityFixed: number | null;
            potenciaPorPanelWp: number | null;
            productNameSnapshot: string;
            productDescriptionSnapshot: string | null;
            unitPriceDefault: number;
            visibleInFinalQuoteDefault: boolean;
            lines: {
                id: string;
                sortOrder: number;
                source: string;
                productId: string | null;
                productNameSnapshot: string | null;
                productDescriptionSnapshot: string | null;
                quantityRule: string;
                quantityFixed: number | null;
                potenciaPorPanelWp: number | null;
                unitPriceDefault: number;
                currency: string | null;
                visibleInFinalQuoteDefault: boolean;
                product: {
                    id: string;
                    name: string;
                    description: string | null;
                } | null | undefined;
            }[];
        }[];
    }>;
    updateTemplate(id: string, body: UpdateQuoteTemplateDto): Promise<{
        id: string;
        name: string;
        quoteKind: string;
        systemType: string;
        targetPowerKwp: number;
        description: string | null;
        sortOrder: number;
        active: boolean;
        items: {
            id: string;
            sortOrder: number;
            itemType: string;
            quantityRule: string;
            quantityFixed: number | null;
            potenciaPorPanelWp: number | null;
            productNameSnapshot: string;
            productDescriptionSnapshot: string | null;
            unitPriceDefault: number;
            visibleInFinalQuoteDefault: boolean;
            lines: {
                id: string;
                sortOrder: number;
                source: string;
                productId: string | null;
                productNameSnapshot: string | null;
                productDescriptionSnapshot: string | null;
                quantityRule: string;
                quantityFixed: number | null;
                potenciaPorPanelWp: number | null;
                unitPriceDefault: number;
                currency: string | null;
                visibleInFinalQuoteDefault: boolean;
                product: {
                    id: string;
                    name: string;
                    description: string | null;
                } | null | undefined;
            }[];
        }[];
    }>;
    createQuoteFromTemplate(id: string, body: CreateQuoteFromTemplateDto, user: AuthUserPayload): Promise<{
        quote: Omit<{
            id: string;
            createdAt: Date;
            updatedAt: Date;
            quoteKind: string;
            salespersonId: string | null;
            ownerId: string;
            commercialSequence: number | null;
            commercialNumber: string | null;
            clientId: string;
            sourceFvStudyId: string | null;
            suggestedItemsFromStudy: boolean;
            sourceQuoteTemplateId: string | null;
            status: string;
            title: string;
            projectType: string;
            internalNotes: string | null;
            clientNotes: string | null;
            currency: string | null;
            validUntil: Date | null;
            paymentTerms: string | null;
            deliveryDays: number | null;
            commercialStage: string | null;
            leadNumber: string | null;
            technicalBasicsJson: string | null;
        }, "technicalBasicsJson"> & {
            technicalBasicsJson: Record<string, unknown> | null;
        };
        version: {
            id: string;
            versionNumber: number;
            status: string;
        };
    }>;
    updateTemplateItem(templateId: string, itemId: string, body: UpdateTemplateItemDto): Promise<{
        id: string;
        name: string;
        quoteKind: string;
        systemType: string;
        targetPowerKwp: number;
        description: string | null;
        sortOrder: number;
        active: boolean;
        items: {
            id: string;
            sortOrder: number;
            itemType: string;
            quantityRule: string;
            quantityFixed: number | null;
            potenciaPorPanelWp: number | null;
            productNameSnapshot: string;
            productDescriptionSnapshot: string | null;
            unitPriceDefault: number;
            visibleInFinalQuoteDefault: boolean;
            lines: {
                id: string;
                sortOrder: number;
                source: string;
                productId: string | null;
                productNameSnapshot: string | null;
                productDescriptionSnapshot: string | null;
                quantityRule: string;
                quantityFixed: number | null;
                potenciaPorPanelWp: number | null;
                unitPriceDefault: number;
                currency: string | null;
                visibleInFinalQuoteDefault: boolean;
                product: {
                    id: string;
                    name: string;
                    description: string | null;
                } | null | undefined;
            }[];
        }[];
    }>;
    createLine(templateId: string, itemId: string, body: CreateTemplateLineDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string | null;
        potenciaPorPanelWp: number | null;
        sortOrder: number;
        source: string;
        quantityRule: string;
        unitPriceDefault: import("@prisma/client/runtime/library").Decimal | null;
        productId: string | null;
        productNameSnapshot: string | null;
        productDescriptionSnapshot: string | null;
        quantityFixed: number | null;
        visibleInFinalQuoteDefault: boolean;
        quoteTemplateItemId: string;
    }>;
    updateLine(templateId: string, lineId: string, body: UpdateTemplateLineDto): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        currency: string | null;
        potenciaPorPanelWp: number | null;
        sortOrder: number;
        source: string;
        quantityRule: string;
        unitPriceDefault: import("@prisma/client/runtime/library").Decimal | null;
        productId: string | null;
        productNameSnapshot: string | null;
        productDescriptionSnapshot: string | null;
        quantityFixed: number | null;
        visibleInFinalQuoteDefault: boolean;
        quoteTemplateItemId: string;
    }>;
    deleteLine(templateId: string, lineId: string): Promise<{
        deleted: boolean;
    }>;
}

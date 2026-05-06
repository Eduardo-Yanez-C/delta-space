import type { AuthUserPayload } from "../auth/auth.service";
import { QuotesService } from "./quotes.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { FilterQuotesDto } from "./dto/filter-quotes.dto";
export declare class QuotesController {
    private readonly quotesService;
    constructor(quotesService: QuotesService);
    findAll(query: FilterQuotesDto, user: AuthUserPayload): Promise<{
        currentVersion: {
            id: string;
            versionNumber: number;
            status: string;
            total: number;
            createdAt: Date;
            createdBy: {
                id: string;
                name: string | null;
                email: string;
            } | undefined;
        } | null;
        client: {
            id: string;
            email: string | null;
            name: string;
        };
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
        owner: {
            id: string;
            email: string;
            name: string | null;
        };
        sourceQuoteTemplate: {
            id: string;
            name: string;
        } | null;
        salesperson: {
            id: string;
            email: string;
            name: string | null;
        } | null;
        technicalBasicsJson: Record<string, unknown> | null;
    }[]>;
    findOne(id: string, user: AuthUserPayload): Promise<{
        currentVersion: {
            id: string;
            versionNumber: number;
            status: string;
            total: number;
            createdAt: Date;
            createdBy: {
                id: string;
                name: string | null;
                email: string;
            } | undefined;
        } | null;
        versions: {
            id: string;
            versionNumber: number;
            status: string;
            subtotal: number;
            discountsTotal: number;
            taxesTotal: number;
            total: number;
            createdAt: Date;
            createdBy: {
                id: string;
                email: string;
                name: string | null;
            };
        }[];
        client: {
            id: string;
            email: string | null;
            name: string;
            createdAt: Date;
            updatedAt: Date;
            type: string;
            taxId: string | null;
            phone: string | null;
            address: string | null;
            notes: string | null;
        };
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
        owner: {
            id: string;
            email: string;
            name: string | null;
        };
        sourceFvStudy: {
            id: string;
            title: string;
        } | null;
        sourceQuoteTemplate: {
            id: string;
            name: string;
        } | null;
        salesperson: {
            id: string;
            email: string;
            name: string | null;
        } | null;
        technicalBasicsJson: Record<string, unknown> | null;
    }>;
    create(dto: CreateQuoteDto, user: AuthUserPayload): Promise<Omit<{
        client: {
            id: string;
            name: string;
        };
        owner: {
            id: string;
            email: string;
            name: string | null;
        };
        salesperson: {
            id: string;
            email: string;
            name: string | null;
        } | null;
    } & {
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
    }>;
    update(id: string, dto: UpdateQuoteDto, user: AuthUserPayload): Promise<Omit<{
        client: {
            id: string;
            name: string;
        };
        owner: {
            id: string;
            email: string;
            name: string | null;
        };
        salesperson: {
            id: string;
            email: string;
            name: string | null;
        } | null;
    } & {
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
    }>;
}

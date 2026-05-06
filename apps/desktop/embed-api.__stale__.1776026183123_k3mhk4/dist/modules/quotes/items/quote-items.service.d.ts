import type { AuthUserPayload } from "../../auth/auth.service";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import { CreateQuoteItemDto } from "./dto/create-quote-item.dto";
import { UpdateQuoteItemDto } from "./dto/update-quote-item.dto";
export declare class QuoteItemsService {
    private readonly prisma;
    private readonly quoteVersionsService;
    constructor(prisma: PrismaService, quoteVersionsService: QuoteVersionsService);
    findAll(quoteId: string, versionId: string, currentUser: AuthUserPayload): Promise<Record<string, unknown>[]>;
    addItem(quoteId: string, versionId: string, dto: CreateQuoteItemDto, currentUser: AuthUserPayload): Promise<Record<string, unknown>>;
    updateItem(quoteId: string, versionId: string, itemId: string, dto: UpdateQuoteItemDto, currentUser: AuthUserPayload): Promise<Record<string, unknown>>;
    removeItem(quoteId: string, versionId: string, itemId: string, currentUser?: AuthUserPayload): Promise<{
        deleted: boolean;
    }>;
    private ensureQuoteEditable;
    private ensureVersionBelongsToQuote;
    private mapItem;
}

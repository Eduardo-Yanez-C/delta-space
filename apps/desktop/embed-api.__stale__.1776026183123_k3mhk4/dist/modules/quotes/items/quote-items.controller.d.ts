import type { AuthUserPayload } from "../../auth/auth.service";
import { QuoteItemsService } from "./quote-items.service";
import { CreateQuoteItemDto } from "./dto/create-quote-item.dto";
import { UpdateQuoteItemDto } from "./dto/update-quote-item.dto";
export declare class QuoteItemsController {
    private readonly itemsService;
    constructor(itemsService: QuoteItemsService);
    findAll(quoteId: string, versionId: string, user: AuthUserPayload): Promise<Record<string, unknown>[]>;
    addItem(quoteId: string, versionId: string, dto: CreateQuoteItemDto, user: AuthUserPayload): Promise<Record<string, unknown>>;
    updateItem(quoteId: string, versionId: string, itemId: string, dto: UpdateQuoteItemDto, user: AuthUserPayload): Promise<Record<string, unknown>>;
    removeItem(quoteId: string, versionId: string, itemId: string, user: AuthUserPayload): Promise<{
        deleted: boolean;
    }>;
}

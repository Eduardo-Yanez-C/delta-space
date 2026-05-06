import type { AuthUserPayload } from "../../auth/auth.service";
import { QuoteMainItemsService } from "./quote-main-items.service";
import { CreateMainItemDto } from "./dto/create-main-item.dto";
import { CreateLineDto } from "./dto/create-line.dto";
import { UpdateLineDto } from "./dto/update-line.dto";
import { UpdateMainItemDto } from "./dto/update-main-item.dto";
export declare class QuoteMainItemsController {
    private readonly mainItemsService;
    constructor(mainItemsService: QuoteMainItemsService);
    createMainItem(quoteId: string, versionId: string, dto: CreateMainItemDto, user: AuthUserPayload): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        sortOrder: number;
        quoteVersionId: string;
        visibleInFinalQuote: boolean;
        totalMode: string;
        totalOverride: import("@prisma/client/runtime/library").Decimal | null;
        sourceFromFvStudyKind: string | null;
    }>;
    updateMainItem(quoteId: string, versionId: string, mainItemId: string, dto: UpdateMainItemDto, user: AuthUserPayload): Promise<{
        id: string;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        description: string | null;
        sortOrder: number;
        quoteVersionId: string;
        visibleInFinalQuote: boolean;
        totalMode: string;
        totalOverride: import("@prisma/client/runtime/library").Decimal | null;
        sourceFromFvStudyKind: string | null;
    }>;
    duplicateMainItem(quoteId: string, versionId: string, mainItemId: string, user: AuthUserPayload): Promise<{
        id: string;
    }>;
    createLine(quoteId: string, versionId: string, mainItemId: string, dto: CreateLineDto, user: AuthUserPayload): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        sortOrder: number;
        brandId: number | null;
        visibleInFinalQuote: boolean;
        quoteMainItemId: string;
        productId: string | null;
        categoryId: number | null;
        modelId: number | null;
        productNameSnapshot: string;
        productDescriptionSnapshot: string | null;
        categoryNameSnapshot: string | null;
        brandNameSnapshot: string | null;
        modelNameSnapshot: string | null;
        currencySnapshot: string;
        unitPriceSnapshot: import("@prisma/client/runtime/library").Decimal;
        unitCostSnapshot: import("@prisma/client/runtime/library").Decimal | null;
        discountPercentSnapshot: import("@prisma/client/runtime/library").Decimal | null;
        marginPercentSnapshot: import("@prisma/client/runtime/library").Decimal | null;
        quantity: import("@prisma/client/runtime/library").Decimal;
        lineTotalSnapshot: import("@prisma/client/runtime/library").Decimal;
        configSnapshot: string | null;
        addOnSuggestionId: string | null;
    }>;
    duplicateLine(quoteId: string, versionId: string, lineId: string, user: AuthUserPayload): Promise<{
        id: string;
    }>;
    updateLine(quoteId: string, versionId: string, lineId: string, dto: UpdateLineDto, user: AuthUserPayload): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        sortOrder: number;
        brandId: number | null;
        visibleInFinalQuote: boolean;
        quoteMainItemId: string;
        productId: string | null;
        categoryId: number | null;
        modelId: number | null;
        productNameSnapshot: string;
        productDescriptionSnapshot: string | null;
        categoryNameSnapshot: string | null;
        brandNameSnapshot: string | null;
        modelNameSnapshot: string | null;
        currencySnapshot: string;
        unitPriceSnapshot: import("@prisma/client/runtime/library").Decimal;
        unitCostSnapshot: import("@prisma/client/runtime/library").Decimal | null;
        discountPercentSnapshot: import("@prisma/client/runtime/library").Decimal | null;
        marginPercentSnapshot: import("@prisma/client/runtime/library").Decimal | null;
        quantity: import("@prisma/client/runtime/library").Decimal;
        lineTotalSnapshot: import("@prisma/client/runtime/library").Decimal;
        configSnapshot: string | null;
        addOnSuggestionId: string | null;
    }>;
    deleteLine(quoteId: string, versionId: string, lineId: string, user: AuthUserPayload): Promise<{
        deleted: boolean;
    }>;
}

import type { AuthUserPayload } from "../auth/auth.service";
import type { PrismaService } from "../../infra/prisma/prisma.service";
import type { Prisma } from "@prisma/client";
export type QuoteAccessRow = {
    quoteKind: string;
    ownerId: string;
    salespersonId: string | null;
};
export declare function canAccessQuote(user: AuthUserPayload, quote: QuoteAccessRow): boolean;
export declare function quoteVisibilityWhereForUser(userId: string): Prisma.QuoteWhereInput;
export declare function assertUserCanAccessQuote(prisma: PrismaService, quoteId: string, user: AuthUserPayload): Promise<void>;

import type { PrismaClient } from "@prisma/client";
export declare const COMMERCIAL_SEQUENCE_START = 2780;
export declare function getCommercialSuffix(projectType: string): string;
export declare function sellerInitialsForCommercialNumber(opts: {
    fullName?: string | null;
    name?: string | null;
    email?: string | null;
}): string;
export declare function getNextCommercialNumber(prisma: Pick<PrismaClient, "quote">, projectType: string, opts?: {
    sellerInitials?: string | null;
}): Promise<{
    commercialSequence: number;
    commercialNumber: string;
}>;

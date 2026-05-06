import type { AuthUserPayload } from "../../auth/auth.service";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import { ApplyCleanDto } from "./dto/apply-clean.dto";
export declare class MarginHierarchyService {
    private readonly prisma;
    private readonly quoteVersionsService;
    constructor(prisma: PrismaService, quoteVersionsService: QuoteVersionsService);
    applyCleanHierarchy(quoteId: string, versionId: string, dto: ApplyCleanDto, currentUser?: AuthUserPayload): Promise<{
        applied: boolean;
        blocksCreated: number;
    }>;
}

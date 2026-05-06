import type { AuthUserPayload } from "../../auth/auth.service";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { QuoteVersionsService } from "../versions/quote-versions.service";
import type { CreateMarginSnapshotDto } from "./dto/create-margin-snapshot.dto";
import type { ApplyLatestMarginSnapshotDto } from "./dto/apply-latest-margin-snapshot.dto";
export declare class MarginSnapshotsService {
    private readonly prisma;
    private readonly quoteVersionsService;
    constructor(prisma: PrismaService, quoteVersionsService: QuoteVersionsService);
    private mapSnapshotRow;
    createFromVersion(quoteId: string, versionId: string, dto: CreateMarginSnapshotDto, user: AuthUserPayload): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: string;
        systemType: string | null;
        mountStructureType: string | null;
        schemaVersion: string;
        sourceQuoteId: string | null;
        sourceQuoteVersionId: string | null;
    }>;
    findLatestForUser(userId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: string;
        systemType: string | null;
        mountStructureType: string | null;
        schemaVersion: string;
        sourceQuoteId: string | null;
        sourceQuoteVersionId: string | null;
    } | null>;
    listForUser(userId: string): Promise<{
        id: string;
        name: string;
        description: string | null;
        createdAt: string;
        systemType: string | null;
        mountStructureType: string | null;
        schemaVersion: string;
        sourceQuoteId: string | null;
        sourceQuoteVersionId: string | null;
    }[]>;
    applyLatestToVersion(quoteId: string, versionId: string, dto: ApplyLatestMarginSnapshotDto, user: AuthUserPayload): Promise<{
        applied: boolean;
        snapshotId: string;
        blocksApplied: number;
    }>;
}

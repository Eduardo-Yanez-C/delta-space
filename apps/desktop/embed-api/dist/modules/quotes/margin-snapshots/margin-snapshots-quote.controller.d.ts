import type { AuthUserPayload } from "../../auth/auth.service";
import { CreateMarginSnapshotDto } from "./dto/create-margin-snapshot.dto";
import { ApplyLatestMarginSnapshotDto } from "./dto/apply-latest-margin-snapshot.dto";
import { MarginSnapshotsService } from "./margin-snapshots.service";
export declare class MarginSnapshotsQuoteController {
    private readonly marginSnapshotsService;
    constructor(marginSnapshotsService: MarginSnapshotsService);
    create(quoteId: string, versionId: string, dto: CreateMarginSnapshotDto, user: AuthUserPayload): Promise<{
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
    applyLatest(quoteId: string, versionId: string, dto: ApplyLatestMarginSnapshotDto, user: AuthUserPayload): Promise<{
        applied: boolean;
        snapshotId: string;
        blocksApplied: number;
    }>;
}

import type { AuthUserPayload } from "../../auth/auth.service";
import { MarginSnapshotsService } from "./margin-snapshots.service";
export declare class MarginSnapshotsController {
    private readonly marginSnapshotsService;
    constructor(marginSnapshotsService: MarginSnapshotsService);
    getLatest(user: AuthUserPayload): Promise<{
        snapshot: {
            id: string;
            name: string;
            description: string | null;
            createdAt: string;
            systemType: string | null;
            mountStructureType: string | null;
            schemaVersion: string;
            sourceQuoteId: string | null;
            sourceQuoteVersionId: string | null;
        } | null;
    }>;
    list(user: AuthUserPayload): Promise<{
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
}

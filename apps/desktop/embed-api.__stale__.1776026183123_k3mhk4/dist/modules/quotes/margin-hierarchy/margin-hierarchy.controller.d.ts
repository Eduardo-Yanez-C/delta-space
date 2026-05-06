import type { AuthUserPayload } from "../../auth/auth.service";
import { ApplyCleanDto } from "./dto/apply-clean.dto";
import { MarginHierarchyService } from "./margin-hierarchy.service";
export declare class MarginHierarchyController {
    private readonly marginHierarchyService;
    constructor(marginHierarchyService: MarginHierarchyService);
    applyClean(quoteId: string, versionId: string, dto: ApplyCleanDto, user: AuthUserPayload): Promise<{
        applied: boolean;
        blocksCreated: number;
    }>;
}

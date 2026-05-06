import type { AuthUserPayload } from "../auth/auth.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { FvStudyService } from "../fv-study/fv-study.service";
import { UpsertImplantationDesignDto } from "./dto/upsert-implantation-design.dto";
export type ImplantationPlacementResponse = {
    id: string;
    implantationDesignId: string;
    positionIndex: number;
    originLat: number;
    originLng: number;
    orientationDeg: number | null;
    stringId: string | null;
    createdAt: string;
    updatedAt: string;
};
export type ImplantationDesignResponse = {
    id: string;
    fvStudyId: string;
    centerLat: number;
    centerLng: number;
    zoom: number;
    roofPolygonGeoJson: string | null;
    panelProductId: string | null;
    panelNameSnapshot: string | null;
    panelPowerWSnapshot: number | null;
    panelWidthMmSnapshot: number | null;
    panelLengthMmSnapshot: number | null;
    panelOrientationMode: string | null;
    spacingHorizontalMm: number | null;
    spacingVerticalMm: number | null;
    screenshotUrl: string | null;
    placements: ImplantationPlacementResponse[];
    createdAt: string;
    updatedAt: string;
};
export declare class ImplantationDesignService {
    private readonly prisma;
    private readonly fvStudyService;
    constructor(prisma: PrismaService, fvStudyService: FvStudyService);
    findByFvStudyId(fvStudyId: string, currentUser: AuthUserPayload | undefined): Promise<ImplantationDesignResponse | null>;
    upsert(fvStudyId: string, dto: UpsertImplantationDesignDto, currentUser: AuthUserPayload | undefined): Promise<ImplantationDesignResponse>;
    private validateUpsertDto;
    private validatePanelProductId;
    updateScreenshot(fvStudyId: string, file: {
        buffer: Buffer;
        mimetype: string;
    }, currentUser: AuthUserPayload | undefined): Promise<ImplantationDesignResponse>;
    deleteDesign(fvStudyId: string, currentUser: AuthUserPayload | undefined): Promise<void>;
    getScreenshotPath(fvStudyId: string, currentUser: AuthUserPayload | undefined): Promise<string | null>;
    private toResponse;
}

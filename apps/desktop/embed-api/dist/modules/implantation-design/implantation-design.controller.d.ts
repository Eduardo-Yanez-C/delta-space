import { Response } from "express";
import type { AuthUserPayload } from "../auth/auth.service";
import { ImplantationDesignService, type ImplantationDesignResponse } from "./implantation-design.service";
import { UpsertImplantationDesignDto } from "./dto/upsert-implantation-design.dto";
export declare class ImplantationDesignController {
    private readonly implantationDesignService;
    constructor(implantationDesignService: ImplantationDesignService);
    getDesign(fvStudyId: string, user: AuthUserPayload, res: Response): Promise<void>;
    deleteDesign(fvStudyId: string, user: AuthUserPayload): Promise<{
        deleted: true;
    }>;
    upsertDesign(fvStudyId: string, dto: UpsertImplantationDesignDto, user: AuthUserPayload): Promise<ImplantationDesignResponse>;
    uploadScreenshot(fvStudyId: string, file: {
        buffer: Buffer;
        mimetype: string;
    } | undefined, user: AuthUserPayload): Promise<ImplantationDesignResponse>;
    getScreenshot(fvStudyId: string, user: AuthUserPayload, res: Response): Promise<void>;
}

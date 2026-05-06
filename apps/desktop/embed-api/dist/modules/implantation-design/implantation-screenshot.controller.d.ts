import { Response } from "express";
import type { AuthUserPayload } from "../auth/auth.service";
import { ImplantationDesignService, type ImplantationDesignResponse } from "./implantation-design.service";
export declare class ImplantationScreenshotController {
    private readonly implantationDesignService;
    constructor(implantationDesignService: ImplantationDesignService);
    ping(): {
        ok: boolean;
    };
    upload(fvStudyId: string, file: {
        buffer: Buffer;
        mimetype: string;
    } | undefined, user: AuthUserPayload): Promise<ImplantationDesignResponse>;
    get(fvStudyId: string, user: AuthUserPayload, res: Response): Promise<void>;
}

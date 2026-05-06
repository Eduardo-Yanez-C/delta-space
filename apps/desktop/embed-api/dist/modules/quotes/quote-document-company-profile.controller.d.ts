import { Response } from "express";
import { CompanyProfileService } from "../company-profile/company-profile.service";
export declare class QuoteDocumentCompanyProfileController {
    private readonly companyProfileService;
    constructor(companyProfileService: CompanyProfileService);
    getForDocument(): Promise<import("../company-profile/company-profile.service").CompanyProfileResponse>;
    getLogo(res: Response): Promise<void>;
}

import { Response } from "express";
import { CompanyProfileService } from "./company-profile.service";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";
export declare class CompanyProfileController {
    private readonly companyProfileService;
    constructor(companyProfileService: CompanyProfileService);
    getProfile(): Promise<import("./company-profile.service").CompanyProfileResponse>;
    updateProfile(dto: UpdateCompanyProfileDto): Promise<import("./company-profile.service").CompanyProfileResponse>;
    uploadLogo(file: {
        buffer: Buffer;
        mimetype: string;
        size: number;
    } | undefined): Promise<import("./company-profile.service").CompanyProfileResponse>;
    deleteLogo(): Promise<import("./company-profile.service").CompanyProfileResponse>;
    getLogo(res: Response): Promise<void>;
}

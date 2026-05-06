import { PrismaService } from "../../infra/prisma/prisma.service";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";
export type CompanyProfileResponse = {
    id: string;
    hasLogo: boolean;
    logoMimeType: string | null;
    commercialName: string | null;
    legalName: string | null;
    taxId: string | null;
    businessActivity: string | null;
    address: string | null;
    commune: string | null;
    region: string | null;
    country: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    instagramUrl: string | null;
    facebookUrl: string | null;
    bankName: string | null;
    accountType: string | null;
    accountNumber: string | null;
    accountHolderName: string | null;
    accountHolderTaxId: string | null;
    transferReceiptEmail: string | null;
    generalNotes: string | null;
    quoteNote: string | null;
    paymentTerms: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};
export declare class CompanyProfileService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private uploadsBaseDir;
    private logoSubdirFullPath;
    private absolutePathFromRelative;
    private toResponse;
    private emptyResponse;
    findOne(): Promise<CompanyProfileResponse>;
    update(dto: UpdateCompanyProfileDto): Promise<CompanyProfileResponse>;
    uploadLogo(file: {
        buffer: Buffer;
        mimetype: string;
        size: number;
    }): Promise<CompanyProfileResponse>;
    deleteLogo(): Promise<CompanyProfileResponse>;
    getLogoFilePath(): Promise<{
        absolutePath: string;
        mime: string;
    }>;
}

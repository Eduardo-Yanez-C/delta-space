import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { RequestDesktopDeveloperLicenseDto } from "./dto/request-desktop-developer-license.dto";
export declare class DesktopDeveloperLicenseService {
    private readonly auth;
    private readonly config;
    private readonly logger;
    constructor(auth: AuthService, config: ConfigService);
    issueSignedRecord(dto: RequestDesktopDeveloperLicenseDto): Promise<{
        payload: Record<string, unknown>;
        sig: string;
    }>;
}

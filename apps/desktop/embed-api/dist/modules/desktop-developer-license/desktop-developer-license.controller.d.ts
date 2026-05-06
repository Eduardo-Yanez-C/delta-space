import { DesktopDeveloperLicenseService } from "./desktop-developer-license.service";
import { RequestDesktopDeveloperLicenseDto } from "./dto/request-desktop-developer-license.dto";
export declare class DesktopDeveloperLicenseController {
    private readonly service;
    constructor(service: DesktopDeveloperLicenseService);
    issue(dto: RequestDesktopDeveloperLicenseDto): Promise<{
        payload: Record<string, unknown>;
        sig: string;
    }>;
}

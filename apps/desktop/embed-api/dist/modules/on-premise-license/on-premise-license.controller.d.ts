import { UploadLicenseDto } from "./dto/upload-license.dto";
import { OnPremiseLicenseService } from "./on-premise-license.service";
import type { OnPremiseLicenseStatusDto } from "./on-premise-license.types";
export declare class OnPremiseLicenseController {
    private readonly license;
    constructor(license: OnPremiseLicenseService);
    status(): OnPremiseLicenseStatusDto;
    upload(dto: UploadLicenseDto): {
        ok: true;
    };
}

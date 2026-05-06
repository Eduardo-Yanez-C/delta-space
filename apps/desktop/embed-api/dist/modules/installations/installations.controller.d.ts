import { ActivateInstallationDto } from "./dto/activate-installation.dto";
import { RevokeInstallationDto } from "./dto/revoke-installation.dto";
import { ValidateInstallationDto } from "./dto/validate-installation.dto";
import { InstallationsService } from "./installations.service";
export declare class InstallationsController {
    private readonly installationsService;
    constructor(installationsService: InstallationsService);
    activate(dto: ActivateInstallationDto): Promise<import("./installations.service").ActivateResult>;
    validate(dto: ValidateInstallationDto): Promise<{
        valid: boolean;
        active: boolean;
        revoked: boolean;
        message?: string;
    }>;
    findAll(): Promise<import("./installations.service").InstallationListItem[]>;
    revoke(id: string, dto: RevokeInstallationDto): Promise<import("./installations.service").InstallationListItem>;
}

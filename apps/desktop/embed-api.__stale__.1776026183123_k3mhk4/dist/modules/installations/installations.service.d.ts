import { PrismaService } from "../../infra/prisma/prisma.service";
import { ActivateInstallationDto } from "./dto/activate-installation.dto";
export type InstallationListItem = {
    id: string;
    activationCode: string;
    deviceName: string | null;
    machineFingerprint: string | null;
    active: boolean;
    revokedAt: string | null;
    createdAt: string;
    appVersion: string | null;
    notes: string | null;
};
export type ActivateResult = {
    installationId: string;
    installationToken: string;
    deviceName: string | null;
    createdAt: string;
};
export declare class InstallationsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    activate(dto: ActivateInstallationDto): Promise<ActivateResult>;
    validate(installationId: string, installationToken: string): Promise<{
        valid: boolean;
        active: boolean;
        revoked: boolean;
        message?: string;
    }>;
    findAll(): Promise<InstallationListItem[]>;
    revoke(id: string, note?: string): Promise<InstallationListItem>;
}

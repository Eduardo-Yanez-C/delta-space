import { ConfigService } from "@nestjs/config";
import { OnPremiseLicenseStatusDto } from "./on-premise-license.types";
type LicensePayload = {
    installationId?: string;
    empresa?: string;
    modalidad?: string;
    exp?: number;
    iat?: number;
};
export declare class OnPremiseLicenseService {
    private readonly config;
    private readonly logger;
    private readonly cacheTtlMs;
    private statusCache;
    constructor(config: ConfigService);
    isLicenseEnforcementEnabled(): boolean;
    private invalidateStatusCache;
    getDataDir(): string;
    private installationPath;
    private licensePath;
    ensureInstallationId(): string;
    getPublicKeyPem(): string | null;
    readLicenseRaw(): string | null;
    private decodePayloadUnverified;
    verifyAndDecode(token: string): {
        ok: true;
        payload: LicensePayload;
    } | {
        ok: false;
        error: "INVALID_SIGNATURE" | "MALFORMED" | "EXPIRED";
    };
    private verifyIgnoreExpiration;
    getStatus(): OnPremiseLicenseStatusDto;
    private computeStatus;
    isLicenseOk(): boolean;
    saveLicenseToken(token: string): {
        ok: true;
    } | {
        ok: false;
        message: string;
    };
}
export {};

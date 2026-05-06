export type OnPremiseLicenseState = "OK" | "MISSING" | "INVALID" | "EXPIRED" | "INSTALLATION_MISMATCH" | "PUBLIC_KEY_NOT_CONFIGURED" | "DISABLED";
export type OnPremiseLicenseStatusDto = {
    installationId: string;
    state: OnPremiseLicenseState;
    expiresAt: string | null;
    empresa: string | null;
    modalidad: string | null;
    message: string;
};

export declare class DesktopLicenseDebugController {
    diag(): {
        role: string;
        cwd: string;
        dotEnvPath: string;
        dotEnvExists: boolean;
        envEmbeddedPath: string;
        envEmbeddedExists: boolean;
        secretLength: number;
        fingerprintSha256Prefix16: string;
        secretFromDotenv: boolean;
        isPlaceholderDefault: boolean;
    };
}

import { CanActivate, ExecutionContext } from "@nestjs/common";
import { OnPremiseLicenseService } from "./on-premise-license.service";
export declare class OnPremiseLicenseGuard implements CanActivate {
    private readonly license;
    constructor(license: OnPremiseLicenseService);
    canActivate(context: ExecutionContext): boolean;
    private normalizePath;
    private isAllowlisted;
}

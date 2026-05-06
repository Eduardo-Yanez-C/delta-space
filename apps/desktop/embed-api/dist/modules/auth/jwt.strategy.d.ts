import { Strategy } from "passport-jwt";
import type { AuthUserPayload } from "./auth.service";
import { AuthService } from "./auth.service";
export type JwtPayload = {
    sub: string;
};
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private readonly authService;
    constructor(authService: AuthService);
    validate(payload: JwtPayload): Promise<AuthUserPayload>;
}
export {};

import { AuthService, type AuthUserPayload } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(dto: LoginDto): Promise<{
        accessToken: string;
        user: AuthUserPayload;
    }>;
    me(user: AuthUserPayload): AuthUserPayload;
}

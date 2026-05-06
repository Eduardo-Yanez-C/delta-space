import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../../infra/prisma/prisma.service";
export type AuthUserPayload = {
    id: string;
    email: string;
    name: string | null;
    fullName: string | null;
    active: boolean;
    roles: string[];
};
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    login(email: string, password: string): Promise<{
        accessToken: string;
        user: AuthUserPayload;
    }>;
    validateUserById(userId: string): Promise<AuthUserPayload | null>;
}

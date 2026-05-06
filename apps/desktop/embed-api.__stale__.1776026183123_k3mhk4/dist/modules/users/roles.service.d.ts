import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
export declare class RolesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(): Promise<{
        id: number;
        name: string;
        description: string | null;
    }[]>;
    findAllForActor(actor: AuthUserPayload): Promise<{
        id: number;
        name: string;
        description: string | null;
    }[]>;
}

import type { AuthUserPayload } from "../auth/auth.service";
import { RolesService } from "./roles.service";
export declare class RolesController {
    private readonly rolesService;
    constructor(rolesService: RolesService);
    findAll(actor: AuthUserPayload): Promise<{
        id: number;
        name: string;
        description: string | null;
    }[]>;
}

import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
export type UserResponse = {
    id: string;
    email: string;
    name: string | null;
    fullName: string | null;
    active: boolean;
    roles: {
        id: number;
        name: string;
        description: string | null;
    }[];
    createdAt: Date;
    updatedAt: Date;
};
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findAll(activeOnly?: boolean): Promise<UserResponse[]>;
    findOne(id: string): Promise<UserResponse>;
    private getRoleNamesByIds;
    private assertRoleAssignmentAllowed;
    private assertCanMutateUserRecord;
    private validateRoleIds;
    create(dto: CreateUserDto, actor: AuthUserPayload): Promise<UserResponse>;
    update(id: string, dto: UpdateUserDto, actor: AuthUserPayload): Promise<UserResponse>;
    activate(id: string, actor: AuthUserPayload): Promise<UserResponse>;
    deactivate(id: string, actor: AuthUserPayload): Promise<UserResponse>;
}

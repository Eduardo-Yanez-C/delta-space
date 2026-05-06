import { Request } from "express";
import type { AuthUserPayload } from "../auth/auth.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UsersService } from "./users.service";
export declare class UsersController {
    private readonly usersService;
    constructor(usersService: UsersService);
    findAll(activeOnly?: string): Promise<import("./users.service").UserResponse[]>;
    findOne(id: string): Promise<import("./users.service").UserResponse>;
    create(dto: CreateUserDto, actor: AuthUserPayload): Promise<import("./users.service").UserResponse>;
    update(id: string, dto: UpdateUserDto, req: Request, actor: AuthUserPayload): Promise<import("./users.service").UserResponse>;
    activate(id: string, actor: AuthUserPayload): Promise<import("./users.service").UserResponse>;
    deactivate(id: string, actor: AuthUserPayload): Promise<import("./users.service").UserResponse>;
}

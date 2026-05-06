import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";
import {
  canManageElevatedUsers,
  ELEVATED_USER_MANAGEMENT_ROLES,
} from "../auth/role-constants";

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { name: "asc" },
    });
  }

  async findAllForActor(actor: AuthUserPayload) {
    const all = await this.findAll();
    if (canManageElevatedUsers(actor.roles)) {
      return all;
    }
    return all.filter((r) => !ELEVATED_USER_MANAGEMENT_ROLES.has(r.name));
  }
}

import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { AuthUserPayload } from "../auth/auth.service";

type AuditWriteInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  entityCompanyId?: string | null;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
};

function safeJson(value: unknown): string | null {
  if (value === undefined) return null;
  if (value === null) return "null";
  try {
    return JSON.stringify(value);
  } catch {
    try {
      return JSON.stringify({ __nonSerializable: true });
    } catch {
      return null;
    }
  }
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(actor: AuthUserPayload, input: AuditWriteInput) {
    return this.prisma.auditLog.create({
      data: {
        companyId: actor.companyId,
        userId: actor.id,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityCompanyId: input.entityCompanyId ?? null,
        beforeJson: safeJson(input.before),
        afterJson: safeJson(input.after),
        metaJson: safeJson(input.meta),
      },
    });
  }

  async findRecent(params: {
    take?: number;
    companyId?: string;
    userId?: string;
    entityType?: string;
    entityId?: string;
  }) {
    const take = Math.min(Math.max(Number(params.take ?? 200) || 200, 1), 500);
    return this.prisma.auditLog.findMany({
      take,
      orderBy: { createdAt: "desc" },
      where: {
        companyId: params.companyId,
        userId: params.userId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      include: {
        user: { select: { id: true, email: true, name: true, fullName: true } },
        company: { select: { id: true, name: true, slug: true } },
      },
    });
  }
}


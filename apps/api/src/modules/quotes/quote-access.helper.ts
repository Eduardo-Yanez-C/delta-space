import { NotFoundException } from "@nestjs/common";
import { hasGlobalAdminPrivileges } from "../auth/role-constants";
import { PrismaService } from "../../infra/prisma/prisma.service";

export function canAccessQuote(
  user: { id: string; roles: string[]; companyId: string },
  quote: { quoteKind: string; ownerId: string; salespersonId: string | null; companyId: string },
) {
  if (hasGlobalAdminPrivileges(user.roles)) return true;
  if (quote.companyId !== user.companyId) return false;
  if (quote.quoteKind === "MARGIN") {
    return quote.ownerId === user.id || (quote.salespersonId != null && quote.salespersonId === user.id);
  }
  return quote.ownerId === user.id;
}

export function quoteVisibilityWhereForUser(userId: string, companyId: string) {
  return {
    companyId,
    OR: [
      { ownerId: userId, NOT: { quoteKind: "MARGIN" } },
      { quoteKind: "MARGIN", ownerId: userId },
      { quoteKind: "MARGIN", salespersonId: userId },
    ],
  };
}

export async function assertUserCanAccessQuote(
  prisma: PrismaService,
  quoteId: string,
  user: { id: string; roles: string[]; companyId: string },
) {
  const row = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { quoteKind: true, ownerId: true, salespersonId: true, companyId: true },
  });
  if (!row || !canAccessQuote(user, row)) {
    throw new NotFoundException("Cotización no encontrada");
  }
}

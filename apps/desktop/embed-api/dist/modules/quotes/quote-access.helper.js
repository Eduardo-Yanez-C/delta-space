"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAccessQuote = canAccessQuote;
exports.quoteVisibilityWhereForUser = quoteVisibilityWhereForUser;
exports.assertUserCanAccessQuote = assertUserCanAccessQuote;
const common_1 = require("@nestjs/common");
const role_constants_1 = require("../auth/role-constants");
function canAccessQuote(user, quote) {
    if ((0, role_constants_1.hasGlobalAdminPrivileges)(user.roles))
        return true;
    if (quote.quoteKind === "MARGIN") {
        return quote.ownerId === user.id || (quote.salespersonId != null && quote.salespersonId === user.id);
    }
    return quote.ownerId === user.id;
}
function quoteVisibilityWhereForUser(userId) {
    return {
        OR: [
            { ownerId: userId, NOT: { quoteKind: "MARGIN" } },
            { quoteKind: "MARGIN", ownerId: userId },
            { quoteKind: "MARGIN", salespersonId: userId },
        ],
    };
}
async function assertUserCanAccessQuote(prisma, quoteId, user) {
    const row = await prisma.quote.findUnique({
        where: { id: quoteId },
        select: { quoteKind: true, ownerId: true, salespersonId: true },
    });
    if (!row || !canAccessQuote(user, row)) {
        throw new common_1.NotFoundException("Cotización no encontrada");
    }
}

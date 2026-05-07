import { Injectable } from "@nestjs/common";
import { hasGlobalAdminPrivileges } from "../auth/role-constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { quoteVisibilityWhereForUser } from "../quotes/quote-access.helper";

function toNum(d: unknown): number {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d && typeof (d as { toNumber: () => number }).toNumber === "function")
        return (d as { toNumber: () => number }).toNumber();
    return Number(d);
}

function startOfCurrentMonthUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

const MONTH_LABELS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const STUDY_STATUS_ORDER = [
    { status: "DRAFT", label: "Borrador" },
    { status: "VALIDADO", label: "Validado" },
    { status: "COTIZADO", label: "Cotizado" },
    { status: "ARCHIVADO", label: "Archivado" },
] as const;

type CurrentUserLike = { id: string; companyId: string; roles?: string[] };

@Injectable()
export class DashboardService {
    constructor(private readonly prisma: PrismaService) {}

    async getDashboard(currentUser: CurrentUserLike) {
        const roles = currentUser?.roles ?? [];
        const isAdmin = hasGlobalAdminPrivileges(roles);
        const quoteWhere = isAdmin ? {} : quoteVisibilityWhereForUser(currentUser.id, currentUser.companyId);
        const studyWhere: { ownerId?: string } = {};
        if (!isAdmin)
            studyWhere.ownerId = currentUser.id;

        const startOfMonth = startOfCurrentMonthUtc();
        const [
            quotesTotal,
            quotesThisMonth,
            quotesWithVersions,
            studiesTotal,
            studiesConverted,
            latestQuotes,
            latestStudies,
            studiesWithoutQuote,
        ] = await Promise.all([
            this.prisma.quote.count({ where: quoteWhere }),
            this.prisma.quote.count({
                where: { ...quoteWhere, createdAt: { gte: startOfMonth } },
            }),
            this.prisma.quote.findMany({
                where: quoteWhere,
                select: {
                    id: true,
                    versions: {
                        orderBy: { versionNumber: "desc" },
                        take: 1,
                        select: { total: true },
                    },
                },
            }),
            this.prisma.fvStudy.count({ where: studyWhere }),
            this.prisma.fvStudy.count({
                where: { ...studyWhere, quotesSource: { some: {} } },
            }),
            this.prisma.quote.findMany({
                where: quoteWhere,
                orderBy: { updatedAt: "desc" },
                take: 10,
                include: {
                    client: { select: { name: true } },
                    versions: { orderBy: { versionNumber: "desc" }, take: 1 },
                },
            }),
            this.prisma.fvStudy.findMany({
                where: studyWhere,
                orderBy: { updatedAt: "desc" },
                take: 10,
                include: { client: { select: { name: true } } },
            }),
            this.prisma.fvStudy.findMany({
                where: {
                    ...studyWhere,
                    status: { not: "ARCHIVADO" },
                    quotesSource: { none: {} },
                },
                orderBy: { updatedAt: "desc" },
                take: 20,
                include: { client: { select: { name: true } } },
            }),
        ]);

        let totalQuotedAmount = 0;
        let quotesWithPositiveTotal = 0;
        for (const q of quotesWithVersions) {
            const latestTotal = q.versions[0] ? toNum(q.versions[0].total) : 0;
            totalQuotedAmount += latestTotal;
            if (latestTotal > 0)
                quotesWithPositiveTotal += 1;
        }
        const averageTicket = quotesWithPositiveTotal > 0 ? totalQuotedAmount / quotesWithPositiveTotal : 0;
        const conversionPercent = studiesTotal > 0 ? Math.round((studiesConverted / studiesTotal) * 10000) / 100 : 0;
        const kpis = {
            quotesTotal,
            quotesThisMonth,
            totalQuotedAmount: Math.round(totalQuotedAmount * 100) / 100,
            averageTicket: Math.round(averageTicket * 100) / 100,
            studiesTotal,
            studiesConverted,
            conversionPercent,
        };

        const toQuoteRow = (q: (typeof latestQuotes)[0]) => ({
            id: q.id,
            title: q.title,
            status: q.status,
            clientName: q.client?.name ?? "—",
            total: q.versions[0] ? toNum(q.versions[0].total) : 0,
            updatedAt: q.updatedAt.toISOString(),
        });
        const toStudyRow = (s: (typeof latestStudies)[0]) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            clientName: s.client?.name ?? "—",
            updatedAt: s.updatedAt.toISOString(),
        });

        const now = new Date();
        const quotesByMonth: { month: string; label: string; count: number }[] = [];
        const studiesByMonth: { month: string; label: string; count: number }[] = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 0, 0, 0, 0));
            const start = d;
            const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
            const [quoteCount, studyCount] = await Promise.all([
                this.prisma.quote.count({
                    where: {
                        ...quoteWhere,
                        createdAt: { gte: start, lt: end },
                    },
                }),
                this.prisma.fvStudy.count({
                    where: {
                        ...studyWhere,
                        createdAt: { gte: start, lt: end },
                    },
                }),
            ]);
            const monthStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            const label = `${MONTH_LABELS_ES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
            quotesByMonth.push({ month: monthStr, label, count: quoteCount });
            studiesByMonth.push({ month: monthStr, label, count: studyCount });
        }

        const [countVacía, countDesdeEstudio, countDesdePlantilla] = await Promise.all([
            this.prisma.quote.count({
                where: { ...quoteWhere, sourceFvStudyId: null, sourceQuoteTemplateId: null },
            }),
            this.prisma.quote.count({
                where: { ...quoteWhere, sourceFvStudyId: { not: null } },
            }),
            this.prisma.quote.count({
                where: { ...quoteWhere, sourceQuoteTemplateId: { not: null }, sourceFvStudyId: null },
            }),
        ]);
        const quotesByOrigin = [
            { origin: "vacía", label: "Vacía", count: countVacía },
            { origin: "estudio", label: "Desde estudio", count: countDesdeEstudio },
            { origin: "plantilla", label: "Desde plantilla", count: countDesdePlantilla },
        ];

        const studiesByStatusGroups = await this.prisma.fvStudy.groupBy({
            by: ["status"],
            where: studyWhere,
            _count: { status: true },
        });
        const countByStatus = new Map(studiesByStatusGroups.map((g) => [g.status, g._count.status]));
        const studiesByStatus = STUDY_STATUS_ORDER.map(({ status, label }) => ({
            status,
            label,
            count: countByStatus.get(status) ?? 0,
        }));

        return {
            kpis,
            latestQuotes: latestQuotes.map(toQuoteRow),
            latestStudies: latestStudies.map(toStudyRow),
            studiesWithoutQuote: studiesWithoutQuote.map(toStudyRow),
            charts: {
                quotesByMonth,
                studiesByMonth,
                quotesByOrigin,
                studiesByStatus,
            },
        };
    }
}

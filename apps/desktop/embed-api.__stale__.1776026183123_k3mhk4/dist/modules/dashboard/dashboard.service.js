"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const role_constants_1 = require("../auth/role-constants");
const prisma_service_1 = require("../../infra/prisma/prisma.service");
const quote_access_helper_1 = require("../quotes/quote-access.helper");
function toNum(d) {
    if (d == null)
        return 0;
    if (typeof d === "number" && !Number.isNaN(d))
        return d;
    if (typeof d === "object" && d !== null && "toNumber" in d && typeof d.toNumber === "function")
        return d.toNumber();
    return Number(d);
}
function startOfCurrentMonthUtc() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}
const MONTH_LABELS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const STUDY_STATUS_ORDER = [
    { status: "DRAFT", label: "Borrador" },
    { status: "VALIDADO", label: "Validado" },
    { status: "COTIZADO", label: "Cotizado" },
    { status: "ARCHIVADO", label: "Archivado" },
];
let DashboardService = class DashboardService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getDashboard(currentUser) {
        const roles = currentUser?.roles ?? [];
        const isAdmin = (0, role_constants_1.hasGlobalAdminPrivileges)(roles);
        const quoteWhere = isAdmin ? {} : (0, quote_access_helper_1.quoteVisibilityWhereForUser)(currentUser.id);
        const studyWhere = {};
        if (!isAdmin)
            studyWhere.ownerId = currentUser.id;
        const startOfMonth = startOfCurrentMonthUtc();
        const [quotesTotal, quotesThisMonth, quotesWithVersions, studiesTotal, studiesConverted, latestQuotes, latestStudies, studiesWithoutQuote,] = await Promise.all([
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
        const toQuoteRow = (q) => ({
            id: q.id,
            title: q.title,
            status: q.status,
            clientName: q.client?.name ?? "—",
            total: q.versions[0] ? toNum(q.versions[0].total) : 0,
            updatedAt: q.updatedAt.toISOString(),
        });
        const toStudyRow = (s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            clientName: s.client?.name ?? "—",
            updatedAt: s.updatedAt.toISOString(),
        });
        const now = new Date();
        const quotesByMonth = [];
        const studiesByMonth = [];
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
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DashboardService);

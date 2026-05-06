import type { AuthUserPayload } from "../auth/auth.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
export type DashboardKpis = {
    quotesTotal: number;
    quotesThisMonth: number;
    totalQuotedAmount: number;
    averageTicket: number;
    studiesTotal: number;
    studiesConverted: number;
    conversionPercent: number;
};
export type DashboardQuoteRow = {
    id: string;
    title: string;
    status: string;
    clientName: string;
    total: number;
    updatedAt: string;
};
export type DashboardStudyRow = {
    id: string;
    title: string;
    status: string;
    clientName: string;
    updatedAt: string;
};
export type DashboardChartQuotesByMonthItem = {
    month: string;
    label: string;
    count: number;
};
export type DashboardChartQuotesByOriginItem = {
    origin: string;
    label: string;
    count: number;
};
export type DashboardChartStudiesByStatusItem = {
    status: string;
    label: string;
    count: number;
};
export type DashboardCharts = {
    quotesByMonth: DashboardChartQuotesByMonthItem[];
    quotesByOrigin: DashboardChartQuotesByOriginItem[];
    studiesByStatus: DashboardChartStudiesByStatusItem[];
};
export type DashboardData = {
    kpis: DashboardKpis;
    latestQuotes: DashboardQuoteRow[];
    latestStudies: DashboardStudyRow[];
    studiesWithoutQuote: DashboardStudyRow[];
    charts: DashboardCharts;
};
export declare class DashboardService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getDashboard(currentUser: AuthUserPayload): Promise<DashboardData>;
}

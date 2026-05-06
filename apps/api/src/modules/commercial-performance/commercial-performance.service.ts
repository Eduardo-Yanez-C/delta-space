import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { CommercialPerformanceQueryDto } from "./dto/commercial-performance-query.dto";

function toNum(d: unknown): number {
    if (d == null) return 0;
    if (typeof d === "number" && !Number.isNaN(d)) return d;
    if (typeof d === "object" && d !== null && "toNumber" in d && typeof (d as { toNumber: () => number }).toNumber === "function")
        return (d as { toNumber: () => number }).toNumber();
    return Number(d);
}

/** Usuario al que se atribuye una cotización para KPIs y ranking (V1). */
export function attributedQuoteUserId(quote: { quoteKind: string; ownerId: string; salespersonId: string | null }): string {
    if (quote.quoteKind === "MARGIN" && quote.salespersonId) return quote.salespersonId;
    return quote.ownerId;
}

const MONTH_LABELS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function parseInclusiveUtcRange(fromStr: string, toStr: string): { from: Date; to: Date } {
    const from = new Date(fromStr);
    const to = new Date(toStr);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        throw new BadRequestException("Rango de fechas inválido.");
    }
    const toEnd = new Date(to);
    toEnd.setUTCHours(23, 59, 59, 999);
    if (from > toEnd) throw new BadRequestException("'from' debe ser anterior o igual a 'to'.");
    return { from, to: toEnd };
}

function* monthsInRange(from: Date, to: Date): Generator<{ month: string; label: string; start: Date; end: Date }> {
    let y = from.getUTCFullYear();
    let m = from.getUTCMonth();
    const endY = to.getUTCFullYear();
    const endM = to.getUTCMonth();
    while (y < endY || (y === endY && m <= endM)) {
        const month = `${y}-${String(m + 1).padStart(2, "0")}`;
        const label = `${MONTH_LABELS_ES[m]} ${y}`;
        const start = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
        const end = new Date(Date.UTC(y, m + 1, 1, 0, 0, 0, 0));
        yield { month, label, start, end };
        m += 1;
        if (m > 11) {
            m = 0;
            y += 1;
        }
    }
}

function displayName(u: { fullName: string | null; name: string | null; email: string }): string {
    return (u.fullName?.trim() || u.name?.trim() || u.email) ?? u.email;
}

type QuoteRow = {
    id: string;
    ownerId: string;
    salespersonId: string | null;
    quoteKind: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    versions: { total: unknown }[];
};

type StudyRow = {
    id: string;
    ownerId: string | null;
    createdAt: Date;
    updatedAt: Date;
    quotesSource: { id: string }[];
};

@Injectable()
export class CommercialPerformanceService {
    constructor(private readonly prisma: PrismaService) {}

    async getPanel(dto: CommercialPerformanceQueryDto) {
        const { from, to } = parseInclusiveUtcRange(dto.from, dto.to);
        const filterUserIds = dto.userIds?.length ? new Set(dto.userIds) : null;

        const [quotes, studies] = await Promise.all([
            this.prisma.quote.findMany({
                where: { createdAt: { gte: from, lte: to } },
                select: {
                    id: true,
                    ownerId: true,
                    salespersonId: true,
                    quoteKind: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                    versions: { orderBy: { versionNumber: "desc" }, take: 1, select: { total: true } },
                },
            }) as Promise<QuoteRow[]>,
            this.prisma.fvStudy.findMany({
                where: { createdAt: { gte: from, lte: to } },
                select: {
                    id: true,
                    ownerId: true,
                    createdAt: true,
                    updatedAt: true,
                    quotesSource: { select: { id: true }, take: 1 },
                },
            }) as Promise<StudyRow[]>,
        ]);

        const quotesFiltered = filterUserIds
            ? quotes.filter((q) => filterUserIds.has(attributedQuoteUserId(q)))
            : quotes;
        const studiesFiltered = filterUserIds
            ? studies.filter((s) => s.ownerId != null && filterUserIds.has(s.ownerId))
            : studies;

        type Agg = {
            quotesCreated: number;
            fvStudiesCreated: number;
            fvStudiesConverted: number;
            totalQuotedAmount: number;
            quotesWithPositiveTotal: number;
            quotesByStatus: Record<string, number>;
            lastActivityAt: Date | null;
        };

        const byUser = new Map<string, Agg>();

        const ensure = (uid: string): Agg => {
            let a = byUser.get(uid);
            if (!a) {
                a = {
                    quotesCreated: 0,
                    fvStudiesCreated: 0,
                    fvStudiesConverted: 0,
                    totalQuotedAmount: 0,
                    quotesWithPositiveTotal: 0,
                    quotesByStatus: {},
                    lastActivityAt: null,
                };
                byUser.set(uid, a);
            }
            return a;
        };

        const bump = (uid: string, d: Date) => {
            const a = ensure(uid);
            if (!a.lastActivityAt || d > a.lastActivityAt) a.lastActivityAt = d;
        };

        const quotesByStatusGlobal: Record<string, number> = {};
        const quotesByMonth: { month: string; label: string; count: number }[] = [];

        for (const q of quotesFiltered) {
            const uid = attributedQuoteUserId(q);
            const a = ensure(uid);
            a.quotesCreated += 1;
            const t = q.versions[0] ? toNum(q.versions[0].total) : 0;
            a.totalQuotedAmount += t;
            if (t > 0) a.quotesWithPositiveTotal += 1;
            const st = q.status || "—";
            a.quotesByStatus[st] = (a.quotesByStatus[st] ?? 0) + 1;
            quotesByStatusGlobal[st] = (quotesByStatusGlobal[st] ?? 0) + 1;
            bump(uid, q.updatedAt > q.createdAt ? q.updatedAt : q.createdAt);
        }

        let studiesCreated = 0;
        let studiesConverted = 0;
        for (const s of studiesFiltered) {
            studiesCreated += 1;
            const converted = s.quotesSource.length > 0;
            if (converted) studiesConverted += 1;
            if (s.ownerId) {
                const a = ensure(s.ownerId);
                a.fvStudiesCreated += 1;
                if (converted) a.fvStudiesConverted += 1;
                bump(s.ownerId, s.updatedAt > s.createdAt ? s.updatedAt : s.createdAt);
            }
        }

        for (const { month, label, start, end } of monthsInRange(from, to)) {
            const monthEndInclusive = new Date(end.getTime() - 1);
            const lo = start < from ? from : start;
            const hi = monthEndInclusive > to ? to : monthEndInclusive;
            const count =
                lo > hi ? 0 : quotesFiltered.filter((q) => q.createdAt >= lo && q.createdAt <= hi).length;
            quotesByMonth.push({ month, label, count });
        }

        const totalQuotedAmountAll = quotesFiltered.reduce((s, q) => {
            const t = q.versions[0] ? toNum(q.versions[0].total) : 0;
            return s + t;
        }, 0);
        const quotesWithPositiveAll = quotesFiltered.filter((q) => (q.versions[0] ? toNum(q.versions[0].total) : 0) > 0).length;
        const averageTicketAll =
            quotesWithPositiveAll > 0 ? Math.round((totalQuotedAmountAll / quotesWithPositiveAll) * 100) / 100 : 0;
        const conversionPercent =
            studiesCreated > 0 ? Math.round((studiesConverted / studiesCreated) * 10000) / 100 : 0;

        const sellerIds = [...byUser.keys()];
        const users = await this.prisma.user.findMany({
            where: { id: { in: sellerIds } },
            select: { id: true, email: true, name: true, fullName: true, active: true },
        });
        const userById = new Map(users.map((u) => [u.id, u]));

        const sellers = sellerIds
            .map((userId) => {
                const a = byUser.get(userId)!;
                const u = userById.get(userId);
                const avg =
                    a.quotesWithPositiveTotal > 0
                        ? Math.round((a.totalQuotedAmount / a.quotesWithPositiveTotal) * 100) / 100
                        : 0;
                const statusBreakdown = Object.entries(a.quotesByStatus)
                    .map(([status, count]) => ({ status, count }))
                    .sort((x, y) => y.count - x.count);
                return {
                    userId,
                    email: u?.email ?? userId,
                    name: u ? displayName(u) : userId,
                    active: u?.active ?? true,
                    quotesCreated: a.quotesCreated,
                    fvStudiesCreated: a.fvStudiesCreated,
                    fvStudiesConverted: a.fvStudiesConverted,
                    totalQuotedAmount: Math.round(a.totalQuotedAmount * 100) / 100,
                    averageTicket: avg,
                    quotesByStatus: statusBreakdown,
                    lastActivityAt: a.lastActivityAt ? a.lastActivityAt.toISOString() : null,
                };
            })
            .sort((a, b) => b.totalQuotedAmount - a.totalQuotedAmount);

        const amountsBySeller = sellers.map((s) => ({
            userId: s.userId,
            name: s.name,
            amount: s.totalQuotedAmount,
        }));

        const quotesByStatusChart = Object.entries(quotesByStatusGlobal)
            .map(([status, count]) => ({ status, count }))
            .sort((x, y) => y.count - x.count);

        return {
            attribution: {
                summary:
                    "Cada registro se cuenta una sola vez. Las cifras por persona siguen reglas comerciales fijas para que el ranking y los montos sean comparables.",
                rules: [
                    "Cotizaciones estándar y cotizaciones especiales sin “vendedor asignado” se atribuyen al responsable principal de esa cotización en el sistema.",
                    "Si una cotización especial tiene vendedor asignado, las cifras de esa cotización (cantidad y montos) se imputan a ese vendedor, no al responsable principal.",
                    "Los estudios fotovoltaicos se atribuyen al responsable del estudio. Si un estudio no tiene responsable, cuenta en los totales generales del período pero no aparece en una fila de vendedor.",
                    "El período filtra por fecha de creación: solo entran cotizaciones y estudios creados entre las fechas que eligió (el día final incluye todo ese día).",
                    "Los montos usan el total de la versión más reciente de cada cotización al momento de generar este informe.",
                ],
            },
            v2Note:
                "En una futura versión con auditoría se podrán medir con precisión las ediciones, el historial de estados y la fecha exacta en que un estudio pasó a cotización. Esta versión no lleva ese registro detallado.",
            period: { from: from.toISOString(), to: to.toISOString() },
            kpis: {
                quotesCreated: quotesFiltered.length,
                fvStudiesCreated: studiesCreated,
                fvStudiesConverted: studiesConverted,
                totalQuotedAmount: Math.round(totalQuotedAmountAll * 100) / 100,
                averageTicket: averageTicketAll,
                conversionPercent,
            },
            sellers,
            charts: {
                quotesByMonth,
                amountsBySeller,
                quotesByStatus: quotesByStatusChart,
                conversion: {
                    converted: studiesConverted,
                    notConverted: Math.max(0, studiesCreated - studiesConverted),
                },
            },
        };
    }
}

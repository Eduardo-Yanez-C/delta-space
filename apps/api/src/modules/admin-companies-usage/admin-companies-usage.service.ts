import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/prisma/prisma.service";

function parseYmdOrThrow(raw: unknown, label: string): Date {
  const s = String(raw ?? "").trim();
  if (!s) throw new BadRequestException(`${label} es obligatorio (YYYY-MM-DD)`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new BadRequestException(`${label} inválido (YYYY-MM-DD)`);
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new BadRequestException(`${label} inválido`);
  return d;
}

function endOfDayUtc(d: Date): Date {
  return new Date(d.getTime() + 24 * 60 * 60 * 1000);
}

@Injectable()
export class AdminCompaniesUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async getUsage(params: { from: string; to: string }) {
    const from = parseYmdOrThrow(params.from, "from");
    const to = parseYmdOrThrow(params.to, "to");
    const toExclusive = endOfDayUtc(to);
    if (toExclusive.getTime() <= from.getTime()) throw new BadRequestException("Rango inválido");

    const companies = await this.prisma.company.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true, createdAt: true },
    });

    const [usersByCompany, quotesByCompany, studiesByCompany, lastLoginByCompany] = await Promise.all([
      this.prisma.user.groupBy({
        by: ["companyId"],
        _count: { _all: true },
      }),
      this.prisma.quote.groupBy({
        by: ["companyId"],
        where: { createdAt: { gte: from, lt: toExclusive } },
        _count: { _all: true },
      }),
      this.prisma.fvStudy.groupBy({
        by: ["companyId"],
        where: { createdAt: { gte: from, lt: toExclusive } },
        _count: { _all: true },
      }),
      this.prisma.user.groupBy({
        by: ["companyId"],
        _max: { lastLoginAt: true },
      }),
    ]);

    const mapCount = (rows: { companyId: string; _count: { _all: number } }[]) =>
      new Map(rows.map((r) => [r.companyId, r._count._all]));
    const mapMaxDate = (rows: { companyId: string; _max: { lastLoginAt: Date | null } }[]) =>
      new Map(rows.map((r) => [r.companyId, r._max.lastLoginAt]));

    const userCounts = mapCount(usersByCompany);
    const quoteCounts = mapCount(quotesByCompany);
    const studyCounts = mapCount(studiesByCompany);
    const lastLogin = mapMaxDate(lastLoginByCompany);

    return {
      range: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      companies: companies.map((c) => ({
        companyId: c.id,
        name: c.name,
        slug: c.slug,
        active: c.active,
        createdAt: c.createdAt.toISOString(),
        users: userCounts.get(c.id) ?? 0,
        quotesInRange: quoteCounts.get(c.id) ?? 0,
        fvStudiesInRange: studyCounts.get(c.id) ?? 0,
        lastLoginAt: (lastLogin.get(c.id) ?? null)?.toISOString?.() ?? null,
      })),
    };
  }
}


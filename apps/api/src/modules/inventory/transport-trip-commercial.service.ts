import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import {
  normalizeVariableKey,
  TransportVariablesService,
} from "../transport-variables/transport-variables.service";
import { CreateTransportTripCommercialDto } from "./dto/create-transport-trip-commercial.dto";
import { UpdateTransportTripCommercialDto } from "./dto/update-transport-trip-commercial.dto";

function normStr(s: string | null | undefined): string | null {
  const t = (s ?? "").trim();
  return t || null;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s?.trim()) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Misma regla que acuerdo comercial: `${projectId}|${palletId ?? '_sin_pallet'}`. */
export function expectedTransportGroupKey(projectId: string, palletId: string | null | undefined): string {
  const pid = (palletId ?? "").trim();
  return `${projectId}|${pid ? pid : "_sin_pallet"}`;
}

function itemEffectiveAt(it: { activeFrom: Date | null; activeTo: Date | null }, at: Date): boolean {
  if (it.activeFrom && it.activeFrom.getTime() > at.getTime()) return false;
  if (it.activeTo && it.activeTo.getTime() < at.getTime()) return false;
  return true;
}

function overrideEffectiveAt(o: { validFrom: Date; validTo: Date | null }, at: Date): boolean {
  if (o.validFrom.getTime() > at.getTime()) return false;
  if (o.validTo && o.validTo.getTime() < at.getTime()) return false;
  return true;
}

type LineInput = {
  sortOrder: number;
  concept: string;
  amount: number;
  currency: string;
  sourceKind: string;
  sourceRef: string | null;
  notes: string | null;
};

type TripMeasures = { kmUsed: number | null; litersUsed: number | null };

type VarEntry = { value: number; unit: string | null; label: string };

function tryNormalizeVariableKey(code: string | null | undefined): string | null {
  const t = (code ?? "").trim();
  if (!t) return null;
  try {
    return normalizeVariableKey(t);
  } catch {
    return null;
  }
}

function buildVarByKey(
  resolved: Awaited<ReturnType<TransportVariablesService["resolveAt"]>>,
): Map<string, VarEntry> {
  const m = new Map<string, VarEntry>();
  for (const r of resolved) {
    if (!r.resolved) continue;
    m.set(r.key, {
      value: r.resolved.value,
      unit: r.resolved.unit,
      label: r.label,
    });
  }
  return m;
}

/** Fase 4: tarifa base opcionalmente tomada del catálogo si `code` coincide con `TransportVariable.key`. */
function resolveRateFromCode(
  itemAmount: number,
  code: string | null | undefined,
  varByKey: Map<string, VarEntry>,
): { rate: number; variableNote: string | null } {
  let rate = itemAmount;
  let variableNote: string | null = null;
  const vk = tryNormalizeVariableKey(code);
  if (vk && varByKey.has(vk)) {
    const ent = varByKey.get(vk)!;
    rate = ent.value;
    variableNote = `Tarifa desde variable ${vk} (${ent.label})${ent.unit ? ` · ${ent.unit}` : ""}`;
  }
  return { rate, variableNote };
}

/** KM / LITER multiplican la tarifa por los datos operativos del viaje. */
function amountFromTariffUnit(
  unitRaw: string,
  rate: number,
  trip: TripMeasures,
): { amount: number; qtyHint: string | null } {
  const unit = (unitRaw ?? "OTHER").trim().toUpperCase();
  if (unit === "KM") {
    const km = trip.kmUsed != null && Number.isFinite(trip.kmUsed) ? trip.kmUsed : 0;
    const qtyHint =
      trip.kmUsed == null || !Number.isFinite(trip.kmUsed)
        ? "Sin km informados en el viaje (se usa 0 × tarifa)."
        : null;
    return { amount: rate * km, qtyHint };
  }
  if (unit === "LITER" || unit === "LITROS") {
    const L = trip.litersUsed != null && Number.isFinite(trip.litersUsed) ? trip.litersUsed : 0;
    const qtyHint =
      trip.litersUsed == null || !Number.isFinite(trip.litersUsed)
        ? "Sin litros informados en el viaje (se usa 0 × tarifa)."
        : null;
    return { amount: rate * L, qtyHint };
  }
  return { amount: rate, qtyHint: null };
}

function mergeLineNotes(parts: (string | null | undefined)[]): string | null {
  const s = parts.filter((p) => p && String(p).trim()).join(" · ");
  return s.trim() || null;
}

@Injectable()
export class TransportTripCommercialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transportVariables: TransportVariablesService,
  ) {}

  async list(filters: { projectId?: string | null; groupKey?: string | null; status?: string | null }) {
    const where: Prisma.TransportTripCommercialWhereInput = {};
    if (filters.projectId?.trim()) where.projectId = filters.projectId.trim();
    if (filters.groupKey?.trim()) where.groupKey = filters.groupKey.trim();
    if (filters.status?.trim()) where.status = filters.status.trim().toUpperCase();
    return this.prisma.transportTripCommercial.findMany({
      where,
      orderBy: [{ tripDate: "desc" }, { updatedAt: "desc" }],
      include: {
        project: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, name: true } },
        contractVersion: { select: { id: true, versionNumber: true, status: true, contractId: true } },
        _count: { select: { lines: true } },
      },
    });
  }

  async getOne(id: string) {
    const t = await this.prisma.transportTripCommercial.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        project: { select: { id: true, code: true, name: true, transportVariableProfileId: true } },
        supplier: { select: { id: true, name: true } },
        contractVersion: {
          include: {
            contract: { select: { id: true, title: true, defaultVatPercent: true, defaultCurrency: true } },
          },
        },
        variableProfile: { select: { id: true, name: true } },
      },
    });
    if (!t) throw new NotFoundException("Viaje comercial no encontrado.");
    const deal = await this.prisma.transportGroupCommercial.findUnique({
      where: { groupKey: t.groupKey },
      include: {
        contractVersion: {
          include: { contract: { select: { transportVariableProfileId: true } } },
        },
      },
    });
    const inputsResolvedAtProfileId =
      deal?.contractVersion?.contract?.transportVariableProfileId ??
      t.project.transportVariableProfileId ??
      null;
    const inputsResolved = await this.transportVariables.resolveAt(
      t.tripDate,
      inputsResolvedAtProfileId,
      null,
    );
    return { ...t, inputsResolvedAtProfileId, inputsResolved };
  }

  async create(dto: CreateTransportTripCommercialDto) {
    const projectId = dto.projectId.trim();
    const p = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!p) throw new BadRequestException("Proyecto no existe.");
    const gk = dto.groupKey.trim();
    const expected = expectedTransportGroupKey(projectId, dto.palletId ?? null);
    if (gk !== expected) {
      throw new BadRequestException(`groupKey debe ser exactamente: ${expected}`);
    }
    const tn = dto.tripNumber.trim();
    if (!tn) throw new BadRequestException("tripNumber requerido.");
    const sid = normStr(dto.supplierId);
    if (sid) {
      const sup = await this.prisma.supplier.findUnique({ where: { id: sid } });
      if (!sup) throw new BadRequestException("Proveedor no existe.");
    }
    try {
      return await this.prisma.transportTripCommercial.create({
        data: {
          projectId,
          groupKey: gk,
          palletId: normStr(dto.palletId),
          tripNumber: tn,
          supplierId: sid,
          tripDate: parseDate(dto.tripDate ?? null) ?? new Date(),
          scenario: (dto.scenario ?? "COMMERCIAL").trim().toUpperCase() || "COMMERCIAL",
          kmUsed: dto.kmUsed ?? undefined,
          litersUsed: dto.litersUsed ?? undefined,
          extraChargesNote: normStr(dto.extraChargesNote),
          notes: normStr(dto.notes),
        },
        include: {
          project: { select: { id: true, code: true, name: true } },
          _count: { select: { lines: true } },
        },
      });
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
        throw new BadRequestException("Ya existe un viaje con ese número en este grupo (groupKey + tripNumber).");
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateTransportTripCommercialDto) {
    const t = await this.prisma.transportTripCommercial.findUnique({ where: { id } });
    if (!t) throw new NotFoundException("Viaje comercial no encontrado.");
    if (t.status === "CLOSED") throw new ForbiddenException("Viaje cerrado: no editable.");
    const data: Prisma.TransportTripCommercialUpdateInput = {};
    if (dto.tripDate !== undefined) data.tripDate = parseDate(dto.tripDate ?? null) ?? t.tripDate;
    if (dto.scenario !== undefined) data.scenario = (dto.scenario ?? "COMMERCIAL").trim().toUpperCase() || "COMMERCIAL";
    if (dto.supplierId !== undefined) {
      const sid = normStr(dto.supplierId);
      if (sid) {
        const sup = await this.prisma.supplier.findUnique({ where: { id: sid } });
        if (!sup) throw new BadRequestException("Proveedor no existe.");
      }
      data.supplier = sid ? { connect: { id: sid } } : { disconnect: true };
    }
    if (dto.kmUsed !== undefined) data.kmUsed = dto.kmUsed;
    if (dto.litersUsed !== undefined) data.litersUsed = dto.litersUsed;
    if (dto.extraChargesNote !== undefined) data.extraChargesNote = normStr(dto.extraChargesNote);
    if (dto.notes !== undefined) data.notes = normStr(dto.notes);
    await this.prisma.transportTripCommercial.update({ where: { id }, data });
    return this.getOne(id);
  }

  private async computeLines(tripId: string): Promise<{
    lines: LineInput[];
    subtotal: number;
    currency: string;
    contractVersionId: string | null;
    variableProfileId: string | null;
    vatPercent: number;
  }> {
    const trip = await this.prisma.transportTripCommercial.findUnique({
      where: { id: tripId },
      include: {
        project: { select: { id: true, transportVariableProfileId: true } },
      },
    });
    if (!trip) throw new NotFoundException("Viaje no encontrado.");
    const at = trip.tripDate;
    const deal = await this.prisma.transportGroupCommercial.findUnique({
      where: { groupKey: trip.groupKey },
      include: {
        tariff: true,
        contractVersion: {
          include: {
            contract: true,
            items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
            overrides: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
          },
        },
      },
    });

    const lines: LineInput[] = [];
    let sortOrder = 0;
    let currency = trip.currency.trim() || "CLP";
    let contractVersionId: string | null = null;
    let variableProfileId: string | null = null;
    let vatPercent = 19;

    if (!deal) {
      lines.push({
        sortOrder: sortOrder++,
        concept: "Sin acuerdo comercial para este grupo",
        amount: 0,
        currency,
        sourceKind: "MANUAL",
        sourceRef: null,
        notes: "Cree o vincule un acuerdo en Transporte comercial.",
      });
      return { lines, subtotal: 0, currency, contractVersionId: null, variableProfileId: null, vatPercent };
    }

    if (deal.contractVersionId && deal.contractVersion) {
      const cv = deal.contractVersion;
      if (cv.status !== "PUBLISHED") {
        throw new BadRequestException("La versión del contrato del acuerdo no está publicada.");
      }
      contractVersionId = cv.id;
      const contract = cv.contract;
      currency = (contract.defaultCurrency ?? currency).trim() || currency;
      vatPercent = contract.defaultVatPercent ?? 19;
      variableProfileId =
        contract.transportVariableProfileId ?? trip.project.transportVariableProfileId ?? null;

      const items = cv.items.filter((it) => itemEffectiveAt(it, at));
      const overrides = cv.overrides.filter((o) => overrideEffectiveAt(o, at));

      const resolvedBundle = await this.transportVariables.resolveAt(at, variableProfileId, null);
      const varByKey = buildVarByKey(resolvedBundle);
      const tripMeasures: TripMeasures = {
        kmUsed: trip.kmUsed ?? null,
        litersUsed: trip.litersUsed ?? null,
      };

      type Row = { itemId: string; label: string; amount: number; cur: string; notes: string | null };
      const rows: Row[] = items.map((it) => {
        const { rate, variableNote } = resolveRateFromCode(Number(it.amount) || 0, it.code, varByKey);
        const { amount, qtyHint } = amountFromTariffUnit(it.unit, rate, tripMeasures);
        return {
          itemId: it.id,
          label: it.label,
          amount,
          cur: it.currency || currency,
          notes: mergeLineNotes([variableNote, qtyHint]),
        };
      });

      for (const o of overrides) {
        if (o.action !== "SUPPRESS_BASE" || !o.baseTariffItemId) continue;
        const idx = rows.findIndex((r) => r.itemId === o.baseTariffItemId);
        if (idx >= 0) rows.splice(idx, 1);
      }
      for (const o of overrides) {
        if (o.action !== "REPLACE_BASE" || !o.baseTariffItemId) continue;
        const idx = rows.findIndex((r) => r.itemId === o.baseTariffItemId);
        if (idx >= 0) {
          const rate = Number(o.amount) || 0;
          const { amount, qtyHint } = amountFromTariffUnit(o.unit, rate, tripMeasures);
          rows[idx] = {
            itemId: o.baseTariffItemId,
            label: `${rows[idx].label} → ${o.label}`,
            amount,
            cur: o.currency || currency,
            notes: mergeLineNotes([qtyHint]),
          };
        }
      }

      for (const r of rows) {
        lines.push({
          sortOrder: sortOrder++,
          concept: r.label,
          amount: r.amount,
          currency: r.cur,
          sourceKind: "TARIFF_ITEM",
          sourceRef: r.itemId,
          notes: r.notes,
        });
      }

      for (const o of overrides) {
        if (o.action !== "ADDITION") continue;
        const rate = Number(o.amount) || 0;
        const { amount, qtyHint } = amountFromTariffUnit(o.unit, rate, tripMeasures);
        lines.push({
          sortOrder: sortOrder++,
          concept: o.label,
          amount,
          currency: o.currency || currency,
          sourceKind: "TARIFF_OVERRIDE_ADD",
          sourceRef: o.id,
          notes: mergeLineNotes([o.reason, qtyHint]),
        });
      }

      let baseForFuel = lines.reduce((s, l) => s + l.amount, 0);
      const pct = deal.fuelSurchargePercent;
      if (pct != null && Number(pct) > 0) {
        const fuel = baseForFuel * (Number(pct) / 100);
        lines.push({
          sortOrder: sortOrder++,
          concept: `Recargo combustible (${pct}%)`,
          amount: fuel,
          currency,
          sourceKind: "FUEL_SURCHARGE",
          sourceRef: null,
          notes: null,
        });
        baseForFuel += fuel;
      }
    } else if (deal.tariffId && deal.tariff) {
      const tf = deal.tariff;
      variableProfileId = trip.project.transportVariableProfileId ?? null;
      currency = (tf.currency ?? currency).trim() || currency;
      lines.push({
        sortOrder: sortOrder++,
        concept: `Plantilla: ${tf.label}`,
        amount: Number(tf.baseAmount) || 0,
        currency,
        sourceKind: "TEMPLATE_BASE",
        sourceRef: tf.id,
        notes: null,
      });
      let baseForFuel = lines[0]?.amount ?? 0;
      const pct = deal.fuelSurchargePercent;
      if (pct != null && Number(pct) > 0) {
        const fuel = baseForFuel * (Number(pct) / 100);
        lines.push({
          sortOrder: sortOrder++,
          concept: `Recargo combustible (${pct}%)`,
          amount: fuel,
          currency,
          sourceKind: "FUEL_SURCHARGE",
          sourceRef: null,
          notes: null,
        });
      }
    } else {
      lines.push({
        sortOrder: sortOrder++,
        concept: "Acuerdo sin plantilla ni contrato",
        amount: 0,
        currency,
        sourceKind: "MANUAL",
        sourceRef: null,
        notes: "Vincule plantilla o versión publicada en el acuerdo por grupo.",
      });
    }

    const subtotal = lines.reduce((s, l) => s + l.amount, 0);
    return { lines, subtotal, currency, contractVersionId, variableProfileId, vatPercent };
  }

  async recalculate(tripId: string) {
    const trip = await this.prisma.transportTripCommercial.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException("Viaje no encontrado.");
    if (trip.status === "CLOSED") throw new ForbiddenException("No se recalcula un viaje cerrado.");

    const { lines, subtotal, currency, contractVersionId, variableProfileId, vatPercent } =
      await this.computeLines(tripId);
    const vatAmount = (subtotal * vatPercent) / 100;
    const total = subtotal + vatAmount;

    await this.prisma.$transaction(async (tx) => {
      await tx.transportTripCostLine.deleteMany({ where: { tripId } });
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i]!;
        await tx.transportTripCostLine.create({
          data: {
            tripId,
            sortOrder: L.sortOrder ?? i,
            concept: L.concept,
            amount: L.amount,
            currency: L.currency,
            sourceKind: L.sourceKind,
            sourceRef: L.sourceRef,
            notes: L.notes,
          },
        });
      }
      await tx.transportTripCommercial.update({
        where: { id: tripId },
        data: {
          subtotal,
          vatAmount,
          total,
          currency,
          contractVersionId,
          variableProfileId,
        },
      });
    });

    return this.getOne(tripId);
  }

  async close(tripId: string) {
    const trip = await this.prisma.transportTripCommercial.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException("Viaje no encontrado.");
    if (trip.status === "CLOSED") throw new BadRequestException("El viaje ya está cerrado.");
    await this.recalculate(tripId);
    await this.prisma.transportTripCommercial.update({
      where: { id: tripId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    return this.getOne(tripId);
  }
}

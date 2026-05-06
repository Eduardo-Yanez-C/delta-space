// @ts-nocheck — alineado con dist (Decimal / transacciones).
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { assertUserCanAccessQuote } from "../quotes/quote-access.helper";
import type { SetAddonInputsDto } from "./dto/set-addon-inputs.dto";
import type { AuthUserPayload } from "../auth/auth.service";

function toNum(d: unknown): number | null {
  if (d == null) return null;
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d)
    return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

const APPLICATION_MODE_SUGERIDO = "SUGERIDO";

@Injectable()
export class QuoteAddOnsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureVersionBelongsToQuote(quoteId: string, versionId: string) {
    const version = await this.prisma.quoteVersion.findFirst({
      where: { id: versionId, quoteId },
    });
    if (!version) throw new NotFoundException("Versión no encontrada");
    return version;
  }

  async findAll() {
    const list = await this.prisma.quoteAddOn.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return list.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      sortOrder: r.sortOrder,
      conditionType: r.conditionType,
      thresholdNumeric: toNum(r.thresholdNumeric),
      inputKey: r.inputKey,
      quantityRule: r.quantityRule,
      unit: r.unit,
      unitPriceDefault: toNum(r.unitPriceDefault),
      currency: r.currency,
      applicationMode: r.applicationMode,
    }));
  }

  async findOne(id: string) {
    const r = await this.prisma.quoteAddOn.findFirst({
      where: { id, active: true },
    });
    if (!r) throw new NotFoundException("Regla de adicional no encontrada");
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      sortOrder: r.sortOrder,
      conditionType: r.conditionType,
      thresholdNumeric: toNum(r.thresholdNumeric),
      inputKey: r.inputKey,
      quantityRule: r.quantityRule,
      unit: r.unit,
      unitPriceDefault: toNum(r.unitPriceDefault),
      currency: r.currency,
      applicationMode: r.applicationMode,
    };
  }

  async getAddOnInputs(
    quoteId: string,
    versionId: string,
    user: AuthUserPayload,
  ) {
    await assertUserCanAccessQuote(this.prisma, quoteId, user);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const rows = await this.prisma.quoteAddOnInput.findMany({
      where: { quoteVersionId: versionId },
      orderBy: { inputKey: "asc" },
    });
    return {
      inputs: rows.map((r) => ({
        inputKey: r.inputKey,
        valueNumeric: toNum(r.valueNumeric),
        valueText: r.valueText,
      })),
    };
  }

  async setAddOnInputs(
    quoteId: string,
    versionId: string,
    dto: SetAddonInputsDto,
    user: AuthUserPayload,
  ) {
    await assertUserCanAccessQuote(this.prisma, quoteId, user);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const inputs = dto.inputs ?? [];
    const keys = inputs.map((i) => i.inputKey).filter(Boolean);
    const seen = new Set<string>();
    for (const k of keys) {
      if (seen.has(k))
        throw new BadRequestException(`inputKey duplicado: ${k}`);
      seen.add(k);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.quoteAddOnInput.deleteMany({ where: { quoteVersionId: versionId } });
      for (const i of inputs) {
        if (!i.inputKey?.trim()) continue;
        await tx.quoteAddOnInput.create({
          data: {
            quoteVersionId: versionId,
            inputKey: i.inputKey.trim(),
            valueNumeric:
              i.valueNumeric != null ? new Prisma.Decimal(i.valueNumeric) : null,
            valueText: i.valueText ?? null,
          },
        });
      }
    });
    return this.getAddOnInputs(quoteId, versionId, user);
  }

  async evaluateAddOnSuggestions(
    quoteId: string,
    versionId: string,
    user: AuthUserPayload,
  ) {
    await assertUserCanAccessQuote(this.prisma, quoteId, user);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const inputRows = await this.prisma.quoteAddOnInput.findMany({
      where: { quoteVersionId: versionId },
    });
    const inputMap = new Map<
      string,
      { valueNumeric: number | null; valueText: string | null }
    >();
    for (const r of inputRows) {
      inputMap.set(r.inputKey, {
        valueNumeric: toNum(r.valueNumeric),
        valueText: r.valueText,
      });
    }
    const rules = await this.prisma.quoteAddOn.findMany({
      where: { active: true, applicationMode: APPLICATION_MODE_SUGERIDO },
      orderBy: { sortOrder: "asc" },
    });
    const toUpsert: Array<{
      quoteAddOnId: string;
      suggestedQuantity: number;
      suggestedUnitPrice: number;
      currency: string | null;
    }> = [];
    const addOnIdsToDelete: string[] = [];
    for (const rule of rules) {
      const input = inputMap.get(rule.inputKey);
      const valueNum = input?.valueNumeric ?? null;
      const valueText = input?.valueText ?? null;
      const num = valueNum ?? (valueText != null ? Number(valueText) : NaN);
      if (valueNum == null && (valueText == null || valueText === "")) continue;
      const threshold = toNum(rule.thresholdNumeric) ?? 0;
      let passes = false;
      switch (rule.conditionType) {
        case "NUMERIC_GT":
          passes =
            typeof num === "number" && !Number.isNaN(num) && num > threshold;
          break;
        case "NUMERIC_GTE":
          passes =
            typeof num === "number" && !Number.isNaN(num) && num >= threshold;
          break;
        case "NUMERIC_LT":
          passes =
            typeof num === "number" && !Number.isNaN(num) && num < threshold;
          break;
        case "NUMERIC_LTE":
          passes =
            typeof num === "number" && !Number.isNaN(num) && num <= threshold;
          break;
        case "BOOLEAN":
          passes = valueText === "true" || valueNum === 1;
          break;
        default:
          passes = false;
      }
      if (!passes) {
        const existing = await this.prisma.quoteAddOnSuggestion.findUnique({
          where: {
            quoteVersionId_quoteAddOnId: {
              quoteVersionId: versionId,
              quoteAddOnId: rule.id,
            },
          },
        });
        if (existing?.status === "PENDING") addOnIdsToDelete.push(rule.id);
        continue;
      }
      let quantity = 0;
      switch (rule.quantityRule) {
        case "EXCESS":
          quantity = Math.max(
            0,
            (typeof num === "number" && !Number.isNaN(num) ? num : 0) - threshold,
          );
          break;
        case "VALUE":
          quantity =
            typeof num === "number" && !Number.isNaN(num) ? num : 0;
          break;
        case "FIXED":
        default:
          quantity = 1;
          break;
      }
      const unitPrice = toNum(rule.unitPriceDefault) ?? 0;
      toUpsert.push({
        quoteAddOnId: rule.id,
        suggestedQuantity: quantity,
        suggestedUnitPrice: unitPrice,
        currency: rule.currency,
      });
    }
    await this.prisma.$transaction(async (tx) => {
      for (const addOnId of addOnIdsToDelete) {
        await tx.quoteAddOnSuggestion.deleteMany({
          where: {
            quoteVersionId: versionId,
            quoteAddOnId: addOnId,
            status: "PENDING",
          },
        });
      }
      for (const u of toUpsert) {
        const existing = await tx.quoteAddOnSuggestion.findUnique({
          where: {
            quoteVersionId_quoteAddOnId: {
              quoteVersionId: versionId,
              quoteAddOnId: u.quoteAddOnId,
            },
          },
        });
        const keepStatus =
          existing?.status === "ACCEPTED" || existing?.status === "REJECTED";
        await tx.quoteAddOnSuggestion.upsert({
          where: {
            quoteVersionId_quoteAddOnId: {
              quoteVersionId: versionId,
              quoteAddOnId: u.quoteAddOnId,
            },
          },
          create: {
            quoteVersionId: versionId,
            quoteAddOnId: u.quoteAddOnId,
            suggestedQuantity: new Prisma.Decimal(u.suggestedQuantity),
            suggestedUnitPrice: new Prisma.Decimal(u.suggestedUnitPrice),
            currency: u.currency,
            status: "PENDING",
          },
          update: keepStatus
            ? {}
            : {
                suggestedQuantity: new Prisma.Decimal(u.suggestedQuantity),
                suggestedUnitPrice: new Prisma.Decimal(u.suggestedUnitPrice),
                currency: u.currency,
                status: "PENDING",
              },
        });
      }
    });
    return this.getAddOnSuggestions(quoteId, versionId, user);
  }

  async getAddOnSuggestions(
    quoteId: string,
    versionId: string,
    user: AuthUserPayload,
  ) {
    await assertUserCanAccessQuote(this.prisma, quoteId, user);
    await this.ensureVersionBelongsToQuote(quoteId, versionId);
    const rows = await this.prisma.quoteAddOnSuggestion.findMany({
      where: { quoteVersionId: versionId },
      include: { quoteAddOn: true },
      orderBy: [{ quoteAddOn: { sortOrder: "asc" } }, { createdAt: "asc" }],
    });
    return {
      suggestions: rows.map((s) => ({
        id: s.id,
        quoteAddOnId: s.quoteAddOnId,
        code: s.quoteAddOn.code,
        name: s.quoteAddOn.name,
        description: s.quoteAddOn.description,
        unit: s.quoteAddOn.unit,
        suggestedQuantity: toNum(s.suggestedQuantity),
        suggestedUnitPrice: toNum(s.suggestedUnitPrice),
        currency: s.currency,
        status: s.status,
        quoteItemId: s.quoteItemId,
      })),
    };
  }
}

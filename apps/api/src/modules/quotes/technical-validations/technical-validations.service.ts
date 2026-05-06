// @ts-nocheck — emitido desde dist; includes Prisma anidados.
import { Injectable, NotFoundException } from "@nestjs/common";
import { commercialNameForQuoteLine } from "../../../common/product-quote-display-name";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { assertUserCanAccessQuote } from "../quote-access.helper";
import type { AuthUserPayload } from "../../auth/auth.service";

type ProductWithSpecs = {
  id: string;
  name: string;
  connectionType: string | null;
  nominalVoltageV: number | null;
  inverterType: string | null;
  isBatteryComponent: boolean | null;
  panelSpecs?: { vocV: number | null; powerW: number | null } | null;
  inverterSpecs?: {
    connectionType: string | null;
    inverterType: string | null;
    maxPvVoltageV: number | null;
    powerAcW: number | null;
  } | null;
  batterySpecs?: { nominalVoltageV: number | null } | null;
};

export type ProductTech = {
  id: string;
  name: string;
  connectionType: string | null;
  nominalVoltageV: number | null;
  inverterType: string | null;
  isBatteryComponent: boolean | null;
  panelSpecs?: ProductWithSpecs["panelSpecs"];
  inverterSpecs?: ProductWithSpecs["inverterSpecs"];
  batterySpecs?: ProductWithSpecs["batterySpecs"];
};

export type ProductEntry = {
  productId: string;
  product: ProductTech;
  itemId: string | null;
  lineId: string | null;
  productNameSnapshot: string;
  quantity?: number;
};

export type TechnicalValidationAlert = {
  code: string;
  message: string;
  severity: string;
  productId: string | null;
  itemId: string | null;
  lineId: string | null;
};

function resolveProductTech(raw: ProductWithSpecs): ProductTech {
  const connectionType =
    raw.inverterSpecs?.connectionType?.trim() || raw.connectionType?.trim() || null;
  const inverterType =
    raw.inverterSpecs?.inverterType?.trim() || raw.inverterType?.trim() || null;
  const nominalVoltageV =
    raw.nominalVoltageV ?? raw.batterySpecs?.nominalVoltageV ?? null;
  const isBatteryComponent =
    raw.isBatteryComponent === true || raw.batterySpecs != null;
  return {
    id: raw.id,
    name: raw.name,
    connectionType: connectionType || null,
    nominalVoltageV,
    inverterType: inverterType || null,
    isBatteryComponent,
    panelSpecs: raw.panelSpecs ?? undefined,
    inverterSpecs: raw.inverterSpecs ?? undefined,
    batterySpecs: raw.batterySpecs ?? undefined,
  };
}

function toQuantity(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

const SEVERITY_WARNING = "WARNING";
const POWER_RATIO_MIN = 0.5;
const POWER_RATIO_MAX = 1.5;

function effectiveStudySystemType(systemType: string | null | undefined): string {
  const t = systemType?.trim();
  return t === "HYBRID" || t === "OFF_GRID" ? t : "ON_GRID";
}

@Injectable()
export class TechnicalValidationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAlerts(quoteId: string, versionId: string, user: AuthUserPayload) {
    await assertUserCanAccessQuote(this.prisma, quoteId, user);
    const productSelect = {
      id: true,
      name: true,
      connectionType: true,
      nominalVoltageV: true,
      inverterType: true,
      isBatteryComponent: true,
      panelSpecs: { select: { vocV: true, powerW: true } },
      inverterSpecs: {
        select: {
          connectionType: true,
          inverterType: true,
          maxPvVoltageV: true,
          powerAcW: true,
        },
      },
      batterySpecs: { select: { nominalVoltageV: true } },
    };
    const version = await this.prisma.quoteVersion.findFirst({
      where: { id: versionId, quoteId },
      include: {
        quote: { select: { id: true, sourceFvStudyId: true } },
        items: {
          where: { productId: { not: null } },
          select: {
            id: true,
            productId: true,
            productNameSnapshot: true,
            quantity: true,
            product: { select: productSelect },
          },
        },
        mainItems: {
          include: {
            lines: {
              where: { productId: { not: null } },
              select: {
                id: true,
                productId: true,
                productNameSnapshot: true,
                quantity: true,
                product: { select: productSelect },
              },
            },
          },
        },
      },
    });
    if (!version || version.quoteId !== quoteId) {
      throw new NotFoundException("Versión no encontrada");
    }
    const quote = version.quote;
    let study: { connectionType: string | null; systemType: string | null } | null =
      null;
    if (quote?.sourceFvStudyId) {
      const s = await this.prisma.fvStudy.findUnique({
        where: { id: quote.sourceFvStudyId },
        select: { connectionType: true, systemType: true },
      });
      if (s) study = s;
    }
    const entries = this.buildProductEntries(version);
    const effectiveSystem = effectiveStudySystemType(study?.systemType);
    const alerts: TechnicalValidationAlert[] = [];
    alerts.push(...this.ruleConnectionMismatchStudy(study, entries));
    alerts.push(...this.ruleVoltageMismatchInverterBattery(entries));
    alerts.push(...this.ruleSystemTypeStudyVsInverter(effectiveSystem, entries));
    alerts.push(...this.ruleSystemTypeStudyVsBattery(effectiveSystem, entries));
    alerts.push(...this.ruleVoltageMismatchBetweenLines(entries));
    alerts.push(...this.rulePanelVocExceedsInverterMaxPv(entries));
    alerts.push(...this.ruleInverterPowerMismatchPanels(entries));
    return { alerts };
  }

  private buildProductEntries(version: {
    mainItems?: Array<{
      lines?: Array<{
        productId: string | null;
        product: ProductWithSpecs | null;
        productNameSnapshot: string | null;
        id: string;
        quantity: unknown;
      }>;
    }>;
    items?: Array<{
      productId: string | null;
      product: ProductWithSpecs | null;
      productNameSnapshot: string | null;
      id: string;
      quantity: unknown;
    }>;
  }): ProductEntry[] {
    const hasLinesWithProduct = version.mainItems?.some((m) =>
      m.lines?.some((l) => l.productId != null && l.product != null),
    );
    const entries: ProductEntry[] = [];
    if (hasLinesWithProduct) {
      for (const main of version.mainItems ?? []) {
        for (const line of main.lines ?? []) {
          if (line.productId && line.product) {
            entries.push({
              productId: line.productId,
              product: resolveProductTech(line.product),
              itemId: null,
              lineId: line.id,
              productNameSnapshot:
                line.productNameSnapshot || commercialNameForQuoteLine(line.product),
              quantity: toQuantity(line.quantity),
            });
          }
        }
      }
    } else {
      for (const item of version.items ?? []) {
        if (item.productId && item.product) {
          entries.push({
            productId: item.productId,
            product: resolveProductTech(item.product),
            itemId: item.id,
            lineId: null,
            productNameSnapshot:
              item.productNameSnapshot || commercialNameForQuoteLine(item.product),
            quantity: toQuantity(item.quantity),
          });
        }
      }
    }
    return entries;
  }

  private ruleConnectionMismatchStudy(
    study: { connectionType: string | null } | null,
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    const alerts: TechnicalValidationAlert[] = [];
    if (!study?.connectionType?.trim()) return alerts;
    const expected = study.connectionType.trim();
    for (const e of entries) {
      const found = e.product.connectionType?.trim();
      if (found && found !== expected) {
        alerts.push({
          code: "CONNECTION_MISMATCH_STUDY",
          message: `El estudio es ${expected}. El producto "${e.productNameSnapshot}" es ${found}.${e.itemId ? ` (Ítem de cotización)` : e.lineId ? ` (Línea jerárquica)` : ""}`,
          severity: SEVERITY_WARNING,
          productId: e.productId,
          itemId: e.itemId,
          lineId: e.lineId,
        });
      }
    }
    return alerts;
  }

  private ruleVoltageMismatchInverterBattery(
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    const inverters = entries.filter(
      (e) => e.product.inverterType != null && e.product.nominalVoltageV != null,
    );
    const batteries = entries.filter(
      (e) =>
        e.product.isBatteryComponent === true &&
        e.product.nominalVoltageV != null,
    );
    if (inverters.length === 0 || batteries.length === 0) return [];
    const invVoltages = new Set(inverters.map((e) => e.product.nominalVoltageV));
    const batVoltages = new Set(batteries.map((e) => e.product.nominalVoltageV));
    const conflict = [...invVoltages].some(
      (v) => batVoltages.size > 0 && !batVoltages.has(v),
    );
    if (!conflict) return [];
    const invV = inverters[0].product.nominalVoltageV;
    const batV = batteries[0].product.nominalVoltageV;
    const invName = inverters[0].productNameSnapshot;
    const batName = batteries[0].productNameSnapshot;
    return [
      {
        code: "VOLTAGE_MISMATCH_INVERTER_BATTERY",
        message: `Tensión del inversor (${invV}V, "${invName}") no coincide con la de la batería (${batV}V, "${batName}"). Esperado: misma tensión nominal.${inverters[0].lineId ? " (Línea jerárquica)" : inverters[0].itemId ? " (Ítem de cotización)" : ""}`,
        severity: SEVERITY_WARNING,
        productId: inverters[0].productId,
        itemId: inverters[0].itemId,
        lineId: inverters[0].lineId,
      },
    ];
  }

  private ruleSystemTypeStudyVsInverter(
    effectiveSystem: string,
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    if (effectiveSystem !== "HYBRID") return [];
    const onGridInverters = entries.filter(
      (e) => e.product.inverterType === "ON_GRID",
    );
    if (onGridInverters.length === 0) return [];
    const e = onGridInverters[0];
    return [
      {
        code: "SYSTEM_TYPE_STUDY_VS_INVERTER",
        message: `El estudio contempla sistema con almacenamiento (híbrido). El inversor seleccionado "${e.productNameSnapshot}" es solo on-grid. Esperado: inversor híbrido u off-grid.${e.itemId ? " (Ítem de cotización)" : e.lineId ? " (Línea jerárquica)" : ""}`,
        severity: SEVERITY_WARNING,
        productId: e.productId,
        itemId: e.itemId,
        lineId: e.lineId,
      },
    ];
  }

  private ruleSystemTypeStudyVsBattery(
    effectiveSystem: string,
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    if (effectiveSystem !== "ON_GRID") return [];
    const withStorage = entries.filter(
      (e) =>
        e.product.isBatteryComponent === true ||
        e.product.inverterType === "HYBRID",
    );
    if (withStorage.length === 0) return [];
    const e = withStorage[0];
    return [
      {
        code: "SYSTEM_TYPE_STUDY_VS_BATTERY",
        message: `El estudio no incluye almacenamiento (on-grid). La cotización incluye ítem de batería o inversor híbrido: "${e.productNameSnapshot}". Esperado: solo componentes on-grid.${e.itemId ? " (Ítem de cotización)" : e.lineId ? " (Línea jerárquica)" : ""}`,
        severity: SEVERITY_WARNING,
        productId: e.productId,
        itemId: e.itemId,
        lineId: e.lineId,
      },
    ];
  }

  private ruleVoltageMismatchBetweenLines(
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    const withVoltage = entries.filter((e) => e.product.nominalVoltageV != null);
    const byVoltage = new Map<number, ProductEntry[]>();
    for (const e of withVoltage) {
      const v = e.product.nominalVoltageV as number;
      if (!byVoltage.has(v)) byVoltage.set(v, []);
      byVoltage.get(v)!.push(e);
    }
    if (byVoltage.size < 2) return [];
    const groups = [...byVoltage.entries()].map(([voltage, list]) => ({
      voltage,
      names: list.map((e) => e.productNameSnapshot),
      first: list[0],
    }));
    const first = groups[0].first;
    const summary = groups
      .map(
        (g) =>
          `${g.voltage}V (${g.names.slice(0, 3).join(", ")}${g.names.length > 3 ? "…" : ""})`,
      )
      .join(" y ");
    return [
      {
        code: "VOLTAGE_MISMATCH_BETWEEN_LINES",
        message: `Se detectaron tensiones incompatibles en la cotización: ${summary}. Revise que inversores y baterías compartan la misma tensión nominal.${first.itemId ? " (Ítem de cotización)" : first.lineId ? " (Línea jerárquica)" : ""}`,
        severity: SEVERITY_WARNING,
        productId: first.productId,
        itemId: first.itemId,
        lineId: first.lineId,
      },
    ];
  }

  private rulePanelVocExceedsInverterMaxPv(
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    const panels = entries.filter(
      (e) =>
        e.product.panelSpecs?.vocV != null &&
        Number(e.product.panelSpecs.vocV) > 0,
    );
    const inverters = entries.filter(
      (e) =>
        e.product.inverterSpecs?.maxPvVoltageV != null &&
        Number(e.product.inverterSpecs.maxPvVoltageV) > 0,
    );
    if (panels.length === 0 || inverters.length === 0) return [];
    const alerts: TechnicalValidationAlert[] = [];
    for (const panel of panels) {
      const panelVoc = Number(panel.product.panelSpecs!.vocV);
      for (const inv of inverters) {
        const maxPv = Number(inv.product.inverterSpecs!.maxPvVoltageV);
        if (panelVoc > maxPv) {
          alerts.push({
            code: "PANEL_VOC_EXCEEDS_INVERTER_MAX_PV",
            message: `El Voc del panel "${panel.productNameSnapshot}" (${panelVoc}V) supera la tensión máxima PV del inversor "${inv.productNameSnapshot}" (${maxPv}V). Riesgo de daño.${panel.lineId ? " (Línea jerárquica)" : panel.itemId ? " (Ítem de cotización)" : ""}`,
            severity: SEVERITY_WARNING,
            productId: panel.productId,
            itemId: panel.itemId,
            lineId: panel.lineId,
          });
        }
      }
    }
    return alerts;
  }

  private ruleInverterPowerMismatchPanels(
    entries: ProductEntry[],
  ): TechnicalValidationAlert[] {
    const panelEntries = entries.filter(
      (e) =>
        e.product.panelSpecs?.powerW != null &&
        Number(e.product.panelSpecs.powerW) > 0 &&
        e.quantity != null &&
        e.quantity > 0,
    );
    const inverterEntries = entries.filter(
      (e) =>
        e.product.inverterSpecs?.powerAcW != null &&
        Number(e.product.inverterSpecs.powerAcW) > 0,
    );
    if (panelEntries.length === 0 || inverterEntries.length === 0) return [];
    const totalPanelW =
      panelEntries.reduce(
        (sum, e) =>
          sum + Number(e.product.panelSpecs!.powerW) * (e.quantity ?? 1),
        0,
      ) || 0;
    if (totalPanelW <= 0) return [];
    const alerts: TechnicalValidationAlert[] = [];
    for (const inv of inverterEntries) {
      const powerAcW = Number(inv.product.inverterSpecs!.powerAcW);
      if (powerAcW <= 0) continue;
      const ratio = totalPanelW / powerAcW;
      if (ratio < POWER_RATIO_MIN || ratio > POWER_RATIO_MAX) {
        const hint =
          ratio < POWER_RATIO_MIN
            ? "Potencia de paneles muy baja respecto al inversor."
            : "Potencia de paneles muy alta respecto al inversor.";
        alerts.push({
          code: "INVERTER_POWER_MISMATCH_PANELS",
          message: `Ratio paneles/inversor: ${ratio.toFixed(2)} (${totalPanelW}W paneles / ${powerAcW}W inversor "${inv.productNameSnapshot}"). Rango esperado: ${POWER_RATIO_MIN}–${POWER_RATIO_MAX}. ${hint}${inv.lineId ? " (Línea jerárquica)" : inv.itemId ? " (Ítem de cotización)" : ""}`,
          severity: SEVERITY_WARNING,
          productId: inv.productId,
          itemId: inv.itemId,
          lineId: inv.lineId,
        });
      }
    }
    return alerts;
  }
}

// @ts-nocheck — emitido desde dist; tipos Prisma/dinámicos en transacciones.
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { hasSalesLikePrivileges } from "../auth/role-constants";
import { PrismaService } from "../../infra/prisma/prisma.service";
import * as cnCommercial from "../quotes/commercial-number";
import { mapQuoteResponse } from "../quotes/quote-response.mapper";
import { QuoteVersionsService } from "../quotes/versions/quote-versions.service";
import { commercialNameForQuoteLine } from "../../common/product-quote-display-name";
import type { CreateQuoteFromTemplateDto } from "./dto/create-quote-from-template.dto";
import type { CreateQuoteTemplateDto } from "./dto/create-quote-template.dto";
import type { CreateTemplateLineDto } from "./dto/create-template-line.dto";
import type { UpdateQuoteTemplateDto } from "./dto/update-quote-template.dto";
import type { UpdateTemplateItemDto } from "./dto/update-template-item.dto";
import type { UpdateTemplateLineDto } from "./dto/update-template-line.dto";
import type { AuthUserPayload } from "../auth/auth.service";

const BASE_ITEMS: Record<
  string,
  Array<{
    sortOrder: number;
    itemType: string;
    quantityRule: string;
    quantityFixed: number | null;
    potenciaPorPanelWp: number | null;
    productNameSnapshot: string;
    productDescriptionSnapshot: string;
  }>
> = {
  ON_GRID: [
    {
      sortOrder: 1,
      itemType: "PANELES",
      quantityRule: "DERIVED_FROM_POWER",
      quantityFixed: null,
      potenciaPorPanelWp: 400,
      productNameSnapshot: "Suministro de paneles fotovoltaicos",
      productDescriptionSnapshot:
        "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
    },
    {
      sortOrder: 2,
      itemType: "INVERSOR",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Suministro de inversor",
      productDescriptionSnapshot:
        "Inversor on-grid para sistema de {{targetPowerKwp}} kW. Conexión a red.",
    },
    {
      sortOrder: 3,
      itemType: "ESTRUCTURA",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Estructura de montaje",
      productDescriptionSnapshot:
        "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
    },
    {
      sortOrder: 4,
      itemType: "INSTALACION",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Instalación y puesta en marcha",
      productDescriptionSnapshot:
        "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
    },
    {
      sortOrder: 5,
      itemType: "CANALIZACION",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Canalización",
      productDescriptionSnapshot:
        "Canalización y materiales eléctricos según especificación del proyecto.",
    },
    {
      sortOrder: 6,
      itemType: "INGENIERIA",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Ingeniería y documentación técnica",
      productDescriptionSnapshot:
        "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
    },
  ],
  OFF_GRID: [
    {
      sortOrder: 1,
      itemType: "PANELES",
      quantityRule: "DERIVED_FROM_POWER",
      quantityFixed: null,
      potenciaPorPanelWp: 400,
      productNameSnapshot: "Suministro de paneles fotovoltaicos",
      productDescriptionSnapshot:
        "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
    },
    {
      sortOrder: 2,
      itemType: "INVERSOR",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Suministro de inversor",
      productDescriptionSnapshot:
        "Inversor off-grid para sistema de {{targetPowerKwp}} kW. Sistema aislado con almacenamiento en baterías.",
    },
    {
      sortOrder: 3,
      itemType: "ESTRUCTURA",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Estructura de montaje",
      productDescriptionSnapshot:
        "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
    },
    {
      sortOrder: 4,
      itemType: "INSTALACION",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Instalación y puesta en marcha",
      productDescriptionSnapshot:
        "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
    },
    {
      sortOrder: 5,
      itemType: "CANALIZACION",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Canalización",
      productDescriptionSnapshot:
        "Canalización y materiales eléctricos según especificación del proyecto.",
    },
    {
      sortOrder: 6,
      itemType: "INGENIERIA",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Ingeniería y documentación técnica",
      productDescriptionSnapshot:
        "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
    },
    {
      sortOrder: 7,
      itemType: "BATERIAS",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Baterías y almacenamiento",
      productDescriptionSnapshot:
        "Sistema de baterías para instalación off-grid. Incluye banco de baterías y gestión (BMS) según dimensionamiento.",
    },
    {
      sortOrder: 8,
      itemType: "PROTECCIONES_TABLERO",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Protecciones y tablero",
      productDescriptionSnapshot:
        "Protecciones eléctricas AC/DC y tablero de control para sistema off-grid. Incluye protecciones de batería e inversor.",
    },
  ],
  HYBRID: [
    {
      sortOrder: 1,
      itemType: "PANELES",
      quantityRule: "DERIVED_FROM_POWER",
      quantityFixed: null,
      potenciaPorPanelWp: 400,
      productNameSnapshot: "Suministro de paneles fotovoltaicos",
      productDescriptionSnapshot:
        "{{cantidadPaneles}} unidades de 400 Wp, sistema {{targetPowerKwp}} kWp. Incluye suministro de módulos fotovoltaicos.",
    },
    {
      sortOrder: 2,
      itemType: "INVERSOR",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Suministro de inversor",
      productDescriptionSnapshot:
        "Inversor híbrido para sistema de {{targetPowerKwp}} kW. Conexión a red con respaldo en baterías.",
    },
    {
      sortOrder: 3,
      itemType: "ESTRUCTURA",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Estructura de montaje",
      productDescriptionSnapshot:
        "Estructura de fijación para {{cantidadPaneles}} paneles. Incluye soportes y anclajes.",
    },
    {
      sortOrder: 4,
      itemType: "INSTALACION",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Instalación y puesta en marcha",
      productDescriptionSnapshot:
        "Instalación completa y puesta en marcha del sistema fotovoltaico en sitio.",
    },
    {
      sortOrder: 5,
      itemType: "CANALIZACION",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Canalización",
      productDescriptionSnapshot:
        "Canalización y materiales eléctricos según especificación del proyecto.",
    },
    {
      sortOrder: 6,
      itemType: "INGENIERIA",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Ingeniería y documentación técnica",
      productDescriptionSnapshot:
        "Proyecto de ingeniería, memorias de cálculo y documentación técnica para conexión.",
    },
    {
      sortOrder: 7,
      itemType: "BATERIAS",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Baterías y almacenamiento",
      productDescriptionSnapshot:
        "Sistema de baterías para instalación híbrida. Respaldo y autoconsumo. Incluye banco y gestión (BMS) según dimensionamiento.",
    },
    {
      sortOrder: 8,
      itemType: "PROTECCIONES_TABLERO",
      quantityRule: "FIXED",
      quantityFixed: 1,
      potenciaPorPanelWp: null,
      productNameSnapshot: "Protecciones y tablero",
      productDescriptionSnapshot:
        "Protecciones eléctricas AC/DC y tablero de control para sistema híbrido. Incluye protecciones de batería, inversor y conexión a red.",
    },
  ],
};

function toNum(d: unknown): number {
  if (d == null) return 0;
  if (typeof d === "number" && !Number.isNaN(d)) return d;
  if (typeof d === "object" && d !== null && "toNumber" in d)
    return (d as { toNumber: () => number }).toNumber();
  return Number(d);
}

function normalizeTemplateQuoteKindInput(raw: string | undefined): string {
  const v = (raw ?? "STANDARD").trim().toUpperCase();
  if (v === "STANDARD" || v === "") return "STANDARD";
  if (v === "MARGIN") return "MARGIN";
  throw new BadRequestException("quoteKind debe ser STANDARD o MARGIN");
}

function parseQuoteKindQueryParam(raw: string | undefined): string | undefined {
  if (raw == null || raw.trim() === "") return undefined;
  const v = raw.trim().toUpperCase();
  if (v === "STANDARD") return "STANDARD";
  if (v === "MARGIN") return "MARGIN";
  throw new BadRequestException("quoteKind debe ser STANDARD o MARGIN");
}

function mapTemplateItem(i: {
  id: string;
  sortOrder: number;
  itemType: string;
  quantityRule: string;
  quantityFixed: number | null;
  potenciaPorPanelWp: number | null;
  productNameSnapshot: string;
  productDescriptionSnapshot: string | null;
  unitPriceDefault: unknown;
  visibleInFinalQuoteDefault: boolean;
  lines?: Array<{
    id: string;
    sortOrder: number;
    source: string;
    productId: string | null;
    productNameSnapshot: string | null;
    productDescriptionSnapshot: string | null;
    quantityRule: string;
    quantityFixed: number | null;
    potenciaPorPanelWp: number | null;
    unitPriceDefault: unknown;
    currency: string | null;
    visibleInFinalQuoteDefault: boolean;
    product?: { id: string; name: string; description: string | null } | null;
  }>;
}) {
  return {
    id: i.id,
    sortOrder: i.sortOrder,
    itemType: i.itemType,
    quantityRule: i.quantityRule,
    quantityFixed: i.quantityFixed,
    potenciaPorPanelWp: i.potenciaPorPanelWp,
    productNameSnapshot: i.productNameSnapshot,
    productDescriptionSnapshot: i.productDescriptionSnapshot,
    unitPriceDefault: toNum(i.unitPriceDefault),
    visibleInFinalQuoteDefault: i.visibleInFinalQuoteDefault,
    lines: (i.lines ?? []).map((l) => ({
      id: l.id,
      sortOrder: l.sortOrder,
      source: l.source,
      productId: l.productId,
      productNameSnapshot: l.productNameSnapshot,
      productDescriptionSnapshot: l.productDescriptionSnapshot,
      quantityRule: l.quantityRule,
      quantityFixed: l.quantityFixed,
      potenciaPorPanelWp: l.potenciaPorPanelWp,
      unitPriceDefault: toNum(l.unitPriceDefault),
      currency: l.currency,
      visibleInFinalQuoteDefault: l.visibleInFinalQuoteDefault,
      product: l.product,
    })),
  };
}

@Injectable()
export class QuoteTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quoteVersionsService: QuoteVersionsService,
  ) {}

  async findAll(quoteKindQuery?: string) {
    const quoteKindFilter = parseQuoteKindQueryParam(quoteKindQuery);
    const list = await this.prisma.quoteTemplate.findMany({
      where: {
        active: true,
        ...(quoteKindFilter != null ? { quoteKind: quoteKindFilter } : {}),
      },
      orderBy: { sortOrder: "asc" },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            lines: {
              orderBy: { sortOrder: "asc" },
              include: {
                product: { select: { id: true, name: true, description: true } },
              },
            },
          },
        },
      },
    });
    return list.map((t) => ({
      id: t.id,
      name: t.name,
      quoteKind: t.quoteKind,
      systemType: t.systemType,
      targetPowerKwp: toNum(t.targetPowerKwp),
      description: t.description,
      sortOrder: t.sortOrder,
      items: t.items.map((i) => mapTemplateItem(i)),
    }));
  }

  async findOne(id: string) {
    const t = await this.prisma.quoteTemplate.findUnique({
      where: { id },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            lines: {
              orderBy: { sortOrder: "asc" },
              include: {
                product: { select: { id: true, name: true, description: true } },
              },
            },
          },
        },
      },
    });
    if (!t) throw new NotFoundException("Plantilla no encontrada");
    return {
      id: t.id,
      name: t.name,
      quoteKind: t.quoteKind,
      systemType: t.systemType,
      targetPowerKwp: toNum(t.targetPowerKwp),
      description: t.description,
      sortOrder: t.sortOrder,
      active: t.active,
      items: t.items.map((i) => mapTemplateItem(i)),
    };
  }

  async createTemplate(dto: CreateQuoteTemplateDto) {
    const name = (dto.name ?? "").trim();
    if (!name) throw new BadRequestException("name es obligatorio");
    const systemType = dto.systemType;
    if (!systemType || !["ON_GRID", "OFF_GRID", "HYBRID"].includes(systemType))
      throw new BadRequestException(
        "systemType debe ser ON_GRID, OFF_GRID o HYBRID",
      );
    const targetPowerKwp =
      dto.targetPowerKwp ??
      (systemType === "ON_GRID" ? 4 : systemType === "OFF_GRID" ? 6 : 5);
    const itemsConfig = BASE_ITEMS[systemType];
    if (!itemsConfig?.length)
      throw new BadRequestException("No hay ítems base para este tipo de sistema");
    const quoteKind = normalizeTemplateQuoteKindInput(dto.quoteKind);
    const maxSort = await this.prisma.quoteTemplate.aggregate({
      _max: { sortOrder: true },
    });
    const sortOrder = (maxSort._max.sortOrder ?? -1) + 1;
    const template = await this.prisma.$transaction(async (tx) => {
      const t = await tx.quoteTemplate.create({
        data: {
          name,
          quoteKind,
          systemType,
          targetPowerKwp,
          description: dto.description?.trim() ?? null,
          sortOrder,
          active: true,
        },
      });
      for (const it of itemsConfig) {
        const item = await tx.quoteTemplateItem.create({
          data: {
            quoteTemplateId: t.id,
            sortOrder: it.sortOrder,
            itemType: it.itemType,
            quantityRule: it.quantityRule,
            quantityFixed: it.quantityFixed,
            potenciaPorPanelWp: it.potenciaPorPanelWp,
            productNameSnapshot: it.productNameSnapshot,
            productDescriptionSnapshot: it.productDescriptionSnapshot,
          },
        });
        await tx.quoteTemplateLine.create({
          data: {
            quoteTemplateItemId: item.id,
            sortOrder: 0,
            source: "MANUAL",
            productNameSnapshot: it.productNameSnapshot,
            productDescriptionSnapshot: it.productDescriptionSnapshot,
            quantityRule: it.quantityRule,
            quantityFixed: it.quantityFixed,
            potenciaPorPanelWp: it.potenciaPorPanelWp,
            unitPriceDefault: 0,
            visibleInFinalQuoteDefault: false,
          },
        });
      }
      return t;
    });
    return this.findOne(template.id);
  }

  async createQuoteFromTemplate(
    templateId: string,
    dto: CreateQuoteFromTemplateDto,
    currentUser: AuthUserPayload,
  ) {
    const roles = currentUser.roles ?? [];
    if (!hasSalesLikePrivileges(roles)) {
      throw new ForbiddenException("Sin permiso para crear cotización desde plantilla");
    }
    const template = await this.prisma.quoteTemplate.findFirst({
      where: { id: templateId, active: true },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            lines: { orderBy: { sortOrder: "asc" }, include: { product: true } },
          },
        },
      },
    });
    if (!template) throw new NotFoundException("Plantilla no encontrada o inactiva");
    if (template.quoteKind === "MARGIN") {
      throw new BadRequestException(
        "Aún no es posible crear una cotización desde una plantilla con margen. Use una plantilla estándar o cree la cotización con margen por el flujo correspondiente.",
      );
    }
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException("Cliente no encontrado");
    let sourceFvStudyId: string | null = null;
    const rawStudyId = dto.fvStudyId?.trim();
    if (rawStudyId) {
      const study = await this.prisma.fvStudy.findUnique({
        where: { id: rawStudyId },
      });
      if (!study) throw new NotFoundException("Estudio FV no encontrado");
      if (study.clientId !== client.id) {
        throw new BadRequestException(
          "El estudio FV no pertenece al cliente de la cotización",
        );
      }
      sourceFvStudyId = study.id;
    }
    const targetPowerKwp = toNum(template.targetPowerKwp);
    const currency = dto.currency?.trim() || "CLP";
    const title =
      dto.title?.trim() || `Cotización ${template.name} - ${client.name}`;
    const result = await this.prisma.$transaction(async (tx) => {
      const sellerInitials = cnCommercial.sellerInitialsForCommercialNumber({
        fullName: currentUser.fullName,
        name: currentUser.name,
        email: currentUser.email,
      });
      const { commercialSequence, commercialNumber } =
        await cnCommercial.getNextCommercialNumber(tx, "RESIDENCIAL", {
          sellerInitials,
        });
      const quote = await tx.quote.create({
        data: {
          clientId: client.id,
          ownerId: currentUser.id,
          sourceQuoteTemplateId: template.id,
          sourceFvStudyId: sourceFvStudyId ?? undefined,
          status: "BORRADOR",
          title,
          projectType: "RESIDENCIAL",
          currency,
          commercialSequence,
          commercialNumber,
        },
      });
      const version = await tx.quoteVersion.create({
        data: {
          quoteId: quote.id,
          versionNumber: 1,
          status: "BORRADOR",
          subtotal: 0,
          discountsTotal: 0,
          marginTotal: 0,
          taxesTotal: 0,
          total: 0,
          vatPercent: 19,
          createdById: currentUser.id,
        },
      });
      const cantidadPaneles = (() => {
        const panelesItem = template.items.find((i) => i.itemType === "PANELES");
        if (!panelesItem) return 0;
        const wp = panelesItem.potenciaPorPanelWp ?? 400;
        return Math.ceil((targetPowerKwp * 1000) / wp);
      })();
      const replacePlaceholders = (text: string | null | undefined) => {
        if (!text) return "";
        return text
          .replace(/\{\{cantidadPaneles\}\}/g, String(cantidadPaneles))
          .replace(/\{\{targetPowerKwp\}\}/g, String(targetPowerKwp));
      };
      const now = new Date();
      for (const item of template.items) {
        const mainDescRaw = replacePlaceholders(item.productDescriptionSnapshot ?? "");
        const mainDesc = mainDescRaw.trim() ? mainDescRaw : null;
        const mainItem = await tx.quoteMainItem.create({
          data: {
            quoteVersionId: version.id,
            name: item.productNameSnapshot,
            description: mainDesc,
            sortOrder: item.sortOrder,
            visibleInFinalQuote: item.visibleInFinalQuoteDefault,
            totalMode: "SUM_LINES",
            totalOverride: null,
          },
        });
        const lines = item.lines ?? [];
        if (lines.length > 0) {
          for (let idx = 0; idx < lines.length; idx++) {
            const line = lines[idx];
            const qty =
              line.quantityRule === "DERIVED_FROM_POWER"
                ? Math.ceil(
                    (targetPowerKwp * 1000) / (line.potenciaPorPanelWp ?? 400),
                  )
                : (line.quantityFixed ?? 1);
            let name = line.productNameSnapshot ?? "";
            let desc: string | null = line.productDescriptionSnapshot ?? null;
            if (line.source === "FROM_CATALOG" && line.product) {
              if (!name) name = commercialNameForQuoteLine(line.product);
              if (desc == null && line.product.description)
                desc = line.product.description;
            }
            name = replacePlaceholders(name);
            desc = desc ? replacePlaceholders(desc) : null;
            let unitPrice = toNum(line.unitPriceDefault) || 0;
            let lineCurrency = line.currency?.trim() || currency;
            if (line.source === "FROM_CATALOG" && line.productId) {
              const vigentPrice = await tx.productPrice.findFirst({
                where: {
                  productId: line.productId,
                  validFrom: { lte: now },
                  OR: [{ validTo: null }, { validTo: { gte: now } }],
                },
                orderBy: { validFrom: "desc" },
              });
              if (vigentPrice) {
                unitPrice = toNum(vigentPrice.price);
                lineCurrency = vigentPrice.currency ?? lineCurrency;
              }
            }
            const lineTotal = qty * unitPrice;
            const prod = line.product as
              | {
                  categoryId?: string | null;
                  brandId?: string | null;
                  modelId?: string | null;
                  brandNameFree?: string | null;
                  brand?: { name?: string | null } | null;
                  modelNameFree?: string | null;
                  model?: { name?: string | null } | null;
                }
              | null
              | undefined;
            await tx.quoteItemLine.create({
              data: {
                quoteMainItemId: mainItem.id,
                productId: line.productId,
                categoryId: prod?.categoryId ?? null,
                brandId: prod?.brandId ?? null,
                modelId: prod?.modelId ?? null,
                productNameSnapshot: name || "—",
                productDescriptionSnapshot: desc,
                categoryNameSnapshot: null,
                brandNameSnapshot:
                  prod?.brandNameFree ?? prod?.brand?.name ?? null,
                modelNameSnapshot:
                  prod?.modelNameFree ?? prod?.model?.name ?? null,
                currencySnapshot: lineCurrency,
                unitPriceSnapshot: unitPrice,
                unitCostSnapshot: null,
                discountPercentSnapshot: 0,
                marginPercentSnapshot: null,
                quantity: qty,
                lineTotalSnapshot: lineTotal,
                sortOrder: idx,
                visibleInFinalQuote: line.visibleInFinalQuoteDefault ?? false,
                configSnapshot: null,
              },
            });
          }
        } else {
          const qty =
            item.quantityRule === "DERIVED_FROM_POWER"
              ? Math.ceil(
                  (targetPowerKwp * 1000) / (item.potenciaPorPanelWp ?? 400),
                )
              : (item.quantityFixed ?? 1);
          let desc = replacePlaceholders(item.productDescriptionSnapshot ?? "");
          const unitPrice = toNum(item.unitPriceDefault) || 0;
          const lineTotal = qty * unitPrice;
          await tx.quoteItemLine.create({
            data: {
              quoteMainItemId: mainItem.id,
              productId: null,
              categoryId: null,
              brandId: null,
              modelId: null,
              productNameSnapshot: item.productNameSnapshot,
              productDescriptionSnapshot: desc || null,
              categoryNameSnapshot: null,
              brandNameSnapshot: null,
              modelNameSnapshot: null,
              currencySnapshot: currency,
              unitPriceSnapshot: unitPrice,
              unitCostSnapshot: null,
              discountPercentSnapshot: 0,
              marginPercentSnapshot: null,
              quantity: qty,
              lineTotalSnapshot: lineTotal,
              sortOrder: 0,
              visibleInFinalQuote: false,
              configSnapshot: null,
            },
          });
        }
      }
      await this.quoteVersionsService.recalcVersionTotalsTx(tx, version.id);
      if (sourceFvStudyId) {
        await tx.fvStudy.update({
          where: { id: sourceFvStudyId },
          data: { status: "COTIZADO" },
        });
      }
      return { quote, version };
    });
    return {
      quote: mapQuoteResponse(result.quote),
      version: {
        id: result.version.id,
        versionNumber: result.version.versionNumber,
        status: result.version.status,
      },
    };
  }

  async updateTemplate(id: string, dto: UpdateQuoteTemplateDto) {
    const template = await this.prisma.quoteTemplate.findUnique({
      where: { id },
    });
    if (!template) throw new NotFoundException("Plantilla no encontrada");
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.systemType !== undefined) data.systemType = dto.systemType;
    if (dto.targetPowerKwp !== undefined) data.targetPowerKwp = dto.targetPowerKwp;
    if (dto.description !== undefined)
      data.description = dto.description?.trim() ?? null;
    if (dto.active !== undefined) data.active = dto.active;
    if (Object.keys(data).length === 0) return this.findOne(id);
    const updated = await this.prisma.quoteTemplate.update({
      where: { id },
      data,
    });
    return this.findOne(updated.id);
  }

  async updateTemplateItem(
    templateId: string,
    itemId: string,
    dto: UpdateTemplateItemDto,
  ) {
    const item = await this.prisma.quoteTemplateItem.findUnique({
      where: { id: itemId },
      include: { quoteTemplate: true },
    });
    if (!item || item.quoteTemplate.id !== templateId) {
      throw new NotFoundException("Ítem de plantilla no encontrado");
    }
    const data: Record<string, unknown> = {};
    if (dto.productNameSnapshot !== undefined) {
      const n = dto.productNameSnapshot.trim();
      if (!n)
        throw new BadRequestException("El nombre del bloque no puede estar vacío");
      data.productNameSnapshot = n;
    }
    if (dto.productDescriptionSnapshot !== undefined) {
      const raw = dto.productDescriptionSnapshot;
      data.productDescriptionSnapshot =
        raw === null || String(raw).trim() === "" ? null : String(raw).trim();
    }
    if (dto.visibleInFinalQuoteDefault !== undefined) {
      data.visibleInFinalQuoteDefault = dto.visibleInFinalQuoteDefault;
    }
    if (Object.keys(data).length === 0) return this.findOne(templateId);
    await this.prisma.quoteTemplateItem.update({
      where: { id: itemId },
      data,
    });
    return this.findOne(templateId);
  }

  async createLine(
    templateId: string,
    itemId: string,
    dto: CreateTemplateLineDto,
  ) {
    const template = await this.prisma.quoteTemplate.findFirst({
      where: { id: templateId, active: true },
      include: { items: true },
    });
    if (!template) throw new NotFoundException("Plantilla no encontrada");
    const item = template.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException("Ítem de plantilla no encontrado");
    if (
      dto.source === "MANUAL" &&
      (!dto.productNameSnapshot || !dto.productNameSnapshot.trim())
    )
      throw new BadRequestException(
        "productNameSnapshot es obligatorio para línea manual",
      );
    const maxSort = await this.prisma.quoteTemplateLine.findFirst({
      where: { quoteTemplateItemId: itemId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;
    const line = await this.prisma.quoteTemplateLine.create({
      data: {
        quoteTemplateItemId: itemId,
        sortOrder,
        source: dto.source,
        productId: dto.productId?.trim() || null,
        productNameSnapshot: dto.productNameSnapshot?.trim() ?? null,
        productDescriptionSnapshot: dto.productDescriptionSnapshot?.trim() ?? null,
        quantityRule: dto.quantityRule,
        quantityFixed: dto.quantityFixed ?? null,
        potenciaPorPanelWp: dto.potenciaPorPanelWp ?? null,
        unitPriceDefault: dto.unitPriceDefault ?? 0,
        currency: dto.currency?.trim() ?? null,
        visibleInFinalQuoteDefault: dto.visibleInFinalQuoteDefault ?? false,
      },
    });
    return line;
  }

  async updateLine(
    templateId: string,
    lineId: string,
    dto: UpdateTemplateLineDto,
  ) {
    const line = await this.prisma.quoteTemplateLine.findUnique({
      where: { id: lineId },
      include: { quoteTemplateItem: { include: { quoteTemplate: true } } },
    });
    if (!line || line.quoteTemplateItem.quoteTemplate.id !== templateId)
      throw new NotFoundException("Línea de plantilla no encontrada");
    const data: Record<string, unknown> = {};
    if (dto.productNameSnapshot !== undefined)
      data.productNameSnapshot = dto.productNameSnapshot?.trim() ?? null;
    if (dto.productDescriptionSnapshot !== undefined)
      data.productDescriptionSnapshot =
        dto.productDescriptionSnapshot?.trim() ?? null;
    if (dto.quantityRule !== undefined) data.quantityRule = dto.quantityRule;
    if (dto.quantityFixed !== undefined) data.quantityFixed = dto.quantityFixed;
    if (dto.potenciaPorPanelWp !== undefined)
      data.potenciaPorPanelWp = dto.potenciaPorPanelWp;
    if (dto.unitPriceDefault !== undefined)
      data.unitPriceDefault = dto.unitPriceDefault;
    if (dto.currency !== undefined) data.currency = dto.currency?.trim() ?? null;
    if (dto.visibleInFinalQuoteDefault !== undefined)
      data.visibleInFinalQuoteDefault = dto.visibleInFinalQuoteDefault;
    if (Object.keys(data).length === 0) return line;
    return this.prisma.quoteTemplateLine.update({
      where: { id: lineId },
      data,
    });
  }

  async deleteLine(templateId: string, lineId: string) {
    const line = await this.prisma.quoteTemplateLine.findUnique({
      where: { id: lineId },
      include: { quoteTemplateItem: { include: { quoteTemplate: true } } },
    });
    if (!line || line.quoteTemplateItem.quoteTemplate.id !== templateId)
      throw new NotFoundException("Línea de plantilla no encontrada");
    await this.prisma.quoteTemplateLine.delete({ where: { id: lineId } });
    return { deleted: true };
  }
}

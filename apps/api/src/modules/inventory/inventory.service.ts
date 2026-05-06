import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { ImportOqcPanelsDto } from "./dto/import-oqc-panels.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { INVENTORY_DESTINATION_KINDS, type InventoryDestinationKind } from "./inventory.constants";
import {
  isEge2026Oqc720ReportRef,
  OQC_PRESET_EGE2026_2356_META,
  OQC_PRESET_EGE2026_2356_PANELS,
  type OqcPresetPanelRow,
} from "./oqc-preset-ege2026-2356";
import { parseOqcShipmentBuffer } from "./oqc-spreadsheet.parser";
import { buildOqcInventoryUncheckedCreateInput } from "./oqc-serial-item-builder";
import {
  inferFamilyKeyLabel,
  parseTraceability,
  unitValueFromLatestPriceRow,
  type InventoryKpiByFamilyRow,
  type InventoryKpiByProjectRow,
  type InventoryKpiDashboardDto,
  type InventoryKpiNonActiveHoldRow,
  type InventoryKpiTopLine,
} from "./inventory-kpi.util";
import {
  type InventoryTransportOverviewDto,
  type InventoryTransportOverviewGroupDto,
  findGroundTransportRowForPallet,
  mergeTransportPatchIntoLinksJson,
  parseGroundTransportJson,
  palletIdFromLinks,
  parseLinksJsonObject,
  rowMatchesTransportOverview,
  traceabilityLabelForRow,
  transportPatchForLinksJson,
  transportSummaryFromLinks,
  tripNumberFromLinks,
  upsertGroundTransportRowForPallet,
} from "./inventory-transport-overview";

const includeRelations = {
  project: { select: { id: true, code: true, name: true } },
  quote: { select: { id: true, title: true, commercialNumber: true } },
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  },
};

function assertKind(k: string): asserts k is InventoryDestinationKind {
  if (!INVENTORY_DESTINATION_KINDS.includes(k as InventoryDestinationKind)) {
    throw new BadRequestException(`destinationKind inválido: ${k}`);
  }
}

function normalizeLinksJson(raw: string | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  const t = String(raw).trim();
  if (!t) return null;
  try {
    JSON.parse(t);
  } catch {
    throw new BadRequestException("linksJson debe ser JSON válido");
  }
  return t;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDestination(
    kind: InventoryDestinationKind,
    projectId: string | null | undefined,
    quoteId: string | null | undefined,
    note: string | null | undefined,
  ) {
    if (kind === "PROJECT") {
      const pid = projectId?.trim();
      if (!pid) throw new BadRequestException("Para destino PROJECT debe indicar projectId");
    }
    if (kind === "QUOTE") {
      const qid = quoteId?.trim();
      if (!qid) throw new BadRequestException("Para destino QUOTE debe indicar quoteId");
    }
    if (kind === "SALES_LOCAL" || kind === "GENERAL") {
      if (projectId?.trim()) {
        throw new BadRequestException("Para SALES_LOCAL o GENERAL no debe asociar projectId (deje vacío)");
      }
      if (quoteId?.trim()) {
        throw new BadRequestException("Para SALES_LOCAL o GENERAL no debe asociar quoteId (deje vacío)");
      }
    }
    // OTHER: sin reglas estrictas; use destinationNote y/o linksJson para detallar.
  }

  private async ensureRefs(projectId: string | null, quoteId: string | null, productId: string | null) {
    if (projectId) {
      const n = await this.prisma.project.count({ where: { id: projectId } });
      if (!n) throw new BadRequestException("Proyecto no encontrado");
    }
    if (quoteId) {
      const n = await this.prisma.quote.count({ where: { id: quoteId } });
      if (!n) throw new BadRequestException("Cotización no encontrada");
    }
    if (productId) {
      const n = await this.prisma.product.count({ where: { id: productId } });
      if (!n) throw new BadRequestException("Producto de catálogo no encontrado");
    }
  }

  async list(filters: {
    destinationKind?: string;
    projectId?: string;
    quoteId?: string;
    productId?: string;
    search?: string;
    /** Coincide con texto en ubicación, JSON de vínculos (p. ej. palletNumber) o descripción. */
    pallet?: string;
  }) {
    const andParts: Prisma.InventoryItemWhereInput[] = [];
    const q = filters.search?.trim();
    if (q) {
      andParts.push({
        OR: [
          { name: { contains: q } },
          { sku: { contains: q } },
          { description: { contains: q } },
          { linksJson: { contains: q } },
          { storageLocation: { contains: q } },
          { destinationNote: { contains: q } },
        ],
      });
    }
    const palletQ = filters.pallet?.trim();
    if (palletQ) {
      andParts.push({
        OR: [
          { storageLocation: { contains: palletQ } },
          { linksJson: { contains: palletQ } },
          { description: { contains: palletQ } },
        ],
      });
    }
    if (filters.productId?.trim()) {
      andParts.push({ productId: filters.productId.trim() });
    }
    if (filters.quoteId?.trim()) {
      andParts.push({ quoteId: filters.quoteId.trim() });
    }

    const pid = filters.projectId?.trim();
    const dest = filters.destinationKind?.trim();
    if (pid) {
      if (dest) {
        assertKind(dest);
        andParts.push({
          OR: [
            { AND: [{ destinationKind: dest }, { projectId: pid }] },
            // Relación tras `prisma generate` (InventoryItem.logisticsInternationalSnapshot).
            { logisticsInternationalSnapshot: { projectId: pid } } as Prisma.InventoryItemWhereInput,
          ],
        });
      } else {
        andParts.push({
          OR: [
            { projectId: pid },
            { logisticsInternationalSnapshot: { projectId: pid } } as Prisma.InventoryItemWhereInput,
          ],
        });
      }
    } else if (dest) {
      assertKind(dest);
      andParts.push({ destinationKind: dest });
    }

    const where: Prisma.InventoryItemWhereInput = andParts.length ? { AND: andParts } : {};
    return this.prisma.inventoryItem.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: includeRelations,
    });
  }

  async create(dto: CreateInventoryItemDto) {
    const kind = (dto.destinationKind?.trim() || "GENERAL") as InventoryDestinationKind;
    assertKind(kind);
    const projectId = dto.projectId?.trim() || null;
    const quoteId = dto.quoteId?.trim() || null;
    const productId = dto.productId?.trim() || null;
    let effProject = projectId;
    let effQuote = quoteId;
    if (kind === "SALES_LOCAL" || kind === "GENERAL") {
      effProject = null;
      effQuote = null;
    }
    if (kind === "PROJECT") effQuote = null;
    if (kind === "QUOTE") effProject = null;
    this.validateDestination(kind, effProject, effQuote, dto.destinationNote ?? null);
    await this.ensureRefs(effProject, effQuote, productId);
    const linksJson = normalizeLinksJson(dto.linksJson);
    const snapId = dto.logisticsInternationalSnapshotId?.trim() || null;
    if (snapId) {
      const n = await this.prisma.logisticsInternationalSnapshot.count({ where: { id: snapId } });
      if (!n) throw new BadRequestException("Importación logística (snapshot) no encontrada");
    }
    const row = await this.prisma.inventoryItem.create({
      data: {
        sku: dto.sku?.trim() || null,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        quantity: dto.quantity,
        unit: (dto.unit?.trim() || "unidad").slice(0, 64),
        storageLocation: dto.storageLocation?.trim() || null,
        destinationKind: kind,
        destinationNote: dto.destinationNote?.trim() || null,
        projectId: effProject,
        quoteId: effQuote,
        productId,
        linksJson,
        logisticsInternationalSnapshotId: snapId,
      } as Prisma.InventoryItemUncheckedCreateInput,
      include: includeRelations,
    });
    return row;
  }

  async update(id: string, dto: UpdateInventoryItemDto) {
    const cur = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException("Ítem de inventario no encontrado");

    const kind = (dto.destinationKind?.trim() || cur.destinationKind) as string;
    assertKind(kind);
    const nextName = dto.name !== undefined ? dto.name.trim() : cur.name;
    if (!nextName) throw new BadRequestException("name no puede quedar vacío");

    let effProject = dto.projectId !== undefined ? dto.projectId?.trim() || null : cur.projectId;
    let effQuote = dto.quoteId !== undefined ? dto.quoteId?.trim() || null : cur.quoteId;
    const productId = dto.productId !== undefined ? dto.productId?.trim() || null : cur.productId;
    const note = dto.destinationNote !== undefined ? dto.destinationNote?.trim() || null : cur.destinationNote;

    if (kind === "SALES_LOCAL" || kind === "GENERAL") {
      effProject = null;
      effQuote = null;
    }
    if (kind === "PROJECT") effQuote = null;
    if (kind === "QUOTE") effProject = null;

    this.validateDestination(kind as InventoryDestinationKind, effProject, effQuote, note);
    await this.ensureRefs(effProject, effQuote, productId);

    const data: Prisma.InventoryItemUpdateInput = {
      name: nextName,
      destinationKind: kind,
      project: effProject ? { connect: { id: effProject } } : { disconnect: true },
      quote: effQuote ? { connect: { id: effQuote } } : { disconnect: true },
      product: productId ? { connect: { id: productId } } : { disconnect: true },
      destinationNote: note,
    };
    if (dto.sku !== undefined) data.sku = dto.sku?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.quantity !== undefined) data.quantity = dto.quantity;
    if (dto.unit !== undefined) data.unit = (dto.unit?.trim() || "unidad").slice(0, 64);
    if (dto.storageLocation !== undefined) data.storageLocation = dto.storageLocation?.trim() || null;
    if (dto.linksJson !== undefined) data.linksJson = normalizeLinksJson(dto.linksJson);
    if (dto.logisticsInternationalSnapshotId !== undefined) {
      const sid = dto.logisticsInternationalSnapshotId?.trim() || null;
      if (sid) {
        const n = await this.prisma.logisticsInternationalSnapshot.count({ where: { id: sid } });
        if (!n) throw new BadRequestException("Importación logística (snapshot) no encontrada");
        (data as Prisma.InventoryItemUpdateInput & { logisticsInternationalSnapshot?: object }).logisticsInternationalSnapshot =
          { connect: { id: sid } };
      } else {
        (data as Prisma.InventoryItemUpdateInput & { logisticsInternationalSnapshot?: object }).logisticsInternationalSnapshot =
          { disconnect: true };
      }
    }

    return this.prisma.inventoryItem.update({
      where: { id },
      data,
      include: includeRelations,
    });
  }

  async remove(id: string) {
    const cur = await this.prisma.inventoryItem.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException("Ítem de inventario no encontrado");
    await this.prisma.inventoryItem.delete({ where: { id } });
    return { ok: true as const, id };
  }

  private async resolveProjectForOqc(dto: ImportOqcPanelsDto): Promise<{ id: string; code: string }> {
    const pidIn = dto.projectId?.trim();
    const codeIn = dto.projectCode?.trim();
    if (!pidIn && !codeIn) {
      throw new BadRequestException("Indique projectId o projectCode (p. ej. CSO)");
    }
    if (pidIn) {
      const p = await this.prisma.project.findUnique({ where: { id: pidIn }, select: { id: true, code: true } });
      if (!p) throw new BadRequestException("Proyecto no encontrado");
      return p;
    }
    const want = codeIn!.toUpperCase();
    const all = await this.prisma.project.findMany({ select: { id: true, code: true } });
    let hit = all.find((x) => x.code.toUpperCase() === want);
    if (!hit && want === "CSO") {
      try {
        hit = await this.prisma.project.create({
          data: {
            code: "CSO",
            name: "PARQUE FOTOVOLTAICO CERRO SOMBRERO",
            client: "Mandante / SPV proyecto FV (referencia CSO)",
            location: "Cerro Sombrero, Magallanes, Chile",
            status: "IN_PROGRESS",
            progress: 0,
            description: "Proyecto creado automáticamente al importar inventario OQC (Eco Green). Puede editar datos en Proyectos.",
          },
          select: { id: true, code: true },
        });
      } catch {
        const again = await this.prisma.project.findUnique({ where: { code: "CSO" }, select: { id: true, code: true } });
        if (again) hit = again;
      }
    }
    if (!hit) throw new BadRequestException(`No hay proyecto con código «${codeIn}»`);
    return hit;
  }

  /** Prioriza EGE-720W / 132N / GM12 frente a variantes 630 W al vincular catálogo en import OQC. */
  private static scoreOqcCatalogProductName(name: string): number {
    const n = name.toLowerCase();
    let s = 0;
    if (/ege[- ]?720|720w|132n|\bgm12\b/i.test(n)) s += 14;
    if (/\b720\b/.test(n)) s += 5;
    if (/ecogreen|eco\s*green/i.test(n)) s += 3;
    if (/\b630\b/.test(n) && !/\b720\b/.test(n) && !/720w/i.test(n)) s -= 6;
    return s;
  }

  /** Si existe alguna ficha ACTIVA que indique módulo 720 W, no mezclar con variantes solo 630 W. */
  private static productNameSuggestsOqc720W(name: string): boolean {
    return /\b720\b|720w|132n|\bgm12\b|ege[- ]?720/i.test(name);
  }

  /** Nombre de ficha que solo refleja 630 W (sin señales 720): no debe quedar vinculada a un lote OQC informado como 720 W. */
  private static productNameLooksLikeMisleading630Only(name: string): boolean {
    const n = name.toLowerCase();
    if (!/\b630\b|630w/i.test(n)) return false;
    if (/\b720\b|720w|132n|\bgm12\b|ege[- ]?720/i.test(n)) return false;
    return true;
  }

  /** Informe OQC del lote EGE 720 W (referencia en linksJson o nota de trazabilidad). */
  private static rowMatchesOqcEge720Report(linksJson: string | null, destinationNote: string | null): boolean {
    let ref = "";
    if (linksJson?.trim()) {
      try {
        const j = JSON.parse(linksJson) as { traceability?: string; reportRef?: string };
        if (j.traceability === "OQC_SERIAL_PANEL") {
          ref = String(j.reportRef ?? "").trim();
        }
      } catch {
        /* ignore */
      }
    }
    const refEff = ref || InventoryService.extractOqcReportRefFromDestinationNote(destinationNote);
    return isEge2026Oqc720ReportRef(refEff);
  }

  private async resolvePanelProductId(explicit: string | null): Promise<string | null> {
    if (explicit) {
      const n = await this.prisma.product.count({ where: { id: explicit } });
      if (!n) throw new BadRequestException("productId no encontrado en catálogo");
      return explicit;
    }
    const candidates = await this.prisma.product.findMany({
      where: {
        commercialStatus: "ACTIVO",
        OR: [
          { name: { contains: "Ecogreen" } },
          { name: { contains: "ECOGREEN" } },
          { name: { contains: "Eco Green" } },
          { name: { contains: "EGE" } },
        ],
      },
      select: { id: true, name: true },
      take: 80,
    });
    if (!candidates.length) return null;
    const prefer720 = candidates.filter((p) => InventoryService.productNameSuggestsOqc720W(p.name));
    const pool = prefer720.length ? prefer720 : candidates;
    const scored = [...pool].sort(
      (a, b) => InventoryService.scoreOqcCatalogProductName(b.name) - InventoryService.scoreOqcCatalogProductName(a.name),
    );
    return scored[0]?.id ?? null;
  }

  /** No vincular informe 720 W a una ficha de catálogo que sea solo 630 W (mejor sin vínculo que dato falso). */
  private async oqcProductIdAfterCatalogSanity(productId: string | null, reportRef: string): Promise<string | null> {
    if (!productId || !isEge2026Oqc720ReportRef(reportRef)) return productId;
    const p = await this.prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
    if (!p?.name) return productId;
    if (InventoryService.productNameLooksLikeMisleading630Only(p.name)) return null;
    return productId;
  }

  private buildOqcRows(dto: ImportOqcPanelsDto): OqcPresetPanelRow[] {
    if (dto.preset === "EGE2026_OQC_2356") {
      return OQC_PRESET_EGE2026_2356_PANELS;
    }
    const raw = dto.panels;
    if (!raw?.length) {
      throw new BadRequestException("Indique preset «EGE2026_OQC_2356» o envíe panels[] con al menos una fila");
    }
    return raw.map((r, idx) => {
      const serialNumber = r.serialNumber.trim();
      if (!serialNumber) throw new BadRequestException("Cada fila debe tener serialNumber");
      const sheetProductName = r.sheetProductName?.trim() ? r.sheetProductName.trim().slice(0, 240) : undefined;
      return {
        itemN: r.itemN ?? idx + 1,
        serialNumber,
        palletNumber: (r.palletNumber ?? "").trim() || "—",
        ffPercent: r.ffPercent,
        isc: r.isc,
        voc: r.voc,
        imp: r.imp,
        vmp: r.vmp,
        pmW: r.pmW,
        sheetProductName: sheetProductName || undefined,
      };
    });
  }

  /**
   * Inserta filas OQC (una por serial). Omite serial vacío, duplicados en archivo y serial ya existente en proyecto+PROJECT.
   */
  /** Comparación de SKU/serial sin distinguir mayúsculas (evita duplicados ETND vs etnd). */
  private static normSerialSku(s: string): string {
    return s.trim().toUpperCase();
  }

  private static extractOqcReportRefFromDestinationNote(note: string | null | undefined): string {
    if (!note?.trim()) return "";
    const m = note.match(/Trazabilidad OQC\s*[\u2014\-]\s*(.+)/i);
    return (m?.[1] ?? "").trim().slice(0, 500);
  }

  /** Paneles importados por OQC: serial ETND, JSON de trazabilidad, o nombre típico «Panel OQC #… · ETND…». */
  private static isOqcSerialPanelRow(linksJson: string | null, sku: string | null, name?: string | null): boolean {
    const s = sku?.trim();
    if (s && /^ETND/i.test(s)) return true;
    const n = name?.trim() ?? "";
    if (n && /panel\s+oqc\s*#/i.test(n) && /ETND/i.test(n)) return true;
    if (!linksJson?.trim()) return false;
    try {
      const j = JSON.parse(linksJson) as { traceability?: string };
      return j.traceability === "OQC_SERIAL_PANEL";
    } catch {
      return false;
    }
  }

  /**
   * Completa linksJson con modelo 720 W del informe cuando falta (importaciones antiguas por Excel).
   */
  private static mergeEge720IntoLinksJson(
    linksJson: string | null,
    destinationNote: string | null,
  ): { next: string | null; changed: boolean } {
    if (!linksJson?.trim()) return { next: null, changed: false };
    let j: Record<string, unknown>;
    try {
      j = JSON.parse(linksJson) as Record<string, unknown>;
    } catch {
      return { next: null, changed: false };
    }
    if (j.traceability !== "OQC_SERIAL_PANEL") return { next: linksJson, changed: false };
    const refRaw = String(j.reportRef ?? "").trim();
    const refEff = refRaw || InventoryService.extractOqcReportRefFromDestinationNote(destinationNote);
    if (!isEge2026Oqc720ReportRef(refEff)) return { next: linksJson, changed: false };
    if (j.productModel && String(j.productModel).trim()) return { next: linksJson, changed: false };
    j.manufacturer = OQC_PRESET_EGE2026_2356_META.manufacturer;
    j.productModel = OQC_PRESET_EGE2026_2356_META.productModel;
    j.productSpecsShort = OQC_PRESET_EGE2026_2356_META.productSpecsShort;
    const next = JSON.stringify(j);
    return { next, changed: next !== linksJson };
  }

  /**
   * Sanitiza filas OQC del proyecto: enriquece linksJson (modelo 720 informe), vincula catálogo solo si la ficha
   * no es engañosa (solo 630 W), y **desvincula** productId en informes 720 cuando el catálogo solo ofrece 630 W
   * (conserva serial, medidas, notas y JSON; no borra ítems).
   */
  async relinkOqcPanelCatalogForProject(projectId: string) {
    const pid = projectId.trim();
    if (!pid) throw new BadRequestException("projectId es obligatorio");
    const n = await this.prisma.project.count({ where: { id: pid } });
    if (!n) throw new BadRequestException("Proyecto no encontrado");

    const toId = await this.resolvePanelProductId(null);
    const toProduct = toId
      ? await this.prisma.product.findUnique({ where: { id: toId }, select: { name: true } })
      : null;
    const targetIsAcceptableFor720Report =
      Boolean(toProduct?.name) && !InventoryService.productNameLooksLikeMisleading630Only(toProduct!.name);

    const items = await this.prisma.inventoryItem.findMany({
      where: { projectId: pid, destinationKind: "PROJECT" },
      select: { id: true, productId: true, sku: true, linksJson: true, destinationNote: true, name: true },
    });

    const scoreCache = new Map<string, number>();
    const scoreOf = async (productId: string) => {
      if (scoreCache.has(productId)) return scoreCache.get(productId)!;
      const p = await this.prisma.product.findUnique({ where: { id: productId }, select: { name: true } });
      const sc = p?.name ? InventoryService.scoreOqcCatalogProductName(p.name) : -999;
      scoreCache.set(productId, sc);
      return sc;
    };

    let rowsTouched = 0;
    let productRelinks = 0;
    let productUnlinks = 0;
    let linksJsonEnriched = 0;

    for (const it of items) {
      if (!InventoryService.isOqcSerialPanelRow(it.linksJson, it.sku, it.name)) continue;

      const { next: mergedLinks, changed: linksChanged } = InventoryService.mergeEge720IntoLinksJson(
        it.linksJson,
        it.destinationNote,
      );

      const is720Report = InventoryService.rowMatchesOqcEge720Report(it.linksJson, it.destinationNote);

      let nextProductId: string | null | undefined = undefined;

      if (is720Report) {
        if (toId && targetIsAcceptableFor720Report) {
          nextProductId = toId;
        } else {
          nextProductId = null;
        }
      } else if (toId && toProduct) {
        const toScore = InventoryService.scoreOqcCatalogProductName(toProduct.name);
        const curScore = it.productId ? await scoreOf(it.productId) : -999;
        if (it.productId && it.productId !== toId && curScore < toScore) {
          nextProductId = toId;
        }
      }

      const curPid = it.productId ?? null;
      const resolvedNext = nextProductId === undefined ? curPid : nextProductId;
      const productChanged = resolvedNext !== curPid;
      const linksPayload = linksChanged && mergedLinks ? mergedLinks : undefined;

      if (!productChanged && !linksPayload) continue;

      await this.prisma.inventoryItem.update({
        where: { id: it.id },
        data: {
          ...(productChanged ? { productId: resolvedNext } : {}),
          ...(linksPayload ? { linksJson: linksPayload } : {}),
        },
      });
      rowsTouched += 1;
      if (productChanged) {
        if (resolvedNext == null && curPid != null) productUnlinks += 1;
        else if (resolvedNext != null && resolvedNext !== curPid) productRelinks += 1;
      }
      if (linksPayload) linksJsonEnriched += 1;
    }

    return {
      projectId: pid,
      rowsTouched,
      productRelinks,
      productUnlinks,
      linksJsonEnriched,
      targetProductId: toId,
      targetProductName: toProduct?.name ?? null,
      targetAcceptableFor720Report: targetIsAcceptableFor720Report,
    };
  }

  /** Pin de borrado masivo inventario: solo servidor; variable `INVENTORY_PURGE_SECURITY_PIN` opcional en entorno. */
  private static inventoryPurgeSecurityExpected(): string {
    const fromEnv = process.env.INVENTORY_PURGE_SECURITY_PIN?.trim();
    return fromEnv && fromEnv.length >= 4 ? fromEnv : "2018";
  }

  /**
   * Elimina masivamente filas de `InventoryItem` en un proyecto (reimportación limpia).
   * No borra `Product`, cotizaciones ni el proyecto.
   */
  async purgeProjectInventoryItems(
    projectId: string,
    securityPin: string,
    scope: "OQC_PANELS_ONLY" | "ALL_PROJECT_DESTINATION",
  ) {
    const pid = projectId.trim();
    const pin = securityPin.trim();
    if (!pid) throw new BadRequestException("projectId es obligatorio");
    if (!pin) throw new BadRequestException("Debe indicar el código de seguridad.");

    const project = await this.prisma.project.findUnique({
      where: { id: pid },
      select: { id: true, code: true },
    });
    if (!project) throw new BadRequestException("Proyecto no encontrado");
    if (pin !== InventoryService.inventoryPurgeSecurityExpected()) {
      throw new BadRequestException("Código de seguridad incorrecto.");
    }

    if (scope === "ALL_PROJECT_DESTINATION") {
      const scanned = await this.prisma.inventoryItem.count({
        where: { projectId: pid, destinationKind: "PROJECT" },
      });
      const res = await this.prisma.inventoryItem.deleteMany({
        where: { projectId: pid, destinationKind: "PROJECT" },
      });
      return {
        projectId: pid,
        projectCode: project.code,
        scope,
        deleted: res.count,
        scanned,
      };
    }

    const rows = await this.prisma.inventoryItem.findMany({
      where: { projectId: pid, destinationKind: "PROJECT" },
      select: { id: true, sku: true, linksJson: true, name: true },
    });
    const ids = rows.filter((r) => InventoryService.isOqcSerialPanelRow(r.linksJson, r.sku, r.name)).map((r) => r.id);
    let deleted = 0;
    const CHUNK = 400;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      if (!chunk.length) continue;
      const res = await this.prisma.inventoryItem.deleteMany({ where: { id: { in: chunk } } });
      deleted += res.count;
    }
    return {
      projectId: pid,
      projectCode: project.code,
      scope,
      deleted,
      scanned: rows.length,
    };
  }

  private async insertOqcPanelRows(
    project: { id: string; code: string },
    rows: OqcPresetPanelRow[],
    opts: {
      productId: string | null;
      reportRef: string;
      sourceFileHint: string | null;
      preset: string | null;
      importMeta?: { importedByEmail: string | null; importedAtIso: string } | null;
    },
  ): Promise<{ created: number; skipped: number; createdIds: string[] }> {
    const existing = await this.prisma.inventoryItem.findMany({
      where: { projectId: project.id, destinationKind: "PROJECT", sku: { not: null } },
      select: { sku: true },
    });
    const existingSet = new Set(
      existing.map((e) => e.sku).filter((s): s is string => Boolean(s && s.trim())).map((s) => InventoryService.normSerialSku(s)),
    );

    let skipped = 0;
    const payloads: Prisma.InventoryItemUncheckedCreateInput[] = [];

    for (const row of rows) {
      const serial = row.serialNumber.trim();
      if (!serial) {
        skipped += 1;
        continue;
      }
      const serialKey = InventoryService.normSerialSku(serial);
      if (existingSet.has(serialKey)) {
        skipped += 1;
        continue;
      }
      existingSet.add(serialKey);
      payloads.push(
        buildOqcInventoryUncheckedCreateInput({
          row,
          projectId: project.id,
          projectCode: project.code,
          productId: opts.productId,
          reportRef: opts.reportRef,
          sourceFileHint: opts.sourceFileHint,
          preset: opts.preset,
          importMeta: opts.importMeta ?? null,
        }),
      );
    }

    const createdIds: string[] = [];
    const BATCH = 45;
    for (let i = 0; i < payloads.length; i += BATCH) {
      const slice = payloads.slice(i, i + BATCH);
      const part = await this.prisma.$transaction(slice.map((data) => this.prisma.inventoryItem.create({ data, select: { id: true } })));
      for (const row of part) {
        createdIds.push(row.id);
      }
    }

    return { created: createdIds.length, skipped, createdIds };
  }

  /**
   * Crea un InventoryItem por número de serie (SKU = serial), destino PROJECT, datos OQC en description y linksJson.
   * Omite filas si ya existe el mismo serial en el mismo proyecto con destino PROJECT.
   */
  async importOqcPanels(
    dto: ImportOqcPanelsDto,
    importActor?: { importedByEmail: string | null },
  ) {
    const project = await this.resolveProjectForOqc(dto);
    const rows = this.buildOqcRows(dto);
    const reportRef =
      dto.reportRef?.trim() ||
      (dto.preset === "EGE2026_OQC_2356" ? OQC_PRESET_EGE2026_2356_META.reportRef : "OQC import");
    const sourceFileHint =
      dto.sourceFileHint?.trim() ||
      (dto.preset === "EGE2026_OQC_2356" ? OQC_PRESET_EGE2026_2356_META.sourceFileHint : null);

    let productId = await this.resolvePanelProductId(dto.productId?.trim() || null);
    productId = await this.oqcProductIdAfterCatalogSanity(productId, reportRef);
    const importMeta = {
      importedByEmail: importActor?.importedByEmail?.trim() || null,
      importedAtIso: new Date().toISOString(),
    };
    const inner = await this.insertOqcPanelRows(project, rows, {
      productId,
      reportRef,
      sourceFileHint,
      preset: dto.preset ?? null,
      importMeta,
    });

    return {
      projectId: project.id,
      projectCode: project.code,
      created: inner.created,
      skipped: inner.skipped,
      createdIds: inner.createdIds,
      productLinked: Boolean(productId),
    };
  }

  async importOqcFromSpreadsheetBuffer(
    buffer: Buffer,
    originalName: string,
    q: {
      projectId?: string;
      projectCode?: string;
      productId?: string | null;
      reportRef?: string | null;
      sourceFileHint?: string | null;
      importMeta?: { importedByEmail: string | null; importedAtIso: string } | null;
    },
  ) {
    let parsed: ReturnType<typeof parseOqcShipmentBuffer>;
    try {
      parsed = parseOqcShipmentBuffer(buffer, originalName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo leer el archivo";
      throw new BadRequestException(msg);
    }

    const dto: ImportOqcPanelsDto = {
      projectId: q.projectId?.trim() || undefined,
      projectCode: q.projectCode?.trim() || undefined,
    };
    const project = await this.resolveProjectForOqc(dto);
    const reportRef = q.reportRef?.trim() || `OQC · ${originalName.slice(0, 180)}`;
    const sourceFileHint = q.sourceFileHint?.trim() || originalName.slice(0, 500);
    let productId = await this.resolvePanelProductId(q.productId?.trim() || null);
    productId = await this.oqcProductIdAfterCatalogSanity(productId, reportRef);

    const inner = await this.insertOqcPanelRows(project, parsed.panels, {
      productId,
      reportRef,
      sourceFileHint,
      preset: null,
      importMeta: {
        importedByEmail: q.importMeta?.importedByEmail?.trim() || null,
        importedAtIso: q.importMeta?.importedAtIso ?? new Date().toISOString(),
      },
    });

    return {
      projectId: project.id,
      projectCode: project.code,
      created: inner.created,
      skipped: inner.skipped,
      createdIds: inner.createdIds,
      productLinked: Boolean(productId),
      rowsInFile: parsed.panels.length,
      sheetsTried: parsed.sheetsTried,
      parseWarnings: parsed.parseWarnings,
    };
  }

  /** Seriales repetidos (mismo SKU normalizado) en destino PROJECT de un proyecto. */
  async listDuplicateOqcSerials(projectId: string) {
    const pid = projectId.trim();
    if (!pid) throw new BadRequestException("projectId es obligatorio");
    const n = await this.prisma.project.count({ where: { id: pid } });
    if (!n) throw new BadRequestException("Proyecto no encontrado");

    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        projectId: pid,
        destinationKind: "PROJECT",
        AND: [{ sku: { not: null } }, { sku: { not: "" } }],
      },
      select: { id: true, sku: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const groups = new Map<string, { id: string; sku: string; name: string; createdAt: Date }[]>();
    for (const r of rows) {
      const k = InventoryService.normSerialSku(r.sku!);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push({ id: r.id, sku: r.sku!, name: r.name, createdAt: r.createdAt });
    }
    const duplicateSerials = [...groups.entries()]
      .filter(([, arr]) => arr.length > 1)
      .map(([skuNormalized, arr]) => ({
        sku: arr[0].sku,
        skuNormalized,
        count: arr.length,
        rows: arr.map((x) => ({ id: x.id, name: x.name, createdAt: x.createdAt.toISOString() })),
      }));
    const extraDuplicateRows = duplicateSerials.reduce((s, d) => s + (d.count - 1), 0);
    return { projectId: pid, duplicateSerials, extraDuplicateRows };
  }

  /**
   * Elimina filas duplicadas por serial (SKU) en un proyecto, destino PROJECT.
   * Conserva la más antigua o la más reciente según `keep`.
   */
  async deduplicateOqcSerials(projectId: string, keep: "OLDEST" | "NEWEST") {
    const pid = projectId.trim();
    if (!pid) throw new BadRequestException("projectId es obligatorio");
    const n = await this.prisma.project.count({ where: { id: pid } });
    if (!n) throw new BadRequestException("Proyecto no encontrado");

    const rows = await this.prisma.inventoryItem.findMany({
      where: {
        projectId: pid,
        destinationKind: "PROJECT",
        AND: [{ sku: { not: null } }, { sku: { not: "" } }],
      },
      select: { id: true, sku: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    const groups = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = InventoryService.normSerialSku(r.sku!);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const toDelete: string[] = [];
    for (const [, arr] of groups) {
      if (arr.length < 2) continue;
      const sorted = [...arr].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const losers = keep === "OLDEST" ? sorted.slice(1) : sorted.slice(0, -1);
      toDelete.push(...losers.map((x) => x.id));
    }

    const CHUNK = 300;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const chunk = toDelete.slice(i, i + CHUNK);
      await this.prisma.inventoryItem.deleteMany({ where: { id: { in: chunk } } });
    }

    return {
      projectId: pid,
      deleted: toDelete.length,
      duplicateSerialsResolved: [...groups.values()].filter((a) => a.length > 1).length,
      keep,
    };
  }

  /**
   * Resumen analítico para panel de indicadores de logística (agrupaciones en memoria).
   * Valor estimado: último precio vigente del producto (coste > compra > lista) × cantidad de línea.
   */
  async kpiDashboard(projectIdFilter?: string | null): Promise<InventoryKpiDashboardDto> {
    const pidFilter = projectIdFilter?.trim() || null;
    const where: Prisma.InventoryItemWhereInput = pidFilter
      ? {
          OR: [
            { projectId: pidFilter },
            { logisticsInternationalSnapshot: { projectId: pidFilter } } as Prisma.InventoryItemWhereInput,
          ],
        }
      : {};

    const now = new Date();
    const rows = await this.prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        quantity: true,
        linksJson: true,
        projectId: true,
        project: { select: { id: true, code: true, name: true } },
        logisticsInternationalSnapshot: {
          select: {
            project: { select: { id: true, code: true, name: true } },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            commercialStatus: true,
            category: { select: { slug: true, name: true } },
            prices: {
              orderBy: { validFrom: "desc" },
              take: 24,
              select: {
                validFrom: true,
                validTo: true,
                price: true,
                cost: true,
                purchasePrice: true,
                currency: true,
              },
            },
          },
        },
      },
    });

    type PricePick = {
      validFrom: Date;
      validTo: Date | null;
      price: Prisma.Decimal;
      cost: Prisma.Decimal | null;
      purchasePrice: Prisma.Decimal | null;
      currency: string;
    };

    const pickValidPrice = (prices: PricePick[]): PricePick | null => {
      for (const p of prices) {
        if (p.validFrom.getTime() > now.getTime()) continue;
        if (p.validTo != null && p.validTo.getTime() < now.getTime()) continue;
        return p;
      }
      return null;
    };

    type EffProj = { id: string; code: string; name: string };
    const effectiveProject = (r: (typeof rows)[0]): EffProj | null => {
      if (r.project) return r.project;
      const p = r.logisticsInternationalSnapshot?.project;
      return p ?? null;
    };

    let quantitySum = 0;
    let estimatedStockValue = 0;
    const currencyTally = new Map<string, number>();
    let linesWithoutLinkedProduct = 0;
    let linesWithNonActiveCatalogProduct = 0;

    const byProjectMap = new Map<
      string,
      { project: EffProj; lineCount: number; quantitySum: number; estimatedStockValue: number }
    >();
    const byFamilyMap = new Map<string, InventoryKpiByFamilyRow>();
    const topScratch: InventoryKpiTopLine[] = [];
    const nonActiveMap = new Map<string, InventoryKpiNonActiveHoldRow>();

    for (const r of rows) {
      const qty = Number(r.quantity) || 0;
      quantitySum += qty;

      const trace = parseTraceability(r.linksJson);
      const cat = r.product?.category;
      const { key: famKey, label: famLabel } = inferFamilyKeyLabel({
        traceability: trace,
        linksJson: r.linksJson,
        categorySlug: cat?.slug ?? null,
        categoryName: cat?.name ?? null,
      });
      const famPrev = byFamilyMap.get(famKey);
      if (famPrev) {
        famPrev.lineCount += 1;
        famPrev.quantitySum += qty;
      } else {
        byFamilyMap.set(famKey, { key: famKey, label: famLabel, lineCount: 1, quantitySum: qty });
      }

      if (!r.product) {
        linesWithoutLinkedProduct += 1;
      } else if (r.product.commercialStatus !== "ACTIVO") {
        linesWithNonActiveCatalogProduct += 1;
        const prodId = r.product.id;
        const prev = nonActiveMap.get(prodId);
        if (prev) {
          prev.lineCount += 1;
          prev.quantitySum += qty;
        } else {
          nonActiveMap.set(prodId, {
            productId: prodId,
            productName: r.product.name,
            commercialStatus: r.product.commercialStatus,
            lineCount: 1,
            quantitySum: qty,
          });
        }
      }

      const priceRow = r.product ? pickValidPrice(r.product.prices) : null;
      let lineVal = 0;
      let cur: string | null = null;
      if (priceRow) {
        lineVal = qty * unitValueFromLatestPriceRow(priceRow);
        cur = priceRow.currency?.trim() || null;
        if (cur && lineVal > 0) {
          currencyTally.set(cur, (currencyTally.get(cur) ?? 0) + lineVal);
        }
      }
      estimatedStockValue += lineVal;

      const proj = effectiveProject(r);
      if (proj) {
        const prev = byProjectMap.get(proj.id);
        if (prev) {
          prev.lineCount += 1;
          prev.quantitySum += qty;
          prev.estimatedStockValue += lineVal;
        } else {
          byProjectMap.set(proj.id, {
            project: proj,
            lineCount: 1,
            quantitySum: qty,
            estimatedStockValue: lineVal,
          });
        }
      } else {
        const k = "__sin_proyecto__";
        const prev = byProjectMap.get(k);
        const pseudo: EffProj = { id: k, code: "—", name: "Sin proyecto asociado" };
        if (prev) {
          prev.lineCount += 1;
          prev.quantitySum += qty;
          prev.estimatedStockValue += lineVal;
        } else {
          byProjectMap.set(k, {
            project: pseudo,
            lineCount: 1,
            quantitySum: qty,
            estimatedStockValue: lineVal,
          });
        }
      }

      topScratch.push({
        inventoryItemId: r.id,
        name: r.name,
        quantity: qty,
        estimatedLineValue: lineVal,
        currency: cur,
        productName: r.product?.name ?? null,
      });
    }

    let valuationCurrency: string | null = null;
    if (currencyTally.size === 1) {
      valuationCurrency = [...currencyTally.keys()][0] ?? null;
    }

    const byProject: InventoryKpiByProjectRow[] = [...byProjectMap.values()]
      .map((v) => ({
        projectId: v.project.id,
        projectCode: v.project.code,
        projectName: v.project.name,
        lineCount: v.lineCount,
        quantitySum: v.quantitySum,
        estimatedStockValue: Math.round(v.estimatedStockValue * 100) / 100,
      }))
      .sort((a, b) => b.quantitySum - a.quantitySum);

    const byFamily = [...byFamilyMap.values()].sort((a, b) => b.lineCount - a.lineCount);

    topScratch.sort((a, b) => b.estimatedLineValue - a.estimatedLineValue);
    const topLinesByEstimatedValue: InventoryKpiTopLine[] = topScratch.slice(0, 12).map((x) => ({
      ...x,
      estimatedLineValue: Math.round(x.estimatedLineValue * 100) / 100,
    }));

    const nonActiveProductHold = [...nonActiveMap.values()].sort((a, b) => b.lineCount - a.lineCount);

    return {
      generatedAt: new Date().toISOString(),
      projectIdFilter: pidFilter,
      totals: {
        lineCount: rows.length,
        quantitySum: Math.round(quantitySum * 1000) / 1000,
        estimatedStockValue: Math.round(estimatedStockValue * 100) / 100,
        valuationCurrency,
        linesWithoutLinkedProduct,
        linesWithNonActiveCatalogProduct,
      },
      byProject,
      byFamily,
      topLinesByEstimatedValue,
      nonActiveProductHold,
    };
  }

  /**
   * Vista operativa de transporte: agrupa inventario relevante (OQC, BOM proveedor, importación internacional)
   * por proyecto + pallet y cruza con «Registro Transporte» del snapshot cuando el ID pallet coincide.
   */
  async transportOverview(projectIdFilter?: string | null): Promise<InventoryTransportOverviewDto> {
    const pid = projectIdFilter?.trim() || null;
    const where: Prisma.InventoryItemWhereInput = pid
      ? {
          OR: [{ projectId: pid }, { logisticsInternationalSnapshot: { projectId: pid } }],
        }
      : {};

    const rows = await this.prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        sku: true,
        quantity: true,
        linksJson: true,
        projectId: true,
        project: { select: { id: true, code: true, name: true } },
        logisticsInternationalSnapshotId: true,
        logisticsInternationalSnapshot: {
          select: {
            id: true,
            orderRef: true,
            transportJson: true,
            projectId: true,
            project: { select: { id: true, code: true, name: true } },
          },
        },
      },
      take: 20000,
    });

    type Row = (typeof rows)[0];
    const effProj = (r: Row) => r.project ?? r.logisticsInternationalSnapshot?.project ?? null;

    type Acc = {
      project: { id: string; code: string; name: string } | null;
      palletId: string | null;
      lines: Row[];
      snapId: string | null;
      orderRef: string | null;
      transportRows: Record<string, unknown>[];
      traceLabels: Set<string>;
    };

    const groupMap = new Map<string, Acc>();
    let linesIncluded = 0;

    for (const r of rows) {
      const links = parseLinksJsonObject(r.linksJson);
      const trace = parseTraceability(r.linksJson);
      const snapId = r.logisticsInternationalSnapshotId;
      if (!rowMatchesTransportOverview(links, trace, snapId)) continue;
      linesIncluded += 1;

      const palletId = palletIdFromLinks(links);
      const proj = effProj(r);
      const projKey = proj?.id ?? "_noproject";
      const palletKey = palletId?.trim() || "_sin_pallet";
      const gk = `${projKey}|${palletKey}`;

      let acc = groupMap.get(gk);
      if (!acc) {
        const snap = r.logisticsInternationalSnapshot;
        acc = {
          project: proj,
          palletId,
          lines: [],
          snapId: snapId,
          orderRef: snap?.orderRef ?? null,
          transportRows: parseGroundTransportJson(snap?.transportJson ?? null),
          traceLabels: new Set(),
        };
        groupMap.set(gk, acc);
      }

      acc.lines.push(r);
      acc.traceLabels.add(traceabilityLabelForRow(trace, snapId, links));

      if (!acc.snapId && r.logisticsInternationalSnapshotId) {
        const snap = r.logisticsInternationalSnapshot;
        acc.snapId = r.logisticsInternationalSnapshotId;
        acc.orderRef = snap?.orderRef ?? null;
        acc.transportRows = parseGroundTransportJson(snap?.transportJson ?? null);
      }
      if (!acc.project && proj) acc.project = proj;
    }

    const groups: InventoryTransportOverviewGroupDto[] = [];
    for (const [gk, acc] of groupMap) {
      let linesWithTripNumber = 0;
      for (const ln of acc.lines) {
        if (tripNumberFromLinks(parseLinksJsonObject(ln.linksJson))) linesWithTripNumber += 1;
      }
      const groundTransportRow = findGroundTransportRowForPallet(acc.transportRows, acc.palletId);
      const invSummary = transportSummaryFromLinks(parseLinksJsonObject(acc.lines[0]?.linksJson ?? null));
      groups.push({
        groupKey: gk,
        project: acc.project,
        palletId: acc.palletId,
        lineCount: acc.lines.length,
        quantitySum: acc.lines.reduce((s, x) => s + (Number(x.quantity) || 0), 0),
        linesWithTripNumber,
        sampleSkus: acc.lines.map((x) => x.sku || "").filter(Boolean).slice(0, 5),
        traceabilityLabels: [...acc.traceLabels].sort(),
        logisticsSnapshotId: acc.snapId,
        orderRef: acc.orderRef,
        groundTransportRow,
        inventoryTransportSummary: invSummary,
      });
    }

    groups.sort((a, b) => {
      const ca = a.project?.code ?? "";
      const cb = b.project?.code ?? "";
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.palletId ?? "").localeCompare(b.palletId ?? "", undefined, { numeric: true });
    });

    const projectIdsForHeuristic = new Set<string>();
    for (const g of groups) {
      if (!g.groundTransportRow && g.palletId && g.project?.id) projectIdsForHeuristic.add(g.project.id);
    }
    if (projectIdsForHeuristic.size > 0) {
      const snaps = await this.prisma.logisticsInternationalSnapshot.findMany({
        where: { projectId: { in: [...projectIdsForHeuristic] } },
        select: { id: true, orderRef: true, transportJson: true, projectId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 80,
      });
      for (const g of groups) {
        if (g.groundTransportRow || !g.palletId || !g.project?.id) continue;
        const candidates = snaps.filter((s) => s.projectId === g.project.id);
        for (const s of candidates) {
          const tr = parseGroundTransportJson(s.transportJson ?? null);
          const hit = findGroundTransportRowForPallet(tr, g.palletId);
          if (hit) {
            g.groundTransportRow = hit;
            g.logisticsSnapshotId = s.id;
            g.orderRef = s.orderRef ?? g.orderRef;
            break;
          }
        }
      }
    }

    return {
      groups,
      totals: {
        inventoryLinesScanned: rows.length,
        linesIncluded,
        groupCount: groups.length,
      },
    };
  }

  /** Mismo patch aplicado a varios grupos (una transacción). */
  async applyTransportBulk(args: {
    targets: { projectId: string; palletId: string | null }[];
    snapshotId?: string | null;
    patch: {
      tripNumber?: string | null;
      guideNumber?: string | null;
      truckPlate?: string | null;
      trailerPlate?: string | null;
      conductor?: string | null;
      driverRut?: string | null;
      driverPhone?: string | null;
      transportCompany?: string | null;
      logisticsTransportStatus?: string | null;
      pickupOrigin?: string | null;
      deliveryDestination?: string | null;
      deliveryObservation?: string | null;
    };
  }): Promise<{ updatedInventoryLines: number; targetsApplied: number; palletsUpdatedInSnapshot: number }> {
    const seen = new Set<string>();
    const unique: { projectId: string; palletId: string | null }[] = [];
    for (const t of args.targets) {
      const pid = t.projectId.trim();
      if (!pid) continue;
      const pal = t.palletId?.trim() || null;
      const k = `${pid}|${pal ?? "_"}`;
      if (seen.has(k)) continue;
      seen.add(k);
      unique.push({ projectId: pid, palletId: pal });
    }
    if (!unique.length) throw new BadRequestException("Indique al menos un destino válido (projectId)");

    const projectIds = [...new Set(unique.map((t) => t.projectId))];
    const where: Prisma.InventoryItemWhereInput = {
      OR: [{ projectId: { in: projectIds } }, { logisticsInternationalSnapshot: { projectId: { in: projectIds } } }],
    };

    const lines = await this.prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        linksJson: true,
        projectId: true,
        logisticsInternationalSnapshotId: true,
        logisticsInternationalSnapshot: { select: { projectId: true } },
      },
      take: 20000,
    });

    type L = (typeof lines)[0];
    const effProjId = (r: L) => r.projectId ?? r.logisticsInternationalSnapshot?.projectId ?? null;

    const matchLinesForTarget = (pid: string, palletNorm: string | null): L[] =>
      lines.filter((r) => {
        if (effProjId(r) !== pid) return false;
        const links = parseLinksJsonObject(r.linksJson);
        const trace = parseTraceability(r.linksJson);
        const snapId = r.logisticsInternationalSnapshotId;
        if (!rowMatchesTransportOverview(links, trace, snapId)) return false;
        const p = palletIdFromLinks(links);
        const pNorm = p?.trim() || null;
        if (palletNorm === null) return pNorm === null;
        return pNorm === palletNorm;
      });

    const idsToUpdate = new Set<string>();
    for (const t of unique) {
      const hits = matchLinesForTarget(t.projectId, t.palletId);
      for (const h of hits) idsToUpdate.add(h.id);
    }

    if (!idsToUpdate.size) throw new BadRequestException("Ningún grupo seleccionado coincide con inventario transportable");

    const linkPatch = transportPatchForLinksJson(args.patch);
    const lineById = new Map(lines.map((r) => [r.id, r]));

    const snapId = args.snapshotId?.trim() || null;
    const patchUi = {
      transportCompany: args.patch.transportCompany ?? null,
      conductor: args.patch.conductor ?? null,
      driverRut: args.patch.driverRut ?? null,
      driverPhone: args.patch.driverPhone ?? null,
      truckPlate: args.patch.truckPlate ?? null,
      trailerPlate: args.patch.trailerPlate ?? null,
      tripNumber: args.patch.tripNumber ?? null,
      guideNumber: args.patch.guideNumber ?? null,
      logisticsTransportStatus: args.patch.logisticsTransportStatus ?? null,
      pickupOrigin: args.patch.pickupOrigin ?? null,
      deliveryDestination: args.patch.deliveryDestination ?? null,
      deliveryObservation: args.patch.deliveryObservation ?? null,
    };

    const palletsWithId = unique.filter((t) => t.palletId?.trim()).length;

    await this.prisma.$transaction(async (tx) => {
      for (const id of idsToUpdate) {
        const row = lineById.get(id);
        if (!row) continue;
        const nextJson = mergeTransportPatchIntoLinksJson(row.linksJson, linkPatch);
        await tx.inventoryItem.update({
          where: { id },
          data: { linksJson: normalizeLinksJson(nextJson) },
        });
      }

      if (snapId && palletsWithId > 0) {
        const snap = await tx.logisticsInternationalSnapshot.findUnique({ where: { id: snapId } });
        if (!snap) throw new BadRequestException("snapshotId no encontrado");
        let arr = parseGroundTransportJson(snap.transportJson);
        for (const t of unique) {
          if (!t.palletId?.trim()) continue;
          arr = upsertGroundTransportRowForPallet(arr, t.palletId.trim(), patchUi);
        }
        await tx.logisticsInternationalSnapshot.update({
          where: { id: snapId },
          data: { transportJson: JSON.stringify(arr) },
        });
      }
    });

    return {
      updatedInventoryLines: idsToUpdate.size,
      targetsApplied: unique.length,
      palletsUpdatedInSnapshot: snapId && palletsWithId > 0 ? palletsWithId : 0,
    };
  }

  /**
   * Aplica datos de transporte a todas las líneas de inventario del grupo (proyecto + pallet)
   * y opcionalmente sincroniza la hoja «Registro Transporte» del snapshot indicado.
   */
  async applyTransportToGroup(args: {
    projectId: string;
    palletId: string | null;
    snapshotId?: string | null;
    patch: {
      tripNumber?: string | null;
      guideNumber?: string | null;
      truckPlate?: string | null;
      trailerPlate?: string | null;
      conductor?: string | null;
      driverRut?: string | null;
      driverPhone?: string | null;
      transportCompany?: string | null;
      logisticsTransportStatus?: string | null;
      pickupOrigin?: string | null;
      deliveryDestination?: string | null;
      deliveryObservation?: string | null;
    };
  }): Promise<{ updatedInventoryLines: number; snapshotTransportUpdated: boolean }> {
    const r = await this.applyTransportBulk({
      targets: [{ projectId: args.projectId, palletId: args.palletId }],
      snapshotId: args.snapshotId,
      patch: args.patch,
    });
    return {
      updatedInventoryLines: r.updatedInventoryLines,
      snapshotTransportUpdated: r.palletsUpdatedInSnapshot > 0,
    };
  }
}

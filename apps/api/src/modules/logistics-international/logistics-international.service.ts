import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import * as XLSX from "xlsx";
import { PrismaService } from "../../infra/prisma/prisma.service";
import type { CreateInventoryItemDto } from "../inventory/dto/create-inventory-item.dto";
import { InventoryService } from "../inventory/inventory.service";
import { buildLogisticsTraceabilityDerived } from "./logistics-international.derived";
import type { LogisticsParsedPayload } from "./logistics-international.parser";
import { parseLogisticaInternacionalBuffer } from "./logistics-international.parser";

function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj);
}

@Injectable()
export class LogisticsInternationalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  async importFromFile(buffer: Buffer, sourceFileName: string, projectId?: string | null) {
    let payload: LogisticsParsedPayload;
    try {
      payload = parseLogisticaInternacionalBuffer(buffer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo leer el Excel";
      throw new BadRequestException(msg);
    }

    const { summary, panels, pallets, shipments, groundTransport } = payload;
    const title = `Logística internacional · ${summary.orderRef ?? "importación"}`;

    const snap = await this.prisma.logisticsInternationalSnapshot.create({
      data: {
        projectId: projectId?.trim() || null,
        title,
        orderRef: summary.orderRef,
        sourceFileName: sourceFileName?.slice(0, 500) || null,
        summaryJson: safeJsonStringify(summary),
        palletsJson: safeJsonStringify(pallets),
        panelsJson: safeJsonStringify(panels),
        shipmentsJson: safeJsonStringify(shipments),
        transportJson: safeJsonStringify(groundTransport),
      },
    });

    const qty = summary.panelCount > 0 ? summary.panelCount : panels.length;
    const descParts = [
      summary.headline && `Resumen: ${summary.headline}`,
      summary.productLine && `Producto: ${summary.productLine}`,
      summary.routeText && `Ruta / volúmenes: ${summary.routeText}`,
      `Pallets en archivo: ${pallets.length}. Embarques (Datos Base): ${shipments.length}. Registros transporte: ${groundTransport.length}.`,
      `Archivo: ${sourceFileName}`,
    ].filter(Boolean);
    const description = descParts.join("\n").slice(0, 3900);

    const hasProject = Boolean(projectId?.trim());
    const linksJson = safeJsonStringify({
      type: "international_logistics",
      logisticsSnapshotId: snap.id,
    });

    const skuSuffix = `${summary.orderRef ?? "IMP"}-${snap.id.slice(0, 10)}`.replace(/\s+/g, "");
    const invDto: CreateInventoryItemDto = {
      name: `Paneles operación ${summary.orderRef ?? "importación"} (${qty} u.)`.slice(0, 500),
      description,
      quantity: qty,
      unit: "panel",
      destinationKind: hasProject ? "PROJECT" : "GENERAL",
      destinationNote: hasProject ? null : "Importación logística internacional; asocie un proyecto desde Inventario si aplica.",
      projectId: hasProject ? projectId!.trim() : null,
      quoteId: null,
      productId: null,
      sku: `LOG-INT-${skuSuffix}`.slice(0, 120),
      storageLocation: null,
      linksJson,
      logisticsInternationalSnapshotId: snap.id,
    };
    const inventoryItem = await this.inventoryService.create(invDto);

    return {
      snapshot: this.serializeSnapshot(snap),
      inventoryItem,
      counts: {
        panels: panels.length,
        pallets: pallets.length,
        shipments: shipments.length,
        groundTransport: groundTransport.length,
      },
    };
  }

  async list(projectId?: string) {
    const where = projectId?.trim() ? { projectId: projectId.trim() } : {};
    const rows = await this.prisma.logisticsInternationalSnapshot.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { project: { select: { id: true, code: true, name: true } } },
      take: 50,
    });
    return rows.map((r) => this.serializeSnapshot(r));
  }

  async getById(id: string) {
    const row = await this.prisma.logisticsInternationalSnapshot.findUnique({
      where: { id },
      include: { project: { select: { id: true, code: true, name: true } } },
    });
    if (!row) throw new NotFoundException("Importación no encontrada");
    return this.serializeSnapshot(row, true);
  }

  /** Elimina la importación y los ítems de inventario creados automáticamente con este vínculo. */
  async deleteById(id: string) {
    if (!id.trim()) throw new BadRequestException("Id inválido");
    const exists = await this.prisma.logisticsInternationalSnapshot.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Importación no encontrada");

    await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.deleteMany({ where: { logisticsInternationalSnapshotId: id } });
      await tx.logisticsInternationalSnapshot.delete({ where: { id } });
    });

    return { ok: true as const, id };
  }

  async updateShipments(id: string, shipments: unknown[]) {
    if (!Array.isArray(shipments)) throw new BadRequestException("Body inválido: se espera { shipments: [...] }");
    const row = await this.prisma.logisticsInternationalSnapshot.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Importación no encontrada");
    const normalized = shipments.map((s) => (typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {}));
    await this.prisma.logisticsInternationalSnapshot.update({
      where: { id },
      data: { shipmentsJson: safeJsonStringify(normalized) },
    });
    return this.getById(id);
  }

  async updatePallets(id: string, pallets: unknown[]) {
    if (!Array.isArray(pallets)) throw new BadRequestException("Body inválido: se espera { pallets: [...] }");
    const row = await this.prisma.logisticsInternationalSnapshot.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Importación no encontrada");
    const normalized = pallets.map((s) => (typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {}));
    await this.prisma.logisticsInternationalSnapshot.update({
      where: { id },
      data: { palletsJson: safeJsonStringify(normalized) },
    });
    return this.getById(id);
  }

  async updateGroundTransport(id: string, groundTransport: unknown[]) {
    if (!Array.isArray(groundTransport)) throw new BadRequestException("Body inválido: se espera { groundTransport: [...] }");
    const row = await this.prisma.logisticsInternationalSnapshot.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Importación no encontrada");
    const normalized = groundTransport.map((s) =>
      typeof s === "object" && s !== null ? (s as Record<string, unknown>) : {},
    );
    await this.prisma.logisticsInternationalSnapshot.update({
      where: { id },
      data: { transportJson: safeJsonStringify(normalized) },
    });
    return this.getById(id);
  }

  async exportXlsxBuffer(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const row = await this.prisma.logisticsInternationalSnapshot.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Importación no encontrada");
    const panels = JSON.parse(row.panelsJson) as unknown[];
    const pallets = JSON.parse(row.palletsJson) as unknown[];
    const shipments = JSON.parse(row.shipmentsJson) as unknown[];
    const transport = JSON.parse(row.transportJson) as unknown[];
    const summary = JSON.parse(row.summaryJson) as Record<string, unknown>;
    const wb = XLSX.utils.book_new();
    const append = (name: string, rows: unknown[]) => {
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };
    append("Resumen", [summary]);
    append("Base Paneles", panels);
    append("Base Pallets", pallets);
    append("Datos Base", shipments);
    append("Registro Transporte", transport);
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const safe = (row.orderRef ?? row.id).replace(/[^\w.-]+/g, "_").slice(0, 40);
    return { buffer: buf, filename: `Logistica_export_${safe}.xlsx` };
  }

  private serializeSnapshot(
    row: {
      id: string;
      projectId: string | null;
      title: string;
      orderRef: string | null;
      sourceFileName: string | null;
      summaryJson: string;
      palletsJson: string;
      panelsJson: string;
      shipmentsJson: string;
      transportJson: string;
      createdAt: Date;
      updatedAt: Date;
      project?: { id: string; code: string; name: string } | null;
    },
    includePayload = false,
  ) {
    const base = {
      id: row.id,
      projectId: row.projectId,
      title: row.title,
      orderRef: row.orderRef,
      sourceFileName: row.sourceFileName,
      summary: JSON.parse(row.summaryJson) as unknown,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      project: row.project ?? null,
    };
    if (!includePayload) return base;
    const panels = JSON.parse(row.panelsJson) as unknown[];
    const pallets = JSON.parse(row.palletsJson) as unknown[];
    const shipments = JSON.parse(row.shipmentsJson) as unknown[];
    const groundTransport = JSON.parse(row.transportJson) as unknown[];
    return {
      ...base,
      panels,
      pallets,
      shipments,
      groundTransport,
      derived: buildLogisticsTraceabilityDerived(panels, pallets, groundTransport),
    };
  }
}

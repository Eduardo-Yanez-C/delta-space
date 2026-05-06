import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import type { AuthUserPayload } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { CreateInventoryItemDto } from "./dto/create-inventory-item.dto";
import { DeduplicateSerialsDto } from "./dto/deduplicate-serials.dto";
import { PurgeProjectInventoryDto } from "./dto/purge-project-inventory.dto";
import { RelinkOqcCatalogDto } from "./dto/relink-oqc-catalog.dto";
import { ImportOqcPanelsDto } from "./dto/import-oqc-panels.dto";
import { RefineSupplierBomDraftAiDto } from "./dto/refine-supplier-bom-draft-ai.dto";
import { ImportSupplierBomConfirmedDto } from "./dto/supplier-bom-line-in.dto";
import { ApplyTransportBulkDto } from "./dto/apply-transport-bulk.dto";
import { ApplyTransportToGroupDto } from "./dto/apply-transport-group.dto";
import { UpdateInventoryItemDto } from "./dto/update-inventory-item.dto";
import { InventoryBomExtractService } from "./inventory-bom-extract.service";
import { InventoryService } from "./inventory.service";

const OQC_FILE_MAX_BYTES = 28 * 1024 * 1024;
const BOM_IMPORT_MAX_BYTES = 12 * 1024 * 1024;
/** Extensiones admitidas por `extract-supplier-bom-draft` (IA). */
const BOM_IMPORT_NAME_RE = /\.(pdf|docx|xlsx|xls|csv|txt|tsv)$/i;

type ReqWithUser = Request & { user?: AuthUserPayload };

@Controller("inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly inventoryBomExtractService: InventoryBomExtractService,
  ) {}

  @Get("duplicate-serials")
  listDuplicateSerials(@Query("projectId") projectId?: string) {
    if (!projectId?.trim()) {
      throw new BadRequestException("Indique projectId en la query (proyecto a analizar).");
    }
    return this.inventoryService.listDuplicateOqcSerials(projectId.trim());
  }

  /** Panel de indicadores: cantidades por proyecto, valor estimado, familias y productos no activos. */
  @Get("kpi-dashboard")
  kpiDashboard(@Query("projectId") projectId?: string) {
    return this.inventoryService.kpiDashboard(projectId?.trim() || null);
  }

  /**
   * Hub de transporte: carga agrupada desde inventario (OQC, BOM, importación) cruzada con Registro Transporte del snapshot.
   */
  @Get("transport-overview")
  transportOverview(@Query("projectId") projectId?: string) {
    return this.inventoryService.transportOverview(projectId?.trim() || null);
  }

  /** Guarda transporte (viaje, conductor, patentes, etc.) en todas las líneas del pallet y opcionalmente en el Excel del snapshot. */
  @Post("apply-transport-group")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  applyTransportGroup(@Body() body: ApplyTransportToGroupDto) {
    const p = body.patch;
    return this.inventoryService.applyTransportToGroup({
      projectId: body.projectId,
      palletId: body.palletId ?? null,
      snapshotId: body.snapshotId ?? null,
      patch: {
        tripNumber: p.tripNumber,
        guideNumber: p.guideNumber,
        truckPlate: p.truckPlate,
        trailerPlate: p.trailerPlate,
        conductor: p.conductor,
        driverRut: p.driverRut,
        transportCompany: p.transportCompany,
        logisticsTransportStatus: p.logisticsTransportStatus,
        deliveryDestination: p.deliveryDestination,
      },
    });
  }

  /** Mismo patch de transporte aplicado a varios grupos (proyecto + pallet) en una sola transacción. */
  @Post("apply-transport-bulk")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  applyTransportBulk(@Body() body: ApplyTransportBulkDto) {
    const p = body.patch;
    return this.inventoryService.applyTransportBulk({
      targets: body.targets.map((t) => ({ projectId: t.projectId, palletId: t.palletId ?? null })),
      snapshotId: body.snapshotId ?? null,
      patch: {
        tripNumber: p.tripNumber,
        guideNumber: p.guideNumber,
        truckPlate: p.truckPlate,
        trailerPlate: p.trailerPlate,
        conductor: p.conductor,
        driverRut: p.driverRut,
        transportCompany: p.transportCompany,
        logisticsTransportStatus: p.logisticsTransportStatus,
        deliveryDestination: p.deliveryDestination,
      },
    });
  }

  /** Documento (PDF, Word, Excel, CSV/TXT) → borrador de líneas BOM (OpenAI). No escribe en base de datos. */
  @Post("extract-supplier-bom-draft")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: BOM_IMPORT_MAX_BYTES },
    }),
  )
  extractSupplierBomDraft(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body("extraInstructions") extraInstructions?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Adjunte un archivo en el campo «file» (multipart).");
    }
    const n = file.originalname || "";
    if (!BOM_IMPORT_NAME_RE.test(n.toLowerCase())) {
      throw new BadRequestException(
        "Formato no admitido. Use PDF, Word (.docx), Excel (.xlsx o .xls) o texto plano / CSV (.csv, .txt, .tsv).",
      );
    }
    const extra = typeof extraInstructions === "string" ? extraInstructions : undefined;
    return this.inventoryBomExtractService.extractDraftFromDocument(file.buffer, n || "documento", extra);
  }

  /** Ajusta el borrador BOM ya extraído según instrucciones en lenguaje natural (OpenAI). */
  @Post("refine-supplier-bom-draft-ai")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  refineSupplierBomDraftAi(@Body() dto: RefineSupplierBomDraftAiDto) {
    return this.inventoryBomExtractService.refineDraftWithAi(dto.lines, dto.instruction);
  }

  /** Confirma importación de líneas BOM al inventario del proyecto (sin crear productos de catálogo). */
  @Post("import-supplier-bom-confirmed")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  importSupplierBomConfirmed(@Body() dto: ImportSupplierBomConfirmedDto) {
    return this.inventoryBomExtractService.importConfirmed(dto);
  }

  @Get()
  list(
    @Query("destinationKind") destinationKind?: string,
    @Query("projectId") projectId?: string,
    @Query("quoteId") quoteId?: string,
    @Query("productId") productId?: string,
    @Query("search") search?: string,
    @Query("pallet") pallet?: string,
  ) {
    return this.inventoryService.list({
      destinationKind: destinationKind?.trim(),
      projectId: projectId?.trim(),
      quoteId: quoteId?.trim(),
      productId: productId?.trim(),
      search: search?.trim(),
      pallet: pallet?.trim(),
    });
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  create(@Body() dto: CreateInventoryItemDto) {
    return this.inventoryService.create(dto);
  }

  @Post("import-oqc-panels")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  importOqcPanels(@Body() dto: ImportOqcPanelsDto, @Req() req: ReqWithUser) {
    return this.inventoryService.importOqcPanels(dto, {
      importedByEmail: req.user?.email?.trim() || null,
    });
  }

  @Post("import-oqc-file")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: OQC_FILE_MAX_BYTES },
    }),
  )
  importOqcFile(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: ReqWithUser,
    @Query("projectId") projectId?: string,
    @Query("projectCode") projectCode?: string,
    @Query("productId") productId?: string,
    @Query("reportRef") reportRef?: string,
    @Query("sourceFileHint") sourceFileHint?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException("Debe adjuntar un archivo .csv, .xlsx o .xls en el campo «file» (formulario multipart).");
    }
    const n = (file.originalname || "").toLowerCase();
    if (!n.endsWith(".csv") && !n.endsWith(".xlsx") && !n.endsWith(".xls")) {
      throw new BadRequestException("Solo se admiten extensiones .csv, .xlsx o .xls");
    }
    const pid = projectId?.trim();
    const pcode = projectCode?.trim();
    return this.inventoryService.importOqcFromSpreadsheetBuffer(file.buffer, file.originalname || "import.xlsx", {
      projectId: pid || undefined,
      projectCode: pcode || (!pid ? "CSO" : undefined),
      productId: productId?.trim(),
      reportRef: reportRef?.trim(),
      sourceFileHint: sourceFileHint?.trim(),
      importMeta: {
        importedByEmail: req.user?.email?.trim() || null,
        importedAtIso: new Date().toISOString(),
      },
    });
  }

  @Post("deduplicate-serials")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  deduplicateSerials(@Body() dto: DeduplicateSerialsDto) {
    return this.inventoryService.deduplicateOqcSerials(dto.projectId, dto.keep);
  }

  @Post("relink-oqc-catalog")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  relinkOqcCatalog(@Body() dto: RelinkOqcCatalogDto) {
    return this.inventoryService.relinkOqcPanelCatalogForProject(dto.projectId);
  }

  @Post("purge-project-items")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  purgeProjectItems(@Body() dto: PurgeProjectInventoryDto) {
    return this.inventoryService.purgeProjectInventoryItems(dto.projectId, dto.securityPin, dto.scope);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )
  update(@Param("id") id: string, @Body() dto: UpdateInventoryItemDto) {
    return this.inventoryService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("id") id: string) {
    return this.inventoryService.remove(id);
  }
}

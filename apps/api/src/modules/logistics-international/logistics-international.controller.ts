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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { LogisticsInternationalService } from "./logistics-international.service";

const IMPORT_MAX_BYTES = 22 * 1024 * 1024;

@Controller("logistics-international")
@UseGuards(JwtAuthGuard)
export class LogisticsInternationalController {
  constructor(private readonly logisticsInternationalService: LogisticsInternationalService) {}

  @Get("snapshots")
  listSnapshots(@Query("projectId") projectId?: string) {
    return this.logisticsInternationalService.list(projectId);
  }

  @Get("snapshots/:id")
  getSnapshot(@Param("id") id: string) {
    return this.logisticsInternationalService.getById(id.trim());
  }

  @Delete("snapshots/:id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deleteSnapshot(@Param("id") id: string) {
    return this.logisticsInternationalService.deleteById(id.trim());
  }

  @Get("snapshots/:id/export.xlsx")
  async exportSnapshot(@Param("id") id: string) {
    const { buffer, filename } = await this.logisticsInternationalService.exportXlsxBuffer(id.trim());
    return new StreamableFile(buffer, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      disposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
    });
  }

  @Patch("snapshots/:id/shipments")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateShipments(@Param("id") id: string, @Body() body: { shipments?: unknown[] }) {
    return this.logisticsInternationalService.updateShipments(id.trim(), body?.shipments ?? []);
  }

  @Patch("snapshots/:id/pallets")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updatePallets(@Param("id") id: string, @Body() body: { pallets?: unknown[] }) {
    return this.logisticsInternationalService.updatePallets(id.trim(), body?.pallets ?? []);
  }

  @Patch("snapshots/:id/transport")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  updateTransport(@Param("id") id: string, @Body() body: { groundTransport?: unknown[] }) {
    return this.logisticsInternationalService.updateGroundTransport(id.trim(), body?.groundTransport ?? []);
  }

  @Post("import")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { fileSize: IMPORT_MAX_BYTES },
    }),
  )
  importExcel(@UploadedFile() file: Express.Multer.File | undefined, @Query("projectId") projectId?: string) {
    if (!file?.buffer?.length) throw new BadRequestException("Debe adjuntar el archivo Excel (.xlsx) en el campo «file».");
    const name = (file.originalname || "import.xlsx").toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw new BadRequestException("Solo se admiten archivos .xlsx o .xls");
    }
    return this.logisticsInternationalService.importFromFile(file.buffer, file.originalname || "import.xlsx", projectId);
  }
}

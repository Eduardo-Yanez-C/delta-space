import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ImplantationDesignService } from "./implantation-design.service";
import { UpsertImplantationDesignDto } from "./dto/upsert-implantation-design.dto";
import type { Response } from "express";

@Controller("fv-studies/:fvStudyId/implantation-design")
@UseGuards(JwtAuthGuard)
export class ImplantationDesignController {
  constructor(private readonly implantationDesignService: ImplantationDesignService) {}

  @Get()
  async getDesign(
    @Param("fvStudyId") fvStudyId: string,
    @CurrentUser() user: unknown,
    @Res() res: Response,
  ) {
    const design = await this.implantationDesignService.findByFvStudyId(fvStudyId, user as any);
    res.status(200).json(design);
  }

  @Delete()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "VENTAS", "INGENIERIA")
  async deleteDesign(@Param("fvStudyId") fvStudyId: string, @CurrentUser() user: unknown) {
    await this.implantationDesignService.deleteDesign(fvStudyId, user as any);
    return { deleted: true };
  }

  @Put()
  @UseGuards(RolesGuard)
  @Roles("ADMIN", "VENTAS", "INGENIERIA")
  async upsertDesign(
    @Param("fvStudyId") fvStudyId: string,
    @Body() dto: UpsertImplantationDesignDto,
    @CurrentUser() user: unknown,
  ) {
    return this.implantationDesignService.upsert(fvStudyId, dto as any, user as any);
  }

  @Post("screenshot")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "VENTAS", "INGENIERIA")
  @UseInterceptors(FileInterceptor("file"))
  async uploadScreenshot(
    @Param("fvStudyId") fvStudyId: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @CurrentUser() user: unknown,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("Se requiere un archivo de imagen (campo 'file').");
    }
    const mimetype =
      file.mimetype === "image/png" || file.mimetype === "image/jpeg" ? file.mimetype : "image/png";
    return this.implantationDesignService.updateScreenshot(
      fvStudyId,
      { buffer: file.buffer, mimetype },
      user as any,
    );
  }

  @Get("screenshot")
  async getScreenshot(
    @Param("fvStudyId") fvStudyId: string,
    @CurrentUser() user: unknown,
    @Res() res: Response,
  ) {
    const shot = await this.implantationDesignService.getScreenshotFile(fvStudyId, user as any);
    if (!shot) {
      res.status(404).json({ message: "No hay captura guardada" });
      return;
    }
    res.setHeader("Content-Type", shot.contentType);
    res.send(shot.buffer);
  }
}

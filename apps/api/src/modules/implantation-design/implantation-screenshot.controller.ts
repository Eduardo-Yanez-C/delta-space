import {
  BadRequestException,
  Controller,
  Get,
  Param,
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
import type { Response } from "express";

@Controller("implantation-screenshots")
export class ImplantationScreenshotController {
  constructor(private readonly implantationDesignService: ImplantationDesignService) {}

  @Get("ping")
  ping() {
    return { ok: true };
  }

  @Post(":fvStudyId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN", "VENTAS", "INGENIERIA")
  @UseInterceptors(FileInterceptor("file"))
  async upload(
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

  @Get(":fvStudyId")
  @UseGuards(JwtAuthGuard)
  async get(
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

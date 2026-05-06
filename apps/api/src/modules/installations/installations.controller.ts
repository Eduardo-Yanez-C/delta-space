import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ActivateInstallationDto } from "./dto/activate-installation.dto";
import { RevokeInstallationDto } from "./dto/revoke-installation.dto";
import { ValidateInstallationDto } from "./dto/validate-installation.dto";
import { InstallationsService } from "./installations.service";

@Controller("installations")
export class InstallationsController {
  constructor(private readonly installationsService: InstallationsService) {}

  @Post("activate")
  async activate(@Body() dto: ActivateInstallationDto) {
    return this.installationsService.activate(dto);
  }

  @Post("validate")
  async validate(@Body() dto: ValidateInstallationDto) {
    return this.installationsService.validate(
      dto.installationId!,
      dto.installationToken!,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  findAll() {
    return this.installationsService.findAll();
  }

  @Patch(":id/revoke")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  revoke(
    @Param("id") id: string,
    @Body() dto: RevokeInstallationDto | undefined,
  ) {
    return this.installationsService.revoke(id, dto?.note);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Controller("suppliers")
@UseGuards(JwtAuthGuard)
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  findAll(
    @Query("supplyOrigin") supplyOrigin: string | undefined,
    @Query("actorType") actorType: string | undefined,
    @Query("active") active: string | undefined,
  ) {
    const activeBool =
      active === "true" ? true : active === "false" ? false : undefined;
    return this.suppliersService.findAll({
      supplyOrigin,
      actorType,
      active: activeBool,
    });
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Patch(":id/deactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deactivate(@Param("id") id: string) {
    return this.suppliersService.deactivate(id);
  }

  @Patch(":id/activate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  activate(@Param("id") id: string) {
    return this.suppliersService.activate(id);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("id") id: string) {
    return this.suppliersService.remove(id);
  }
}

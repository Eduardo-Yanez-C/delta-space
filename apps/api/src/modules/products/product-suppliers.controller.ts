import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import { ProductSuppliersService } from "./product-suppliers.service";
import { CreateProductSupplierDto } from "./dto/create-product-supplier.dto";
import { UpdateProductSupplierDto } from "./dto/update-product-supplier.dto";

@Controller("products/:productId/suppliers")
@UseGuards(JwtAuthGuard)
export class ProductSuppliersController {
  constructor(
    private readonly productSuppliersService: ProductSuppliersService,
  ) {}

  @Get()
  findAll(@Param("productId") productId: string) {
    return this.productSuppliersService.findByProduct(productId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  add(
    @Param("productId") productId: string,
    @Body() dto: CreateProductSupplierDto,
  ) {
    return this.productSuppliersService.add(productId, dto);
  }

  @Patch(":supplierId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(
    @Param("productId") productId: string,
    @Param("supplierId") supplierId: string,
    @Body() dto: UpdateProductSupplierDto,
  ) {
    return this.productSuppliersService.update(productId, supplierId, dto);
  }

  @Delete(":supplierId")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(
    @Param("productId") productId: string,
    @Param("supplierId") supplierId: string,
  ) {
    return this.productSuppliersService.remove(productId, supplierId);
  }
}

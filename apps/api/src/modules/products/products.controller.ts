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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { OPERATIONAL_WRITE_ROLES } from "../auth/role-constants";
import type { AuthUserPayload } from "../auth/auth.service";
import { PricesService } from "../prices/prices.service";
import { ProductsService } from "./products.service";
import { CreateProductDto } from "./dto/create-product.dto";
import { UpdateProductDto } from "./dto/update-product.dto";

@Controller("products")
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly pricesService: PricesService,
  ) {}

  @Get()
  findAll(
    @Query("categoryId") categoryId: string | undefined,
    @Query("brandId") brandId: string | undefined,
    @Query("modelId") modelId: string | undefined,
    @Query("supplierId") supplierId: string | undefined,
    @Query("supplyOrigin") supplyOrigin: string | undefined,
    @Query("commercialStatus") commercialStatus: string | undefined,
    @Query("search") search: string | undefined,
  ) {
    const categoryIdNum = categoryId ? parseInt(categoryId, 10) : undefined;
    const brandIdNum = brandId ? parseInt(brandId, 10) : undefined;
    const modelIdNum = modelId ? parseInt(modelId, 10) : undefined;
    return this.productsService.findAll({
      categoryId:
        categoryIdNum !== undefined && Number.isNaN(categoryIdNum)
          ? undefined
          : categoryIdNum,
      brandId:
        brandIdNum !== undefined && Number.isNaN(brandIdNum)
          ? undefined
          : brandIdNum,
      modelId:
        modelIdNum !== undefined && Number.isNaN(modelIdNum)
          ? undefined
          : modelIdNum,
      supplierId: supplierId || undefined,
      supplyOrigin: supplyOrigin || undefined,
      commercialStatus: commercialStatus || undefined,
      search: search || undefined,
    });
  }

  @Get(":id")
  findOne(
    @Param("id") id: string,
    @Query("includeLatestPrice") includeLatestPrice: string | undefined,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const include = includeLatestPrice === "true";
    return this.productsService.findOne(id, include, user);
  }

  @Get(":id/prices")
  findPricesByProduct(
    @Param("id") id: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.pricesService.findByProductId(id, user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  update(@Param("id") id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(":id/deactivate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  deactivate(@Param("id") id: string) {
    return this.productsService.deactivate(id);
  }

  @Patch(":id/activate")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  activate(@Param("id") id: string) {
    return this.productsService.activate(id);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles(...OPERATIONAL_WRITE_ROLES)
  remove(@Param("id") id: string) {
    return this.productsService.remove(id);
  }
}

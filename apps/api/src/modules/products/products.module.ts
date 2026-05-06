import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PricesModule } from "../prices/prices.module";
import { ProductSuppliersController } from "./product-suppliers.controller";
import { ProductSuppliersService } from "./product-suppliers.service";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";

@Module({
  imports: [AuthModule, PricesModule],
  controllers: [ProductsController, ProductSuppliersController],
  providers: [ProductsService, ProductSuppliersService],
  exports: [ProductsService, ProductSuppliersService],
})
export class ProductsModule {}

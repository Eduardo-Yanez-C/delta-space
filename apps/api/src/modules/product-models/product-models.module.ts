import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProductModelsController } from "./product-models.controller";
import { ProductModelsService } from "./product-models.service";

@Module({
  imports: [AuthModule],
  controllers: [ProductModelsController],
  providers: [ProductModelsService],
  exports: [ProductModelsService],
})
export class ProductModelsModule {}

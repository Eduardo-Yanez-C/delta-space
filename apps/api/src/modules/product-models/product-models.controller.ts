import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ProductModelsService } from "./product-models.service";
import { CreateProductModelDto } from "./dto/create-product-model.dto";
import { UpdateProductModelDto } from "./dto/update-product-model.dto";

@Controller("product-models")
@UseGuards(JwtAuthGuard)
export class ProductModelsController {
  constructor(private readonly productModelsService: ProductModelsService) {}

  @Get()
  findAll(@Query("brandId") brandId: string | undefined) {
    const brandIdNum = brandId ? parseInt(brandId, 10) : undefined;
    return this.productModelsService.findAll(
      brandIdNum !== undefined && Number.isNaN(brandIdNum)
        ? undefined
        : brandIdNum,
    );
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  create(@Body() dto: CreateProductModelDto) {
    return this.productModelsService.create(dto);
  }

  @Get(":id")
  findOne(@Param("id", ParseIntPipe) id: number) {
    return this.productModelsService.findOne(id);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateProductModelDto,
  ) {
    return this.productModelsService.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("ADMIN_DEV", "ADMIN")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.productModelsService.remove(id);
  }
}

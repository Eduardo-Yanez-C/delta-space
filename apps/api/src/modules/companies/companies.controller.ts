import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthUserPayload } from "../auth/auth.service";
import { CompaniesService } from "./companies.service";
import { CreateCompanyDto } from "./dto/create-company.dto";
import { UpdateCompanyDto } from "./dto/update-company.dto";

@Controller("companies")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN_DEV", "ADMIN")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get()
  findAll() {
    return this.companies.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.companies.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateCompanyDto, @CurrentUser() actor: AuthUserPayload) {
    return this.companies.create(dto, actor);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompanyDto, @CurrentUser() actor: AuthUserPayload) {
    return this.companies.update(id, dto, actor);
  }
}


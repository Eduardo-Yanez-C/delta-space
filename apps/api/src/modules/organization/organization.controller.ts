import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { ROLE_ADMIN, ROLE_ADMIN_DEV } from "../auth/role-constants";
import { CreateOrgCustomEdgeDto } from "./dto/create-org-custom-edge.dto";
import { CreateOrgNodeDto } from "./dto/create-org-node.dto";
import { UpdateOrgCustomEdgeDto } from "./dto/update-org-custom-edge.dto";
import { UpdateOrgNodeDto } from "./dto/update-org-node.dto";
import { OrganizationService } from "./organization.service";

@Controller("organization")
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get("nodes")
  findTree() {
    return this.organizationService.findTree();
  }

  @Get("custom-edges")
  findCustomEdges() {
    return this.organizationService.findCustomEdges();
  }

  @Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
  @Post("custom-edges")
  createCustomEdge(@Body() dto: CreateOrgCustomEdgeDto) {
    return this.organizationService.createCustomEdge(dto);
  }

  @Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
  @Patch("custom-edges/:id")
  updateCustomEdge(@Param("id") id: string, @Body() dto: UpdateOrgCustomEdgeDto) {
    return this.organizationService.updateCustomEdge(id, dto);
  }

  @Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
  @Delete("custom-edges/:id")
  removeCustomEdge(@Param("id") id: string) {
    return this.organizationService.removeCustomEdge(id);
  }

  @Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
  @Post("nodes")
  create(@Body() dto: CreateOrgNodeDto) {
    return this.organizationService.create(dto);
  }

  @Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
  @Patch("nodes/:id")
  update(@Param("id") id: string, @Body() dto: UpdateOrgNodeDto) {
    return this.organizationService.update(id, dto);
  }

  @Roles(ROLE_ADMIN_DEV, ROLE_ADMIN)
  @Delete("nodes/:id")
  remove(@Param("id") id: string) {
    return this.organizationService.remove(id);
  }
}
